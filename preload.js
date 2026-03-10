const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  search: (q) => ipcRenderer.invoke("snippets:search", q),
  recent: () => ipcRenderer.invoke("snippets:recent"),
  create: (payload) => ipcRenderer.invoke("snippets:create", payload),
  update: (payload) => ipcRenderer.invoke("snippets:update", payload),
  delete: (id) => ipcRenderer.invoke("snippets:delete", id),
  copy: (text) => ipcRenderer.invoke("clipboard:copy", text),
  copyAndPaste: (text) => ipcRenderer.invoke("clipboard:copyAndPaste", text),
  hide: () => ipcRenderer.invoke("ui:hide"),
  onFocusSearch: (cb) => ipcRenderer.on("focus-search", cb),
  quit: () => ipcRenderer.invoke("app:quit"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (next) => ipcRenderer.invoke("settings:set", next),
  openPrefs: () => ipcRenderer.invoke("prefs:open"),
  closePrefs: () => ipcRenderer.invoke("prefs:close"),
  clipboardHistoryList: (limit) => ipcRenderer.invoke("clipboardHistory:list", limit),
  clipboardHistorySearch: (q, limit) => ipcRenderer.invoke("clipboardHistory:search", q, limit),
  searchPlainSnippets: (q, limit = 50) => ipcRenderer.invoke("search:plain:snippets", q, limit),
  searchPlainClipboard: (q, limit = 100) => ipcRenderer.invoke("search:plain:clipboard", q, limit)
});
