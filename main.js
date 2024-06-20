const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const axios = require("axios");
const { group } = require("node:console");
const { access } = require("node:fs");

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


async function analyzeVK(url, startDate, endDate) {
  const token =
    "7554f5227554f5227554f52203764c3153775547554f522132675fa2997f7d1e937998d"; 
  const apiVersion = "5.131";
  const groupId = await extractGroupId(url, token, apiVersion);
  let offset = 0;
  let count = 100;
  let allPosts = [];
  let hasMorePosts = true;
  let likes = 0;
  console.log(groupId);
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




async function analyzeTg(){
  
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
    const response = await axios.get(
      "https://api.vk.com/method/groups.getById",
      {
        params: {
          group_id: groupName,
          access_token: token,
          v: apiVersion
        },
      }
    );
    const groupId = response.data.response[0].id
    return groupId;
}
