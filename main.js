const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const axios = require("axios");
const MTProto = require("@mtproto/core");
const { sign } = require("node:crypto");

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

const api_id = 29974513;
const api_hash = "0f843f086acdbf04af970bf4ab305768";
const mtproto = new MTProto({
  api_id: api_id,
  api_hash: api_hash,
  storageOptions: {
    path: path.resolve(__dirname, "session.json"),
  },
});

async function getUser() {
  try {
    const user = await mtproto.call("users.getFullUser", {
      id: {
        _: "inputUserSelf",
      },
    });

    return user;
  } catch (error) {
    return null;
  }
}

function sendCode(phone) {
  return mtproto.call("auth.sendCode", {
    phone_number: phone,
    settings: {
      _: "codeSettings",
    },
  });
}

function signIn({ code, phone, phone_code_hash }) {
  return mtproto.call('auth.signIn', {
    phone_code: code,
    phone_number: phone,
    phone_code_hash: phone_code_hash,
  });
}

function signUp({ phone, phone_code_hash }) {
  return mtproto.call('auth.signUp', {
    phone_number: phone,
    phone_code_hash: phone_code_hash,
    first_name: 'MTProto',
    last_name: 'Core',
  });
}

function getPassword() {
  return mtproto.call('account.getPassword');
}

function checkPassword({ srp_id, A, M1 }) {
  return mtproto.call('auth.checkPassword', {
    password: {
      _: 'inputCheckPasswordSRP',
      srp_id,
      A,
      M1,
    },
  });
}

ipcMain.handle("auth_tg", async (event, { phone, code, password }) => {
  const user = await getUser();
  if(!user){
    const {phone_code_hash} = await sendCode(phone);
    try {
      const signInResult = await signIn({
        code,
        phone,
        phone_code_hash,
      });
      if(signInResult._ === 'auth.authorizationSignUpRequired'){
        await signUp({
          phone, 
          phone_code_hash,
        });
      }
    }catch(error){
      if(error.error_message !== 'SESSION_PASSWORD_NEEDED'){
        console.log(`error:`, error);
        return;
      }
      const {srp_id, current_algo, srp_B} = await getPassword();
      const { g, p, salt1, salt2 } = current_algo;
      const { A, M1 } = await mtproto.mtproto.crypto.getSRPParams({
        g,
        p,
        salt1,
        salt2,
        gB: srp_B,
        password,
      });

      const checkPasswordResult = await checkPassword({srp_id, A, M1});
    }
  }
});

async function analyzeTelegram(url, startDate, endDate) {
  const channelUsername = extractChannelUsername(url);
  console.log(channelUsername);

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
