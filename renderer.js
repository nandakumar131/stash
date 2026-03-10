const $ = (id) => document.getElementById(id);

const searchEl = $("search");
const listEl = $("list");
const editorEl = $("editor");

const editorTitleEl = $("editorTitle");
const titleEl = $("title");
const bodyEl = $("body");
const tagsEl = $("tags");

const newBtn = $("newBtn");
const saveBtn = $("saveBtn");
const cancelBtn = $("cancelBtn");
const deleteBtn = $("deleteBtn");

const varOverlay = document.getElementById("varOverlay");
const varFields = document.getElementById("varFields");
const varCancel = document.getElementById("varCancel");
const varOk = document.getElementById("varOk");
const prefsBtn = document.getElementById("prefsBtn");

let pendingTemplate = null;
let pendingPasteMode = null; // "copy" | "paste"
let varInputs = [];

let results = [];
let selectedIndex = 0;
let editorOpen = false;
let editingId = null;

const modeBadge = document.getElementById("modeBadge");

// searchMode: "snippets" | "clipboard"
let searchMode = "snippets";

function setSearchMode(mode) {
  searchMode = mode === "clipboard" ? "clipboard" : "snippets";
  modeBadge.textContent = searchMode === "clipboard" ? "Clipboard" : "Snippets";
  searchEl.placeholder = searchMode === "clipboard" ? "Search clipboard…" : "Search snippets…";
  // refresh results for the current query in the new mode
  refresh();
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function getSelected() {
  return results[selectedIndex] || null;
}

function renderList() {
  listEl.innerHTML = results.map((r, idx) => {
    const cls = idx === selectedIndex ? "item selected" : "item";
    return `
      <div class="${cls}" data-idx="${idx}">
        <div class="title">${escapeHtml(r.title || "(Untitled)")}</div>
        <div class="body">${escapeHtml(r.body || "")}</div>
        ${r.isClipboard ? `<div class="tags">clipboard • ${new Date(r.createdAt).toLocaleString()}</div>` : 
          (r.tags ? `<div class="tags">${escapeHtml(r.tags)}</div>` : "")}
      </div>
    `;
  }).join("");

  listEl.querySelectorAll(".item").forEach((el) => {
    el.addEventListener("click", () => {
      selectedIndex = Number(el.dataset.idx);
      renderList();
    });
    el.addEventListener("dblclick", async () => {
      // keep your original behavior: double click copies
      await copySelected();
    });
  });
}

async function refresh() {
  const raw = (searchEl.value || "").trim();

  if (searchMode === "clipboard") {
    // clipboard mode: if empty, list recent; otherwise search
    if (!raw) {
      const items = await window.api.clipboardHistoryList(200);
      results = items.map(it => ({
        id: it.id,
        title: it.text.length > 80 ? it.text.slice(0, 77) + "…" : it.text,
        body: it.text,
        tags: "",
        createdAt: it.createdAt,
        isClipboard: true
      }));
    } else {
      const items = await window.api.clipboardHistorySearch(raw, 200);
      results = items.map(it => ({
        id: it.id,
        title: it.text.length > 80 ? it.text.slice(0, 77) + "…" : it.text,
        body: it.text,
        tags: "",
        createdAt: it.createdAt,
        isClipboard: true
      }));
    }

    selectedIndex = Math.min(selectedIndex, Math.max(results.length - 1, 0));
    renderList();
    return;
  }

  // default: snippets mode 
  results = await window.api.search(searchEl.value);
  selectedIndex = Math.min(selectedIndex, Math.max(results.length - 1, 0));
  renderList();
}

async function copySelected() {
  const picked = getSelected();
  if (!picked) return;
  await window.api.copy(picked.body || "");
  await window.api.hide();
}

function openEditorNew() {
  editorOpen = true;
  editingId = null;

  editorTitleEl.textContent = "New Snippet";
  deleteBtn.style.display = "none";

  editorEl.classList.add("show");
  titleEl.value = "";
  bodyEl.value = "";
  tagsEl.value = "";

  titleEl.focus();
}

function openEditorEdit(snippet) {
  if (!snippet) return;

  editorOpen = true;
  editingId = snippet.id;

  editorTitleEl.textContent = "Edit Snippet";
  deleteBtn.style.display = "inline-block";

  editorEl.classList.add("show");
  titleEl.value = snippet.title || "";
  bodyEl.value = snippet.body || "";
  tagsEl.value = snippet.tags || "";

  titleEl.focus();
}

function closeEditor() {
  editorOpen = false;
  editingId = null;
  editorEl.classList.remove("show");
  searchEl.focus();
}

async function saveSnippet() {
  const title = titleEl.value;
  const body = bodyEl.value;
  const tags = tagsEl.value;

  if (!String(body).trim()) return;

  if (editingId) {
    await window.api.update({ id: editingId, title, body, tags });
  } else {
    await window.api.create({ title, body, tags });
  }

  closeEditor();
  await refresh();
}

async function deleteSelectedSnippet() {
  const picked = editingId ? results.find(r => r.id === editingId) : getSelected();
  if (!picked) return;

  const ok = confirm(`Delete "${picked.title || "(Untitled)"}"?`);
  if (!ok) return;

  await window.api.delete(picked.id);

  // After delete, refresh list + close editor if open
  await refresh();
  closeEditor();
}

function moveSelection(delta) {
  if (!results.length) return;
  selectedIndex = Math.max(0, Math.min(results.length - 1, selectedIndex + delta));
  renderList();
  const sel = listEl.querySelector(".item.selected");
  if (sel) sel.scrollIntoView({ block: "nearest" });
}


function isTypingInTextField() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}

