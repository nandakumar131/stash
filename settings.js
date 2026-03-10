const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const DEFAULTS = {
  hotkey: "Alt+Space",
  autoPasteOnCmdEnter: true,
  clipboardHistoryEnabled: false,
  clipboardMaxItems: 200
};

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings() {
  try {
    const p = settingsPath();
    if (!fs.existsSync(p)) return { ...DEFAULTS };
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    return { ...DEFAULTS, ...(data || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(next) {
  const p = settingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(next, null, 2), "utf8");
}

module.exports = { DEFAULTS, loadSettings, saveSettings };