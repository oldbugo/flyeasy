const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flyeasyDesktop", {
  quitApp: () => ipcRenderer.invoke("flyeasy:quit-app"),
  captureUi: () => ipcRenderer.invoke("flyeasy:capture-ui"),
  runtime: "electron"
});
