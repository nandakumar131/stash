# Stash

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-black?logo=apple" />
  <img src="https://img.shields.io/badge/electron-app-blue?logo=electron" />
  <img src="https://img.shields.io/badge/license-Apache%202.0-green" />
  <img src="https://img.shields.io/github/stars/nandakumar131/stash?style=social" />
</p>

> ⚡ A keyboard-first snippet & clipboard launcher for macOS developers.

Stash is a lightweight, global hotkey-powered productivity tool built for developers who live in the terminal and editor. Instantly search, generate, copy, and paste commands or code snippets — plus browse your clipboard history — without leaving your flow.

---
## Features

### 🚀 Global Launcher

- Open anywhere with a global hotkey (default: Alt + Space)
- Dock-hidden, distraction-free workflow
- Fast Spotlight-style popup window
---

### 🧩 Snippet Variables (Templates)

Create dynamic snippets like:

```bash
kubectl logs {pod} -n {namespace=default}
```

On execution, Stash prompts you to fill in variables before copying or pasting.
---

### 📋 Clipboard History (Optional)

- Track recent clipboard entries
- Token-based keyword search
- De-duplicated history
- Switch between snippets and clipboard using `Tab`
---

### 🔍 Simple Keyword Search

- Deterministic tokenized search (AND logic)
- Fast and predictable

### ⚙️ Preferences

- Configure global hotkey
- Enable/disable clipboard history
- Built-in settings architecture

Open Preferences via:

- ⚙️ icon
- Cmd + ,

### ⌨️ Keyboard-First Navigation

| Shortcut       | Action                      |
| -------------- | --------------------------- |
| `Alt + Space`  | Open Stash                  |
| `Tab`          | Toggle Snippets / Clipboard |
| `↑ / ↓`        | Navigate                    |
| `Ctrl + j`     | Next item                   |
| `Ctrl + l`     | Previous item               |
| `Enter`        | Copy                        |
| `Cmd + Enter`  | Copy & Paste                |
| `Cmd + E`      | Edit snippet                |
| `Cmd + N`      | New snippet                 |
| `Cmd + Delete` | Delete snippet              |
| `Esc`          | Close                       |
| `Cmd + Q`      | Quit                        |
---

### 🧠 Philosophy

- Stash is designed to:
- Minimize context switching
- Stay invisible until needed
- Avoid unnecessary complexity
- Be easy to debug and maintain
- Prioritize developer workflows
---

### 🛠 Tech Stack

- Electron
- SQLite (better-sqlite3)
- Plain keyword search
- macOS-native clipboard + Accessibility integration

### 📦 Installation
#### Development

```bash
git clone https://github.com/yourusername/stash.git
cd stash
npm install
npm run dev
```

#### Build DMG
```bash
npm run dist
```
The generated DMG will be available in:
```bash
/dist
```
---
### 📁 Data Storage

Stash stores data locally at:
```bash
~/Library/Application Support/Stash/
```

#### Contents:

- snippets.sqlite
- settings.json
---

### 🔐 Permissions

For auto-paste functionality:
- Go to System Settings → Privacy & Security → Accessibility
- Enable Stash
---

### 🗺 Roadmap Ideas
- Usage-based ranking
- Snippet aliases
- Per-app snippet scope
- Terminal auto-run mode
- Pinned snippets
- Export/import support
- Fuzzy search
---

### 🧪 Known Limitations

- Clipboard monitoring uses interval polling (no system hook)
- macOS only
- No cross-device sync (yet)
---

### 🤝 Contributing

PRs and ideas are welcome.<br>
Open an issue if you:
- Find a bug
- Want to propose a feature
- Have UX improvement suggestions
---

### 📜 License
Apache License 2.0
---

### 💡 Why Stash?

Because your brain shouldn't have to remember:
- The exact kubectl flags
- That one docker command
- A complex SQL query
- Or the curl command you copied 10 minutes ago

Stash remembers it so you don’t have to.
