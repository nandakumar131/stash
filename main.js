
const { execFileSync } = require("child_process");
const isMac = process.platform === "darwin";
const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, screen } = require("electron");
const path = require("path");
const { openDb, makeRepo } = require("./db");
const iconPath = path.join(__dirname, "assets", "icon.icns");

let win;
let repo;

let lastFrontAppBundleId = null;

function getFrontmostAppBundleId() {
  if (process.platform !== "darwin") return null;

  try {
    // Returns bundle id of the frontmost app, e.g. "com.apple.Terminal"
    const out = execFileSync("osascript", [
      "-e",
      'tell application "System Events" to get bundle identifier of first application process whose frontmost is true'
    ], { encoding: "utf8" });

    return out.trim() || null;
  } catch (e) {
    console.error("Failed to get frontmost app bundle id:", e.message);
    return null;
  }
}

function activateAppByBundleId(bundleId) {
  if (process.platform !== "darwin") return;
  if (!bundleId) return;

  try {
    execFileSync("osascript", [
      "-e",
      `tell application id "${bundleId}" to activate`
    ], { encoding: "utf8" });
  } catch (e) {
    console.error("Failed to activate app:", e.message);
  }
}

function pasteViaCommandV() {
  if (process.platform !== "darwin") return;

  // System Events keystroke Cmd+V
  // Note: this may trigger Automation/Accessibility permission prompts.
  execFileSync("osascript", [
    "-e",
    'tell application "System Events" to keystroke "v" using command down'
  ], { encoding: "utf8" });
}

function createWindow() {
  win = new BrowserWindow({
    width: 720,
    height: 420,
    show: false,
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: true,
    fullscreenable: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile("index.html");

  win.on("blur", () => {
    // Spotlight-like: hide when focus is lost
    if (win && win.isVisible()) win.hide();
  });
}

function centerWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const x = Math.round((width - 720) / 2);
  const y = Math.round((height - 420) / 5); // slightly higher than center
  win.setPosition(x, y, false);
}

function toggleWindow() {
  if (!win) return;

  if (win.isVisible()) {
    win.hide();
  } else {
    // Capture what was frontmost BEFORE we activate our window
    lastFrontAppBundleId = getFrontmostAppBundleId();

    centerWindow();
    win.show();
    app.focus({ steal: true });
    win.focus();
    win.webContents.send("focus-search");
  }
}


app.whenReady().then(() => {
  if (isMac && app.dock) {
    app.dock.hide();
  }

  const db = openDb();
  repo = makeRepo(db);

  createWindow();

  // Global shortcut Option+Space
  const ok = globalShortcut.register("Alt+Space", toggleWindow);
  if (!ok) console.error("Failed to register global shortcut Alt+Space");

  // IPC: search
  ipcMain.handle("snippets:search", (_evt, query) => repo.search(query, 50));
  ipcMain.handle("snippets:recent", () => repo.recent(50));

  // IPC: CRUD
  ipcMain.handle("snippets:create", (_evt, payload) => repo.create(payload));
  ipcMain.handle("snippets:update", (_evt, payload) => repo.update(payload));
  ipcMain.handle("snippets:delete", (_evt, id) => repo.delete(id));

  // Clipboard
ipcMain.handle("clipboard:copy", (_evt, text) => {
  clipboard.writeText(String(text ?? ""));

  // Hide our window first
  if (win) win.hide();

  // Then return focus to the previous app (tiny delay avoids race)
  setTimeout(() => {
    activateAppByBundleId(lastFrontAppBundleId);
  }, 50);

  return true;
});

ipcMain.handle("clipboard:copyAndPaste", (_evt, text) => {
  clipboard.writeText(String(text ?? ""));

  // Hide Stash window
  if (win) win.hide();

  // Return focus to the previous app, then paste
  setTimeout(() => {
    activateAppByBundleId(lastFrontAppBundleId);

    // tiny delay to let focus settle
    setTimeout(() => {
      try {
        pasteViaCommandV();
      } catch (e) {
        console.error("Auto-paste failed:", e.message);
        // Optional: show a user-friendly message
        // dialog.showMessageBox({ type: "info", message: "Enable Accessibility permission to allow auto-paste." })
      }
    }, 80);
  }, 50);

  return true;
});


  // Window control
  ipcMain.handle("ui:hide", () => {
    if (win) win.hide();
    return true;
  });

  ipcMain.handle("app:quit", () => {
    app.quit();
    return true;
  });


  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", (e) => {
  // Background app: keep running for global shortcut
  e.preventDefault();
});
