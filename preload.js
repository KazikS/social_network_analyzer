const { contextBridge, ipcRenderer } = require('electron');

console.log('preload script executed')

contextBridge.exposeInMainWorld('electronAPI', {
    analyze: (data) => ipcRenderer.invoke('analyze', data)
});
