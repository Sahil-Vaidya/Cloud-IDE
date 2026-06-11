# ⚡ Cloud IDE — Browser-Based Full-Stack Development Environment

A powerful, browser-based IDE that lets users write, run, and manage full-stack Python projects (Django, Flask, FastAPI) directly in the browser — complete with an interactive terminal, live log streaming, SQLite database viewer, and app preview panel.

![Cloud IDE](https://img.shields.io/badge/Cloud%20IDE-v1.0-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python)

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Frontend Components](#-frontend-components)
- [Database Viewer](#-database-viewer)
- [Terminal & Logs](#-terminal--logs)
- [Extensibility](#-extensibility)
- [Security](#-security)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Features

### Core Features (MVP)

| Feature | Description |
|---------|-------------|
| **📂 Project Workspace** | Create, open, or clone GitHub projects with Django/Flask/FastAPI/blank templates |
| **🌳 File Explorer** | Navigable file tree with folder expand/collapse, context menus (new file/folder/delete), and file type icons |
| **✏️ Code Editor** | Monaco Editor (VS Code engine) with syntax highlighting for 50+ languages, multi-tab support, auto-save (Ctrl+S) |
| **▶️ Runtime/Execution** | Start/stop/restart server processes with auto-detection of Django, Flask, or FastAPI frameworks |
| **📟 Interactive Terminal** | Full interactive terminal (xterm.js) connected via WebSocket to a real shell session |
| **📊 Live Logs** | Real-time stdout/stderr streaming with color-coded log levels (error/warning/success) |
| **🗃️ Database Viewer** | Browse SQLite databases, inspect table schemas, paginated row browsing, and read-only SQL query runner |
| **👁️ Preview Panel** | Live iframe preview of running app with responsive device toggles (desktop/tablet/mobile) |

### Design & UX

- 🌑 **Dark glassmorphism theme** with cyan/purple accent gradients
- ✨ **Micro-animations** — smooth transitions, hover effects, pulse indicators
- 📐 **Resizable panels** — drag to resize bottom panel height
- 🎨 **Custom design system** — CSS variables for full theming control
- 📱 **Responsive layout** — adapts to different screen sizes

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  ┌──────┬──────────────────────┬───────────────────────────┐ │
│  │      │  Monaco Editor       │  Preview / DB Viewer      │ │
│  │ File │  (multi-tab)         │  (toggle right panel)     │ │
│  │ Tree │                      │                           │ │
│  │      ├──────────────────────┤                           │ │
│  │      │  Terminal / Logs     │                           │ │
│  └──────┴──────────────────────┴───────────────────────────┘ │
│                 ↕ HTTP REST + WebSocket ↕                    │
├─────────────────────────────────────────────────────────────┤
│                   Backend (FastAPI)                          │
│  ┌────────────┬────────────┬──────────┬──────────────────┐  │
│  │ File API   │ Process    │ Database │ WebSocket        │  │
│  │ /api/files │ /api/proc  │ /api/db  │ /ws/terminal     │  │
│  │            │            │          │ /ws/logs          │  │
│  └────────────┴────────────┴──────────┴──────────────────┘  │
│                         ↕                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Workspace Files (Disk)                   │   │
│  │              SQLite Databases                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite | SPA framework with fast HMR |
| **Code Editor** | Monaco Editor (`@monaco-editor/react`) | VS Code-grade editing |
| **Terminal** | xterm.js (`@xterm/xterm`) | Browser terminal emulator |
| **Styling** | Vanilla CSS + CSS Variables | Full design control, dark theme |
| **Icons** | react-icons (VSC set) | VS Code-style icons |
| **Backend** | FastAPI (Python) | Async REST API + WebSocket |
| **WebSocket** | FastAPI WebSocket | Terminal PTY + log streaming |
| **Database** | SQLite3 (Python stdlib) | Zero-config database viewer |

---

## 🏁 Getting Started

### Prerequisites

- **Python 3.10+** with pip
- **Node.js 18+** with npm
- **Git** (for clone feature)

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd "Yuvro Assesment"

# 2. Install backend dependencies
cd backend
pip install -r requirements.txt

# 3. Install frontend dependencies
cd ../frontend
npm install
```

### Running the Application

You need two terminal windows:

**Terminal 1 — Backend (FastAPI):**
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend (Vite):**
```bash
cd frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

> 💡 The Vite dev server proxies `/api` and `/ws` requests to the backend on port 8000 automatically.

---

## 📁 Project Structure

```
Yuvro Assesment/
│
├── backend/                        # FastAPI Backend Server
│   ├── main.py                     # App entry point, CORS config, router mounting
│   ├── requirements.txt            # Python dependencies
│   ├── api/                        # API route handlers
│   │   ├── __init__.py
│   │   ├── files.py                # File CRUD: read, write, create, delete, rename
│   │   ├── projects.py             # Project management: create, clone, list, delete
│   │   ├── processes.py            # Process control: start, stop, restart, status
│   │   ├── database.py             # SQLite viewer: tables, schema, rows, query
│   │   └── websockets.py           # WebSocket handlers: terminal PTY, log streaming
│   ├── services/                   # Business logic layer
│   │   ├── __init__.py
│   │   ├── file_service.py         # File system operations with path safety
│   │   ├── process_service.py      # Subprocess management, framework detection
│   │   └── db_service.py           # SQLite introspection and safe query execution
│   └── workspaces/                 # User project files stored here (auto-created)
│
├── frontend/                       # React + Vite Frontend
│   ├── index.html                  # HTML entry point with SEO meta tags
│   ├── package.json                # npm dependencies
│   ├── vite.config.js              # Vite config with API proxy
│   └── src/
│       ├── main.jsx                # React entry point
│       ├── index.css               # Design system (CSS variables, utilities, animations)
│       ├── App.jsx                 # Main IDE shell (state management, layout)
│       ├── App.css                 # IDE layout (flexbox grid, responsive)
│       ├── components/
│       │   ├── Sidebar/            # Activity bar with navigation icons
│       │   ├── FileExplorer/       # Recursive file tree with context menu
│       │   ├── Editor/             # Monaco editor with multi-tab support
│       │   ├── Terminal/           # xterm.js interactive terminal
│       │   ├── LogViewer/          # Real-time log streaming
│       │   ├── DatabaseViewer/     # SQLite browser with query runner
│       │   ├── Preview/            # iframe app preview with device toggles
│       │   ├── ProjectManager/     # Project create/clone/open modal
│       │   └── common/             # Toolbar, StatusBar
│       └── utils/
│           ├── api.js              # Centralized API client
│           ├── languageMap.js      # File extension → language mapping
│           └── constants.js        # App constants, editor options
│
└── README.md                       # This file
```

---

## 📡 API Reference

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create new project (`{name, template}`) |
| `POST` | `/api/projects/clone` | Clone from GitHub (`{name, url}`) |
| `DELETE` | `/api/projects/{name}` | Delete a project |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/files/{project}` | Get file tree |
| `GET` | `/api/files/{project}/content?path=...` | Read file content |
| `PUT` | `/api/files/{project}/content` | Write file content |
| `POST` | `/api/files/{project}/create` | Create file/directory |
| `DELETE` | `/api/files/{project}/content?path=...` | Delete file/directory |
| `POST` | `/api/files/{project}/rename` | Rename/move file |

### Process Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/process/start` | Start server process |
| `POST` | `/api/process/stop?project=...` | Stop running process |
| `POST` | `/api/process/restart?project=...` | Restart process |
| `GET` | `/api/process/status/{project}` | Get process status |
| `GET` | `/api/process/detect/{project}` | Auto-detect framework |
| `GET` | `/api/process/logs/{project}` | Get recent log lines |

### Database

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/db/{project}/databases` | Find SQLite files |
| `GET` | `/api/db/{project}/tables?db_path=...` | List tables |
| `GET` | `/api/db/{project}/schema/{table}?db_path=...` | Get table schema |
| `GET` | `/api/db/{project}/rows/{table}?db_path=...&page=1` | Paginated rows |
| `POST` | `/api/db/{project}/query` | Execute read-only SQL |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `WS /ws/terminal/{project}` | Interactive terminal session |
| `WS /ws/logs/{project}` | Real-time log streaming |

> 📖 Full interactive API docs available at **http://localhost:8000/docs** (Swagger UI)

---

## 🎨 Frontend Components

### Component Hierarchy

```
App
├── Toolbar                  # Project name, run controls, branding
├── Sidebar                  # Activity bar icons (Explorer, Terminal, DB, Preview)
├── FileExplorer             # File tree (conditional on sidebar selection)
├── EditorPanel              # Monaco Editor + Tab Bar
│   └── TabBar               # Open file tabs with modified indicator
├── TerminalPanel            # xterm.js terminal (bottom panel)
├── LogViewer                # Live log output (bottom panel)
├── DatabaseViewer           # SQLite browser (right panel)
├── PreviewPanel             # iframe preview (right panel)
├── StatusBar                # Process status, file info, encoding
└── ProjectManager           # Modal for project CRUD
```

### Key Design Decisions

1. **Monaco Editor** — Same engine as VS Code, supports 50+ languages with zero config
2. **xterm.js** — Real terminal emulator with ANSI color support, not a fake console
3. **WebSocket** — Real-time bidirectional communication for terminal I/O and log streaming
4. **CSS Variables** — Single source of truth for theming; easy to create new themes
5. **No state management library** — React useState/useCallback is sufficient for this scope

---

## 🗃️ Database Viewer

The database viewer can browse any SQLite database files (`.db`, `.sqlite`, `.sqlite3`) found within a project workspace.

### Features
- **Auto-discovery** — Scans project directory for SQLite files
- **Table list** — Sidebar showing all tables in the selected database
- **Schema view** — Column names, types, constraints, primary keys, defaults
- **Data grid** — Paginated table browser (50 rows per page)
- **SQL query runner** — Execute read-only queries with Ctrl+Enter
- **Safety** — Only SELECT, PRAGMA, and EXPLAIN queries allowed

### Security
- Read-only database connections (`?mode=ro` URI)
- SQL injection prevention via table name validation
- Dangerous keywords blocked (DROP, DELETE, INSERT, UPDATE, ALTER, CREATE)

---

## 📟 Terminal & Logs

### Terminal
- **Backend**: Spawns a real shell process (PowerShell on Windows, Bash on Linux)
- **Frontend**: xterm.js renders terminal output with ANSI colors
- **Connection**: WebSocket bridges keyboard input → shell stdin, shell stdout → terminal display
- **Features**: Scrollback (5000 lines), cursor blinking, clear, reconnect

### Live Logs
- **Streaming**: WebSocket pushes log lines in real-time as the server process runs
- **Color coding**: Errors (red), warnings (yellow), success (green)
- **Auto-scroll**: Automatically scrolls to newest log line
- **Buffer**: Stores last 5000 log lines in memory

---

## 🔌 Extensibility

The architecture is designed to support additional languages and frameworks:

### Adding a New Language/Framework

1. **Language Support** — Add extension mapping in `frontend/src/utils/languageMap.js`:
   ```js
   java: { language: 'java', name: 'Java', icon: '☕' },
   ```

2. **Framework Detection** — Add detection logic in `backend/services/process_service.py`:
   ```python
   # Check for Spring Boot
   pom_xml = project_path / "pom.xml"
   if pom_xml.exists():
       return {"framework": "spring", "command": "mvn spring-boot:run", "port": 8080}
   ```

3. **Project Templates** — Add template in `backend/api/projects.py`:
   ```python
   TEMPLATES["spring"] = {
       "pom.xml": SPRING_POM,
       "src/main/java/App.java": SPRING_APP,
   }
   ```

4. **Frontend Template Card** — Add in `frontend/src/utils/constants.js`:
   ```js
   { id: 'spring', name: 'Spring Boot', description: '...', icon: '🍃', color: '#6DB33F' }
   ```

### Future Enhancements
- **Docker isolation** — Run each project in a container for security
- **PostgreSQL/MySQL** — Connect to external databases via connection strings
- **Git integration** — In-browser commit, push, pull, diff viewer
- **Collaborative editing** — Real-time multi-user editing via OT/CRDT
- **AI code assistant** — Code completion and suggestions

---

## 🔒 Security

| Concern | Mitigation |
|---------|-----------|
| **Path traversal** | All file paths validated against project root via `resolve()` check |
| **SQL injection** | Read-only DB connections, keyword blocking, table name validation |
| **Shell injection** | Terminal scoped to project directory, environment sandboxed |
| **CORS** | Configured in FastAPI middleware (restrict origins in production) |
| **XSS** | React auto-escapes, iframe sandboxed with limited permissions |

> ⚠️ **Production Note**: For production deployment, add authentication (JWT/OAuth), restrict CORS origins, and consider Docker containerization for process isolation.

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check Python version (need 3.10+)
python --version

# Reinstall dependencies
pip install -r requirements.txt

# Try running directly
python main.py
```

### Frontend build fails
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node version (need 18+)
node --version
```

### Terminal not connecting
- Ensure the backend is running on port 8000
- Check browser console for WebSocket errors
- Verify no firewall blocking WebSocket connections

### Database viewer shows no databases
- SQLite files must have extensions: `.db`, `.sqlite`, `.sqlite3`, `.db3`
- The file must be a valid SQLite database (not corrupted)
- Check the project workspace directory

---

## 📄 License

This project was built as part of the Yuvro Assessment. All rights reserved.

---

<p align="center">
  Built with ⚡ by Cloud IDE
</p>
