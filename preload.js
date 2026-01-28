const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  search: (q) => ipcRenderer.invoke("snippets:search", q),
  recent: () => ipcRenderer.invoke("snippets:recent"),

  create: (payload) => ipcRenderer.invoke("snippets:create", payload),
  update: (payload) => ipcRenderer.invoke("snippets:update", payload),
  delete: (id) => ipcRenderer.invoke("snippets:delete", id),

  copy: (text) => ipcRenderer.invoke("clipboard:copy", text),

  hide: () => ipcRenderer.invoke("ui:hide"),

  onFocusSearch: (cb) => ipcRenderer.on("focus-search", cb),
  
  quit: () => ipcRenderer.invoke("app:quit")

});
