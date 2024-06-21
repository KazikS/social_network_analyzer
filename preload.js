const { contextBridge, ipcRenderer } = require("electron");

console.log("preload script executed");

contextBridge.exposeInMainWorld("electronAPI", {
  analyze: (data) => ipcRenderer.invoke("analyze", data),
  access_phone: (phoneNumber) => ipcRenderer.invoke("access_phone", phoneNumber),
  access_code: (data) => ipcRenderer.invoke("access_code", data),
});
