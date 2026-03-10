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

let results = [];
let selectedIndex = 0;
let editorOpen = false;
let editingId = null; // null => creating new

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
        ${r.tags ? `<div class="tags">${escapeHtml(r.tags)}</div>` : ""}
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

// UI events
searchEl.addEventListener("input", refresh);
newBtn.addEventListener("click", openEditorNew);
saveBtn.addEventListener("click", saveSnippet);
cancelBtn.addEventListener("click", closeEditor);
deleteBtn.addEventListener("click", deleteSelectedSnippet);

document.addEventListener("keydown", async (e) => {

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

  // Enter copies
  if (e.key === "Enter") {
    e.preventDefault();
    await copySelected();
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

  // Cmd/Ctrl+Q quit (recommended since Dock hidden)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "q") {
    e.preventDefault();
    if (window.api.quit) await window.api.quit();
  }
});

window.api.onFocusSearch(() => {
  searchEl.focus();
  searchEl.select();
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
})();
