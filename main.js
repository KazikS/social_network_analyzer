const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const axios = require("axios");
const MTProto = require("@mtproto/core");
const { channel } = require("node:diagnostics_channel");

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });
  win.loadFile("index.html");
  win.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
});

ipcMain.handle("analyze", async (event, { url, startDate, endDate }) => {
  try {
    if (url.includes("vk.com")) {
      return analyzeVK(url, startDate, endDate);
    } else if (url.includes("t.me")) {
      return analyzeTelegram(url, startDate, endDate);
    } else {
      throw new Error("Unsupported URL");
    }
  } catch (error) {
    console.error("Error in analyze handler:", error);
    throw error;
  }
});

//VK
async function analyzeVK(url, startDate, endDate) {
  const token =
    "7554f5227554f5227554f52203764c3153775547554f522132675fa2997f7d1e937998d";
  const apiVersion = "5.131";
  const groupId = await extractGroupId(url, token, apiVersion);
  let offset = 0;
  let count = 100;
  let allPosts = [];
  let hasMorePosts = true;
  while (hasMorePosts) {
    const response = await axios.get(`https://api.vk.com/method/wall.get`, {
      params: {
        owner_id: `-${groupId}`,
        count: count,
        offset: offset,
        access_token: token,
        v: apiVersion,
      },
    });
    const posts = response.data.response.items;
    if (posts.length < count) {
      hasMorePosts = false;
    }
    allPosts = allPosts.concat(posts);
    offset += count;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const filteredPosts = allPosts.filter((post) => {
    const postDate = new Date(post.date * 1000);
    return postDate >= new Date(startDate) && postDate <= new Date(endDate);
  });
  const totalLikes = filteredPosts.reduce(
    (acc, post) => acc + (post.likes ? post.likes.count : 0),
    0
  );
  const totalViews = filteredPosts.reduce(
    (acc, post) => acc + (post.views ? post.views.count : 0),
    0
  );
  const dateDiff = Math.abs(end - start);
  const weeks = dateDiff / (1000 * 60 * 60 * 24 * 7);
  const avgPostsPerWeek = filteredPosts.length / weeks;
  console.log(
    "Views count: " +
      totalViews +
      "\n" +
      "Likes count: " +
      totalLikes +
      "\n" +
      "Per week" +
      avgPostsPerWeek +
      " " +
      weeks +
      " " +
      filteredPosts.length
  );
  return { filteredPosts, totalLikes, totalViews, avgPostsPerWeek };
}

//telegram

ipcMain.handle("access_phone", async (event, phoneNumber) => {
  const api_id = 29974513;
  const api_hash = "0f843f086acdbf04af970bf4ab305768";

  const mtproto = new MTProto({
    api_id: api_id,
    api_hash: api_hash,
    storageOptions: {
      path: path.resolve(__dirname, "session.json"),
    },
  });
  try {
    const result = await mtproto.call("auth.sendCode", {
      phone_number: phoneNumber,
      settings: {
        _: "codeSettings",
      },
    });
    return result.phone_code_hash;
  } catch (e) {
    throw e;
  }
});

ipcMain.handle(
  "access_code",
  async (event, { phoneNumber, phoneCodeHash, code }) => {
    const api_id = 29974513;
    const api_hash = "0f843f086acdbf04af970bf4ab305768";

    const mtproto = new MTProto({
      api_id: api_id,
      api_hash: api_hash,
      storageOptions: {
        path: path.resolve(__dirname, "session.json"),
      },
    });
    try {
      const result = await mtproto.call("auth.signIn", {
        phone_number: phoneNumber,
        phone_code_hash: phoneCodeHash,
        phone_code: code,
      });
      return result;
    } catch (e) {
      throw e;
    }
  }
);

async function analyzeTelegram(url, startDate, endDate) {
  const api_id = 29974513;
  const api_hash = "0f843f086acdbf04af970bf4ab305768";
  const channelUsername = extractChannelUsername(url);
  console.log(channelUsername);
  const mtproto = new MTProto({
    api_id: api_id,
    api_hash: api_hash,
    storageOptions: {
      path: path.resolve(__dirname, "session.json"),
    },
  });
  console.log("Method call is a", typeof mtproto.call);

  try {
    const channelInfo = await mtproto.call("contacts.resolveUsername", {
      username: channelUsername,
    });
    console.log(channelInfo);
  } catch (error) {
    console.error("Invalid query:", error);
    throw error;
  }
}

async function extractGroupId(url, token, apiVersion) {
  const match = url.match(/vk\.com\/(?:public|club)(\d+)/);
  if (match) {
    return match[1];
  }
  const groupNameMatch = url.match(/vk\.com\/(.+)/);
  const groupName = groupNameMatch ? groupNameMatch[1] : null;
  if (!groupName) {
    throw new Error("Invalid group URL");
  }
  const response = await axios.get("https://api.vk.com/method/groups.getById", {
    params: {
      group_id: groupName,
      access_token: token,
      v: apiVersion,
    },
  });
  const groupId = response.data.response[0].id;
  return groupId;
}

function extractChannelUsername(url) {
  const regex = /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
