const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const axios = require("axios");
const api = require("./telegram/tgApi");
const auth = require("./telegram/auth");
const getUser = require("./telegram/getUser");

let win;

const createWindow = () => {
  win = new BrowserWindow({
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
  checkUserStatus();
};

async function checkUserStatus() {
  const user = await getUser();
  console.log(user);
  win.webContents.send("user-status", user);
}

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
    return postDate >= start && postDate <= end;
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

ipcMain.handle("update_config", async (event, data) => {
  console.log(data);
  auth(data.phone, data.code, data.password);

});


async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeTelegram(url, startDate, endDate) {
  const channelUsername = extractChannelUsername(url);
  let allMessages = [];
  let offsetId = 0;
  let hasMoreMessages = true;

  try {
    const channelInfo = await api.call("contacts.resolveUsername", {
      username: channelUsername,
    });
    const channelId = channelInfo.chats[0].id;
    const accessHash = channelInfo.chats[0].access_hash;

    while (hasMoreMessages) {
      console.log(`Fetching messages with offset_id: ${offsetId}`);
      try {
        const messages = await api.call("messages.getHistory", {
          peer: {
            _: "inputPeerChannel",
            channel_id: channelId,
            access_hash: accessHash,
          },
          offset_id: offsetId,
          offset_date: 0,
          add_offset: 0,
          limit: 100,
          max_id: 0,
          min_id: 0,
          hash: 0,
        });

        if (messages.messages.length === 0) {
          console.log("No more messages to fetch");
          hasMoreMessages = false;
        } else {
          allMessages = allMessages.concat(messages.messages);
          offsetId = messages.messages[messages.messages.length - 1].id;
          console.log(
            `Fetched ${messages.messages.length} messages, next offset_id: ${offsetId}`
          );
        }
      } catch (error) {
        if (error.error_code === 420) {
          const waitTime =
            parseInt(error.error_message.split("_").pop(), 10) * 1000;
          console.log(`Flood wait detected, waiting for ${waitTime} ms`);
          await delay(waitTime);
        } else {
          throw error;
        }
      }
    }

    console.log("All messages:", allMessages);

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const filteredMessages = allMessages.filter((msg) => {
      const msgDate = new Date(msg.date * 1000);
      return msgDate >= start && msgDate <= end;
    });

    console.log("Filtered messages:", filteredMessages);

    let totalMessages = filteredMessages.length;
    let totalViews = 0;
    let totalReactions = 0;

    filteredMessages.forEach((msg) => {
      if (msg.views) totalViews += msg.views;
      if (msg.reactions && msg.reactions.results) {
        totalReactions += msg.reactions.results.length;
      }
    });

    const dateDiff = Math.abs(end - start);
    const weeks = dateDiff / (1000 * 60 * 60 * 24 * 7);
    const avgPostsPerWeek = filteredMessages.length / weeks;
    return { totalMessages, totalReactions, totalViews, avgPostsPerWeek };
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