function extractVariables(text) {
  const re = /\{([a-zA-Z0-9_]+)(=([^}]*))?\}/g;
  const vars = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    const def = m[3] ?? "";
    if (!seen.has(name)) {
      seen.add(name);
      vars.push({ name, def });
    }
  }
  return vars;
}

function applyVariables(text, values) {
  const re = /\{([a-zA-Z0-9_]+)(=([^}]*))?\}/g;
  return text.replace(re, (_full, name, _eq, def) => {
    const v = values[name];
    if (v != null && String(v).length > 0) return String(v);
    return def ?? "";
  });
}

function openVarOverlay(vars, templateText, pasteMode) {
  pendingTemplate = templateText;
  pendingPasteMode = pasteMode;

  varFields.innerHTML = "";
  varInputs = [];

  for (const v of vars) {
    const row = document.createElement("div");
    row.className = "varRow";

    const label = document.createElement("div");
    label.className = "varLabel";
    label.textContent = v.name;

    const input = document.createElement("input");
    input.className = "varInput";
    input.value = v.def || "";
    input.setAttribute("data-var", v.name);

    row.appendChild(label);
    row.appendChild(input);
    varFields.appendChild(row);
    varInputs.push(input);
  }

  varOverlay.classList.add("show");
  setTimeout(() => varInputs[0]?.focus(), 0);
}

function closeVarOverlay() {
  varOverlay.classList.remove("show");
  pendingTemplate = null;
  pendingPasteMode = null;
  searchEl.focus();
}

async function commitVarOverlay() {
  if (!pendingTemplate) return;

  const values = {};
  for (const input of varInputs) {
    values[input.dataset.var] = input.value;
  }

  const expanded = applyVariables(pendingTemplate, values);

  // Now perform action
  if (pendingPasteMode === "paste") {
    await window.api.copyAndPaste(expanded);
  } else {
    await window.api.copy(expanded);
    await window.api.hide();
  }

  closeVarOverlay();
}


varCancel.addEventListener("click", closeVarOverlay);
varOk.addEventListener("click", commitVarOverlay);

