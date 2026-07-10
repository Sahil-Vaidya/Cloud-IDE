# ⚡ Cloud IDE — Comprehensive Technical & Design Documentation

Welcome to the complete documentation of the **Cloud IDE** project. This document serves as a comprehensive developer manual, system architecture design document, API reference manual, and user setup guide.

---

## 📋 Table of Contents
1. [Project Overview](#1-project-overview)
2. [Key Features & User Guides](#2-key-features--user-guides)
3. [System Architecture & Data Flow](#3-system-architecture--data-flow)
4. [Backend Codebase & Services Deep-Dive](#4-backend-codebase--services-deep-dive)
5. [Frontend Codebase & Component Hierarchy](#5-frontend-codebase--component-hierarchy)
6. [API & WebSocket Reference](#6-api--websocket-reference)
7. [Installation & Developer Setup Guide](#7-installation--developer-setup-guide)
8. [Security & Isolation Protocols](#8-security--isolation-protocols)
9. [Recent Infrastructure Upgrades & Fixes](#9-recent-infrastructure-upgrades--fixes)
10. [Extensibility Guide (Adding Templates/Languages)](#10-extensibility-guide-adding-templateslanguages)

---

## 1. Project Overview
The **Cloud IDE** is a modern, high-performance, browser-based integrated development environment designed to run and manage full-stack Python web applications (Django, Flask, FastAPI, and standard Python scripts) directly in the browser. 

It provides a rich desktop-like experience on top of a web platform. Combining the powerful VS Code Monaco Editor engine, a real xterm.js command line shell over WebSockets, a specialized SQLite database browser, a live web application preview viewport, and real-time log viewers, it is built to be a standalone, self-hosted developer environment.

---

## 2. Key Features & User Guides

### 2.1. Project Manager Modal
When launching the IDE, users are greeted with a Project Manager. This screen provides four options:
* **Create Project**: Choose from templates (FastAPI, Flask, Django, or a blank Python environment) to generate a pre-configured project.
* **Clone Git Repo**: Provide a GitHub HTTPS URL and directory name to clone any public repository instantly into your workspace directory.
* **Open Project**: Select and mount any project directory already created on the server.
* **Open Local Folder**: Two methods:
  * **Absolute Directory Mounting**: Paste an absolute path on the host system (e.g. `D:\projects\my-app`) to mount it.
  * **HTML5 Directory Upload**: Click "Choose Local Folder from Device" to pick any folder on the host computer. The browser uploads the directory tree which the backend recreates on the server.

### 2.2. Interactive Sidebar & Explorer Panel
* **Auto-Focus**: Opening or creating a project automatically opens and highlights the File Explorer tree view.
* **Tree View**: A fully navigable hierarchy showing folders, files, and file types with VS Code-like icons. Contains a context menu (right-click) to Create File, Create Folder, Rename, or Delete items.
* **Minimize Toggle**: Toggle the entire File Explorer panel out of view by clicking the active Explorer tab in the activity sidebar.
* **Shortcut key (Ctrl+B / Cmd+B)**: Press `Ctrl+B` to collapse or expand the File Explorer panel instantly.

### 2.3. Monaco Editor & Settings Panel
* **Monaco Editor**: Integrates the standard editor engine from VS Code, offering syntax highlighting for over 50 languages, auto-indentation, and smart typing.
* **Multi-Tab Interface**: Switch between multiple open files. Files with unsaved changes show a modified circular indicator. Save using the standard keyboard shortcut `Ctrl+S`.
* **Settings Gear**: Open the settings modal to customize the IDE:
  * **Color Theme**: Dark Theme (vs-dark), Light Theme (classic), or High Contrast Black (hc-black).
  * **Font Size**: Change from `12px` up to `20px`.
  * **Show Minimap**: Toggle the miniature code preview column.
  * **Word Wrap**: Toggle wrapping code lines that exceed the screen width.

### 2.4. Resizable Split Terminal & Logs Layout
* **xterm.js Terminal**: A real command shell directly inside your browser. Type standard shell commands, run pipelines, and interact with scripts.
* **Live Server Logs**: Separate output tab that streams real-time `stdout` and `stderr` of the running web application process, complete with color coding (Green for successes/info, Yellow for warnings, Red for errors).
* **Vertical / Horizontal Split**: Move the terminal/logs panel from the bottom position to a right-side vertical column layout (and back) with a single click.
* **Interactive Drag Resizing**: Hover over the divider lines and drag to resize the panel heights (in bottom mode) or widths (in right-column mode) to suit your layout.

### 2.5. SQLite Database Browser
* **Auto-Discovery**: Scans your current project workspace for files ending in `.db`, `.sqlite`, `.sqlite3`, or `.db3`.
* **Table Schema Inspector**: Inspect table column names, types, primary keys, defaults, and constraint attributes.
* **Data Grid View**: Browse rows in a paginated grid layout (50 items per page).
* **SQL Query Runner**: Execute custom SQL statements using standard query syntax. Queries run instantly via `Ctrl+Enter` or by clicking the Run button.

### 2.6. Responsive App Preview Panel
* Renders an iframe targeting the port on which your web server process is started (default: port `8080`).
* Features **responsive device wrapper toggles** allowing you to preview your site layout across Desktop (`100%`), Tablet (`768px` width), and Mobile (`375px` width) views.

### 2.7. Initial Splash Loading Screen
* Appears for exactly **1.8 seconds** upon launching the IDE to establish a professional workspace loading animation.
* Shows a glowing `⚡` lightning logo, elegant typography, and a gradient progress bar filling smoothly from `0%` to `100%` before fading out to the main screen.

---

## 3. System Architecture & Data Flow

The Cloud IDE splits responsibility between a React-based SPA client and a FastAPI-based server.

```
+-------------------------------------------------------------------------+
|                         Frontend (React + Vite)                         |
|   +-----------------------------------------------------------------+   |
|   |  Activity Bar (Explorer, Settings, DB, Terminal, Web Preview)   |   |
|   +-----------------------------------------------------------------+   |
|   |  Monaco Editor  |  Split Layout (Terminal, Logs, SQL Viewer,    |   |
|   |  (Multi-Tabs)   |  Responsive HTML Preview Iframe)              |   |
|   +-----------------+-----------------------------------------------+   |
+-------------------------------------------------------------------------+
       | HTTP REST APIs (JSON)                  ^ WebSockets
       | File CRUD, Process Control,            | - ws/terminal: interactive shell I/O
       | SQLite schema queries & SQL Exec       | - ws/logs: server stdout stream
       v                                        v
+-------------------------------------------------------------------------+
|                        Backend (FastAPI Server)                         |
|   +-----------------------------------------------------------------+   |
|   |  REST Endpoint Routers: /files, /projects, /process, /db        |   |
|   +-----------------------------------------------------------------+   |
|   |  Services:                                                      |   |
|   |  - file_service.py (Windows/Linux path validation, safe resolution)|   |
|   |  - process_service.py (Subprocess spawn, background log parser) |   |
|   |  - db_service.py (SQL sandbox parser, SQLite metadata engine)    |   |
|   +-----------------------------------------------------------------+   |
|   |  OS Executable Bridges:                                         |   |
|   |  - Powershell / Bash Shell Exec via subprocess pipes            |   |
|   |  - Git Clone CLI Exec                                           |   |
|   |  - SQLite DB connection handles                                 |   |
|   +-----------------------------------------------------------------+   |
+-------------------------------------------------------------------------+
       | Reading/Writing
       v
+-------------------------------------------------------------------------+
|                      Project Directory Workspaces                       |
|   - workspaces/project-a/main.py                                        |
|   - workspaces/project-a/db.sqlite3                                     |
+-------------------------------------------------------------------------+
```

### 3.1. Threading & Process Execution Data Flow
When a user launches a web app runner (e.g. FastAPI):
1. The frontend invokes `/api/process/start` via a POST request.
2. The backend (`process_service.py`) triggers `detect_framework(project_name)` to locate manage.py, main.py, or requirements.txt and chooses the template runner.
3. The backend spawns a Python subprocess using `subprocess.Popen` with stdout/stderr redirected to a pipe.
4. A background **Python Daemon Thread** (`_start_log_reader`) starts up, continuously calling `.readline()` on the stdout stream.
5. Parsed output lines are pushed into an in-memory queue (`ProcessInfo.logs` with a max limit of 5,000 lines).
6. Whenever the frontend connects to `/ws/logs/{project}`, the logs router subscribes a callback to the daemon thread. The line contents are encoded and streamed directly into the client UI log terminal over WebSockets.

---

## 4. Backend Codebase & Services Deep-Dive

The backend is written in Python using FastAPI. It consists of the following components:

### 4.1. Core Server: [main.py](file:///d:/Yuvro%20Assesment/backend/main.py)
Imports the routers, configures CORS middleware (permitting cross-origin requests from the Vite frontend), mounts the `/api` routing namespaces, and declares WebSocket endpoints.

### 4.2. File Management Service: [file_service.py](file:///d:/Yuvro%20Assesment/backend/services/file_service.py)
* **Goal**: Handle file explorer CRUD operations (creating, deleting, renaming files/folders, getting directory lists, reading/writing content).
* **Workspace Isolation**: Defines `WORKSPACES_DIR` at the parent directory of the backend to separate code files from the server code, preventing FastAPI uvicorn reloads.
* **Path Validation**: Translates incoming project file paths into absolute server paths and enforces that the resolved path is located strictly within the user's workspace path using `.resolve().startswith(...)`.
* **Windows Compatibility**: Employs case-insensitive directory lookup checks (`.lower()`) to prevent name matching failures on Windows filesystems.

### 4.3. Process Management Service: [process_service.py](file:///d:/Yuvro%20Assesment/backend/services/process_service.py)
* **Goal**: Spawn, stop, and restart project applications (Django, Flask, FastAPI) and manage output logs.
* **Framework Auto-Detection**: Inspects files in the project workspace to detect Django (`manage.py`), FastAPI (`fastapi` keyword inside config/dependencies), or Flask, choosing standard port binding templates (port `8080`).
* **Path Quoting**: Wraps the host system Python executable (`sys.executable`) in double quotes (`f'"{sys.executable}"'`) to ensure compatibility with Windows environments whose paths contain space characters (e.g., `C:\Program Files\Python312\python.exe`).
* **Log Streaming subscriptions**: Maintains a thread-safe registry of WebSocket callbacks, pushing incoming server stdout/stderr messages.

### 4.4. Database Service: [db_service.py](file:///d:/Yuvro%20Assesment/backend/services/db_service.py)
* **Goal**: Serve database schemas and row contents to the SQLite viewer UI.
* **Table Scans**: Queries the SQLite system catalog table `sqlite_master` to retrieve all custom tables, views, and schemas.
* **Read-only SQLite Enforcement**: Opens database connections in read-only mode (`file:{db_path}?mode=ro&uri=true`) to block modifications.
* **SQL Query Parser Sandbox**: Implements string parsing checks on custom query execution payloads. If any token contains mutations (e.g., `DROP`, `DELETE`, `INSERT`, `UPDATE`, `ALTER`, `CREATE`, `REPLACE`), it is rejected with an HTTP 403 response.

---

## 5. Frontend Codebase & Component Hierarchy

The frontend is a React + Vite application structured using modular components.

```
src/
├── main.jsx                       # Entrypoint setup
├── index.css                      # Styling declarations, design tokens
├── App.jsx                        # Layout rendering and global IDE states
├── App.css                        # Layout panels and flexbox split structures
├── utils/
│   ├── api.js                     # Centralized API functions
│   ├── languageMap.js             # Maps file extensions to Monaco syntax highlighters
│   └── constants.js               # Common project templates and themes
└── components/
    ├── Sidebar/
    │   └── Sidebar.jsx            # Activity bar navigation icons
    ├── FileExplorer/
    │   └── FileExplorer.jsx       # Recursive folders with right-click menu
    ├── Editor/
    │   └── EditorPanel.jsx        # Tab management & Monaco editor instantiation
    ├── Terminal/
    │   └── TerminalPanel.jsx      # xterm.js instance bridging interactive WebSockets
    ├── LogViewer/
    │   └── LogViewer.jsx          # Live app output list
    ├── DatabaseViewer/
    │   └── DatabaseViewer.jsx     # Table grid, schema view, query workspace
    ├── Preview/
    │   └── PreviewPanel.jsx       # App preview iframe with responsive toggles
    ├── ProjectManager/
    │   └── ProjectManager.jsx     # Open, create, clone modal overlay
    └── common/
        ├── Toolbar.jsx            # File menu dropdown & Start/Stop process buttons
        └── StatusBar.jsx          # Current file name, status, theme configuration
```

### 5.1. Global Styling & Design Tokens: [index.css](file:///d:/Yuvro%20Assesment/frontend/src/index.css)
Declares root-level CSS theme variables:
* **Dark Theme**: Dark violet-grey background (`#0B0813`), glassmorphic panels, glowing cyan and purple borders, matching terminal background colors.
* **Light Theme**: Clear background, matching border structures, grey text alignments.
* **High Contrast Theme**: High contrast borders and dark backgrounds.
* **Micro-animations**: Scale-in modals (`animate-scale-in`), spinning loaders, glowing pulse status rings for active web app servers.

---

## 6. API & WebSocket Reference

The backend exposes the following endpoints (Full auto-generated Swagger documentation is available at `http://localhost:8000/docs`).

### 6.1. Projects API (`/api/projects`)
* **GET `/api/projects`**: Lists all projects inside the workspaces folder.
  * *Response*: `{"projects": [{"name": "project-a", "path": "...", "file_count": 10, "size": 4096}]}`
* **POST `/api/projects`**: Creates a new project folder from a template.
  * *Body (JSON)*: `{"name": "project-b", "template": "fastapi"}`
* **POST `/api/projects/clone`**: Clones a Git repo into the workspace directory.
  * *Body (JSON)*: `{"name": "repo-dir", "url": "https://github.com/..."}`
* **DELETE `/api/projects/{name}`**: Removes a project folder and all internal files.
* **POST `/api/projects/select-local`**: Triggers a native system folder dialog (Tkinter) on the backend host to mount an existing folder.
* **POST `/api/projects/upload`**: Uploads folder files from the browser file uploader API.
  * *Payload*: Form data (file list).

### 6.2. Files API (`/api/files/{project}`)
* **GET `/api/files/{project}`**: Returns a recursive JSON structure of all folders and files.
* **GET `/api/files/{project}/content?path=...`**: Reads the text content of a file.
* **PUT `/api/files/{project}/content`**: Saves new content to a file.
  * *Body (JSON)*: `{"path": "main.py", "content": "print('hello')"}`
* **POST `/api/files/{project}/create`**: Creates a new file or folder.
  * *Body (JSON)*: `{"path": "utils/tools.py", "type": "file"}` (type is `"file"` or `"directory"`)
* **DELETE `/api/files/{project}/content?path=...`**: Deletes a file or directory.
* **POST `/api/files/{project}/rename`**: Renames or moves a file/folder.
  * *Body (JSON)*: `{"old_path": "old.py", "new_path": "new.py"}`

### 6.3. Processes API (`/api/process`)
* **POST `/api/process/start`**: Starts the execution server process for a project.
  * *Body (JSON)*: `{"project": "my-app", "command": null, "port": 8080}`
* **POST `/api/process/stop?project=...`**: Stops the running application.
* **POST `/api/process/restart?project=...`**: Stops and restarts the running application.
* **GET `/api/process/status/{project}`**: Retrieves the status of the runner process.
* **GET `/api/process/logs/{project}`**: Fetches the recent 100 log lines from the project queue.

### 6.4. SQLite Database API (`/api/db/{project}`)
* **GET `/api/db/{project}/databases`**: Returns an array of paths to SQLite databases inside the project directory.
* **GET `/api/db/{project}/tables?db_path=...`**: Lists all tables in the specified database.
* **GET `/api/db/{project}/schema/{table}?db_path=...`**: Returns columns, datatypes, defaults, and primary key metadata for a table.
* **GET `/api/db/{project}/rows/{table}?db_path=...&page=1`**: Returns rows from a table (50 rows per page).
* **POST `/api/db/{project}/query`**: Executes custom read-only SQL queries.
  * *Body (JSON)*: `{"db_path": "db.sqlite3", "query": "SELECT * FROM users"}`

### 6.5. WebSocket Connections
* **`WS /ws/terminal/{project}`**: Direct stdin/stdout link to the terminal process.
  * *Protocol*: JSON-encoded inputs: `{"type": "input", "data": "ls\r"}`. Outputs are pushed as: `{"type": "output", "data": "..."}`.
* **`WS /ws/logs/{project}`**: Pushes stdout lines from the running project web server.
  * *Protocol*: Pushes `{"type": "log", "data": "Server started"}` lines.

---

## 7. Installation & Developer Setup Guide

### 7.1. Hardware & OS Requirements
* **Operating System**: Windows 10/11, macOS, or Linux.
* **Python**: Version `3.10` or higher.
* **Node.js**: Version `18` or higher.
* **System Utilities**: `git` (to clone templates).

### 7.2. Step-by-Step Setup
1. Clone the project code and open a terminal inside the root directory.
2. **Backend Setup**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   ```
4. **Execution**:
   Open two terminal panels.
   * **Terminal 1 (Backend API)**:
     ```bash
     cd backend
     python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
     ```
   * **Terminal 2 (Frontend Client Dev Server)**:
     ```bash
     cd frontend
     npm run dev
     ```
   Open your browser to `http://localhost:5173`.

---

## 8. Security & Isolation Protocols

To protect host computer files and configurations, the Cloud IDE implements strict security layers:

* **Path Traversal Shield**: The backend `file_service.py` validates path inputs. It uses Python's standard `Path.resolve()` to resolve paths, resolving symbolic links and relative sections (`..`). If the resolved absolute path does not start with the project's absolute workspace directory, access is blocked with a `400 Bad Request` or `404 Not Found` response.
* **SQL Injection & Sandbox Parser**: To prevent database corruption and malicious scripts:
  * Database connections are opened using the URI `mode=ro` (read-only) parameter.
  * Table names are verified against system catalogs.
  * Incoming SQL inputs are scanned for modification keywords (`DROP`, `DELETE`, `INSERT`, `UPDATE`, `ALTER`, `CREATE`, `REPLACE`, `REINDEX`). If detected, the API throws an HTTP `403 Forbidden` response.
* **Terminal Process Limits**: PTY terminal connections run with the permissions of the host FastAPI process, but are initiated with their working directory clamped to the individual project directory.

---

## 9. Recent Infrastructure Upgrades & Fixes

* **Uvicorn Auto-Reload Loop Prevention**: Previously, workspace project directories were created inside the `backend/` folder. This caused Uvicorn to detect changes and reload the backend API server whenever a user created, modified, or saved files in the IDE. To resolve this, workspaces were migrated to the parent directory (`d:\Yuvro Assesment\workspaces`), isolating them from the FastAPI source tree.
* **Windows File Name Case-Sensitivity Fix**: On Windows, filenames are case-insensitive. In [file_service.py](file:///d:/Yuvro%20Assesment/backend/services/file_service.py), path validation was modified to convert paths to lowercase (`.lower()`) before performing folder prefix checks. This prevents directory matching failures caused by casing differences.
* **Windows Python Executable Path Spacing Fix**: When starting subprocess servers, the host python executable path is read from `sys.executable`. In default Windows installations, this path frequently contains spaces (e.g., `C:\Program Files\...`). We modified `detect_framework` commands inside [process_service.py](file:///d:/Yuvro%20Assesment/backend/services/process_service.py) to quote the executable string, ensuring `subprocess.Popen` executes it correctly under `shell=True`.

---

## 10. Extensibility Guide (Adding Templates/Languages)

### 10.1. How to add a new project template (e.g., Spring Boot)
1. Add the template files mapping inside [projects.py](file:///d:/Yuvro%20Assesment/backend/api/projects.py):
   ```python
   TEMPLATES["springboot"] = {
       "pom.xml": "...",
       "src/main/java/com/app/Application.java": "..."
   }
   ```
2. Define framework detection in [process_service.py](file:///d:/Yuvro%20Assesment/backend/services/process_service.py) inside `detect_framework`:
   ```python
   pom_xml = project_path / "pom.xml"
   if pom_xml.exists():
       return {
           "framework": "springboot",
           "command": "mvn spring-boot:run",
           "port": 8080
       }
   ```
3. Add the UI template options in the frontend constants (`frontend/src/utils/constants.js`):
   ```javascript
   { id: 'springboot', name: 'Spring Boot', icon: '🍃', color: '#6DB33F', description: 'Java Spring Boot project framework' }
   ```

### 10.2. How to add syntax highlighting support for a new language
Add the file extension to Monaco language mapping in `frontend/src/utils/languageMap.js`:
```javascript
cpp: { language: 'cpp', name: 'C++', icon: '🔵' }
```
The IDE will automatically apply the matching language syntax highlighting mode to the Monaco editor.
