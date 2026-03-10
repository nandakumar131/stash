const hotkeyEl = document.getElementById("hotkey");
const clipEl = document.getElementById("clipboardHistoryEnabled");
const saveBtn = document.getElementById("saveBtn");
const closeBtn = document.getElementById("closeBtn");
const hintEl = document.getElementById("hint");

async function load() {
  const s = await window.api.getSettings();
  hotkeyEl.value = s.hotkey || "Alt+Space";
  clipEl.checked = !!s.clipboardHistoryEnabled;
}

async function save() {
  const next = {
    hotkey: hotkeyEl.value.trim() || "Alt+Space",
    clipboardHistoryEnabled: clipEl.checked
  };

  const res = await window.api.setSettings(next);
  hintEl.textContent = res.ok ? "Saved." : `Failed: ${res.error || "unknown"}`;
  if (res.ok) setTimeout(() => (hintEl.textContent = ""), 1200);
}

saveBtn.addEventListener("click", save);
closeBtn.addEventListener("click", () => window.api.closePrefs());

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.api.closePrefs();
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
});

load();