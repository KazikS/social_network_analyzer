const { contextBridge, ipcRenderer } = require("electron");

console.log("preload script executed");

contextBridge.exposeInMainWorld("electronAPI", {
  analyze: (data) => ipcRenderer.invoke("analyze", data),
  auth_tg: (data) => ipcRenderer.invoke("auth_tg", data),
});