// UI events
searchEl.addEventListener("input", refresh);
newBtn.addEventListener("click", openEditorNew);
saveBtn.addEventListener("click", saveSnippet);
cancelBtn.addEventListener("click", closeEditor);
deleteBtn.addEventListener("click", deleteSelectedSnippet);
prefsBtn.addEventListener("click", () => window.api.openPrefs());

document.addEventListener("keydown", async (e) => {

  // If variable overlay is open, it owns Enter/Esc
  if (varOverlay.classList.contains("show")) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeVarOverlay();
    } else if (e.key === "Enter") {
      e.preventDefault();
      await commitVarOverlay();
    }
    return;
  }

  // If variable overlay is open, let it handle Tab normally
  if (varOverlay && varOverlay.classList.contains("show")) {
    // let overlay handle tab to move between inputs
    // (your overlay key handler already handles Enter/Escape)
  } else {
    // Toggle search mode when Tab (or Shift+Tab) pressed while search input is focused.
    if (e.key === "Tab" && document.activeElement === searchEl) {
      e.preventDefault();
      const next = e.shiftKey ? "snippets" : (searchMode === "snippets" ? "clipboard" : "snippets");
      setSearchMode(next);
      return;
    }
  }


  // If user is typing in an input/textarea, do NOT hijack Backspace/Delete.
  // This fixes "can't delete in search bar".
  if (isTypingInTextField() && (e.key === "Backspace" || e.key === "Delete")) {
    return;
  }

  // ESC
  if (e.key === "Escape") {
    if (editorOpen) closeEditor();
    else await window.api.hide();
    return;
  }

  // Editor shortcuts
  if (editorOpen) {
    // Cmd/Ctrl+Enter saves
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      await saveSnippet();
    }
    
    // Cmd+Delete / Cmd+Backspace deletes selected snippet
    if (
      (e.key === "Backspace" || e.key === "Delete") &&
      e.metaKey &&
      !isTypingInTextField()
    ) {
      e.preventDefault();
      const picked = getSelected();
      if (picked) {
        editingId = picked.id;
        await deleteSelectedSnippet();
      }
    }
    return;
  }

  // List navigation
  if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(+1); }
  if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1); }

 if (e.key === "Enter") {
  e.preventDefault();

  const picked = getSelected();
  if (!picked) return;

  const body = picked.body || "";
  const mode = e.metaKey ? "paste" : "copy"; // ⌘Enter paste, Enter copy

  if (!picked.isClipboard) {
    const vars = extractVariables(body);
    if (vars.length > 0) {
      openVarOverlay(vars, body, mode);
      return;
    }
  }

  if (mode === "paste") {
    await window.api.copyAndPaste(body);
  } else {
    await window.api.copy(body);
    await window.api.hide();
  }
}


  // Cmd/Ctrl+N new snippet
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
    e.preventDefault();
    openEditorNew();
  }

  // Cmd/Ctrl+E edit selected
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
    e.preventDefault();
    openEditorEdit(getSelected());
  }

  // Delete/Backspace deletes selected (confirm)
  if (e.key === "Backspace" || e.key === "Delete") {
    e.preventDefault();
    const picked = getSelected();
    if (picked) {
      // set editingId temporarily so delete uses same path
      editingId = picked.id;
      await deleteSelectedSnippet();
    }
  }

  if ((e.metaKey || e.ctrlKey) && e.key === ",") {
    e.preventDefault();
    window.api.openPrefs();
  }

  // Cmd/Ctrl+Q quit (recommended since Dock hidden)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "q") {
    e.preventDefault();
    if (window.api.quit) await window.api.quit();
  }
});

window.api.onFocusSearch(() => {
  searchEl.focus();
  searchEl.select();
  refresh();
});

// If you implemented tray menu "open-editor" earlier, keep this:
if (window.api.onOpenEditor) {
  window.api.onOpenEditor(() => openEditorNew());
}

// Initial load
(async function init() {
  results = await window.api.recent();
  selectedIndex = 0;
  renderList();
  searchEl.focus();
  setSearchMode("snippets");
})();
