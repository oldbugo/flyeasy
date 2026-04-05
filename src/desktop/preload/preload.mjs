import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("flyeasyDesktop", {
  quitApp: () => ipcRenderer.invoke("flyeasy:quit-app"),
  runtime: "electron"
});
