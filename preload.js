const { contextBridge, ipcRenderer } = require("electron");

console.log("preload script executed");

contextBridge.exposeInMainWorld("electronAPI", {
  update_config: (data) => ipcRenderer.invoke('update_config', data),
  onUserStatus: (callback) => ipcRenderer.on('user-status', callback),
  analyze: (data) => ipcRenderer.invoke("analyze", data),
});
