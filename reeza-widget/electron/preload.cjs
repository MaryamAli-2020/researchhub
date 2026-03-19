const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopWidget", {
  pickAvatar: () => ipcRenderer.invoke("widget:pick-avatar"),
  getSettings: () => ipcRenderer.invoke("widget:get-settings"),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke("widget:set-launch-at-login", enabled),
  hide: () => ipcRenderer.invoke("widget:hide"),
});
