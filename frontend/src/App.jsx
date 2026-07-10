import React, { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import FileExplorer from './components/FileExplorer/FileExplorer';
import EditorPanel from './components/Editor/EditorPanel';
import TerminalPanel from './components/Terminal/TerminalPanel';
import LogViewer from './components/LogViewer/LogViewer';
import DatabaseViewer from './components/DatabaseViewer/DatabaseViewer';
import PreviewPanel from './components/Preview/PreviewPanel';
import ProjectManager from './components/ProjectManager/ProjectManager';
import SettingsModal from './components/Settings/SettingsModal';
import Toolbar from './components/common/Toolbar';
import StatusBar from './components/common/StatusBar';
import Auth from './components/Auth/Auth';
import SearchPanel from './components/Search/SearchPanel';
import GitPanel from './components/GitPanel/GitPanel';
import { ToastProvider, useToast } from './components/common/Toast';
import { fileAPI, processAPI } from './utils/api';
import { VscSplitHorizontal, VscSplitVertical } from 'react-icons/vsc';
import './App.css';

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}

function MainApp() {
  const toast = useToast();
  // ─── State ──────────────────────────────────────────────────
  const [appInitializing, setAppInitializing] = useState(true);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('cloud_ide_user');
    const savedToken = localStorage.getItem('cloud_ide_token');
    return savedUser && savedToken ? JSON.parse(savedUser) : null;
  });
  const [project, setProject] = useState('');
  const [fileTree, setFileTree] = useState([]);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [activePanel, setActivePanel] = useState('explorer');
  const [bottomPanel, setBottomPanel] = useState('terminal'); // 'terminal' | 'logs'
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(true);
  const [initialPMTab, setInitialPMTab] = useState('open');
  const [showExplorer, setShowExplorer] = useState(true);
  const [processStatus, setProcessStatus] = useState(null);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('cloud_ide_token');
    localStorage.removeItem('cloud_ide_user');
    setUser(null);
    setProject('');
    setFileTree([]);
    setOpenFiles([]);
    setActiveFile(null);
  }, []);
  
  // Panel Layouts
  const [terminalPosition, setTerminalPosition] = useState('bottom'); // 'bottom' | 'right'
  const [bottomPanelHeight, setBottomPanelHeight] = useState(280);
  const [rightTerminalWidth, setRightTerminalWidth] = useState(450);
  const [explorerWidth, setExplorerWidth] = useState(250);
  const [rightPanelWidth, setRightPanelWidth] = useState(420);

  // Splash Screen Timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppInitializing(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle sidebar explorer
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setShowExplorer((prev) => !prev);
      }
      // Search: Ctrl+Shift+F
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setActivePanel('search');
        setShowExplorer(true);
      }
      // Source Control: Ctrl+Shift+G
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setActivePanel('git');
        setShowExplorer(true);
      }
      // Explorer: Ctrl+Shift+E
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setActivePanel('explorer');
        setShowExplorer(true);
      }
      // Terminal: Ctrl+` (backtick)
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setShowBottomPanel((prev) => !prev);
      }
      // Settings: Ctrl+,
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
      // Project Manager: Ctrl+Shift+P
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setInitialPMTab('open');
        setShowProjectManager(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('cloud_ide_settings');
    return saved ? JSON.parse(saved) : {
      theme: 'vs-dark',
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      minimap: true,
      wordWrap: 'on',
      tabSize: 4,
      keybindings: 'default',
      bracketPairs: true,
      lineNumbers: true,
      autoSave: true,
      autoSaveDelay: 2000,
      terminalFontSize: 13,
      terminalCursorBlink: true,
    };
  });

  useEffect(() => {
    localStorage.setItem('cloud_ide_settings', JSON.stringify(settings));
    document.documentElement.setAttribute('data-theme', settings.theme === 'light' ? 'light' : settings.theme === 'hc-black' ? 'hc-black' : 'dark');
  }, [settings]);

  // ─── Refs ───────────────────────────────────────────────────
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const resizingWidthRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const resizingExplorerRef = useRef(false);
  const startXExplorerRef = useRef(0);
  const startWidthExplorerRef = useRef(0);

  const resizingRightPanelRef = useRef(false);
  const startXRightPanelRef = useRef(0);
  const startWidthRightPanelRef = useRef(0);

  // ─── Load File Tree ─────────────────────────────────────────
  const loadFileTree = useCallback(async () => {
    if (!project) return;
    try {
      const data = await fileAPI.getTree(project);
      setFileTree(data.tree || []);
    } catch (err) {
      console.error('Failed to load file tree:', err);
      toast.error(`Failed to load project: ${err.message}`);
      setProject('');
      setShowProjectManager(true);
    }
  }, [project, toast]);

  useEffect(() => {
    if (project) {
      loadFileTree();
      // Close open files when switching project
      setOpenFiles([]);
      setActiveFile(null);
      // Auto open explorer panel
      setActivePanel('explorer');
      setShowExplorer(true);
      // Close right panel to avoid showing stale DB/preview from old project
      setShowRightPanel(false);
    }
  }, [project, loadFileTree]);

  // ─── Poll Process Status ────────────────────────────────────
  useEffect(() => {
    if (!project) {
      setProcessStatus(null);
      return;
    }

    const pollStatus = async () => {
      try {
        const status = await processAPI.status(project);
        setProcessStatus(status);
      } catch {
        // ignore
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [project]);

  // ─── File Selection ─────────────────────────────────────────
  const handleFileSelect = useCallback(
    async (node) => {
      if (node.type === 'directory') return;

      // Check if already open
      const existing = openFiles.find((f) => f.path === node.path);
      if (existing) {
        setActiveFile(existing);
        return;
      }

      try {
        const data = await fileAPI.readFile(project, node.path);
        const fileData = {
          path: node.path,
          name: node.name,
          content: data.content,
          extension: data.extension,
        };
        setOpenFiles((prev) => [...prev, fileData]);
        setActiveFile(fileData);
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    },
    [project, openFiles]
  );

  const handleFileChange = useCallback((file) => {
    setActiveFile(file);
  }, []);

  const handleOpenFileAtLine = useCallback(
    async (filePath, line) => {
      // Find or read file
      const existing = openFiles.find((f) => f.path === filePath);
      if (existing) {
        setActiveFile({ ...existing, line });
        return;
      }
      try {
        const data = await fileAPI.readFile(project, filePath);
        const fileData = {
          path: filePath,
          name: filePath.split('/').pop(),
          content: data.content,
          extension: data.extension,
          line,
        };
        setOpenFiles((prev) => [...prev, fileData]);
        setActiveFile(fileData);
      } catch (err) {
        console.error('Failed to open file from search:', err);
      }
    },
    [project, openFiles]
  );

  const handleCloseFile = useCallback(
    (file) => {
      setOpenFiles((prev) => {
        const next = prev.filter((f) => f.path !== file.path);
        // If closing the active file, switch to adjacent tab
        if (activeFile?.path === file.path) {
          const idx = prev.findIndex((f) => f.path === file.path);
          const newActive = next[Math.min(idx, next.length - 1)] || null;
          setActiveFile(newActive);
        }
        return next;
      });
    },
    [activeFile]
  );

  const handleFileDelete = useCallback(
    (deletedPath, isDir) => {
      setOpenFiles((prev) => {
        let next;
        if (isDir) {
          const folderPrefix = deletedPath.endsWith('/') ? deletedPath : `${deletedPath}/`;
          next = prev.filter((f) => f.path !== deletedPath && !f.path.startsWith(folderPrefix));
        } else {
          next = prev.filter((f) => f.path !== deletedPath);
        }

        // If active file was deleted, switch to the last open file or null
        if (activeFile && (activeFile.path === deletedPath || (isDir && activeFile.path.startsWith(deletedPath + '/')))) {
          const remainingActive = next.length > 0 ? next[next.length - 1] : null;
          setActiveFile(remainingActive);
        }
        return next;
      });
    },
    [activeFile]
  );

  const handleFileRename = useCallback(
    (oldPath, newPath, isDir) => {
      setOpenFiles((prev) => {
        const next = prev.map((file) => {
          if (isDir) {
            const folderPrefix = oldPath.endsWith('/') ? oldPath : `${oldPath}/`;
            if (file.path === oldPath) {
              return {
                ...file,
                path: newPath,
                name: newPath.split('/').pop(),
              };
            } else if (file.path.startsWith(folderPrefix)) {
              const rel = file.path.substring(folderPrefix.length);
              const newFilePath = newPath.endsWith('/') ? `${newPath}${rel}` : `${newPath}/${rel}`;
              return {
                ...file,
                path: newFilePath,
              };
            }
          } else {
            if (file.path === oldPath) {
              return {
                ...file,
                path: newPath,
                name: newPath.split('/').pop(),
              };
            }
          }
          return file;
        });

        // Update active file if it was renamed
        if (activeFile) {
          if (isDir) {
            const folderPrefix = oldPath.endsWith('/') ? oldPath : `${oldPath}/`;
            if (activeFile.path === oldPath) {
              setActiveFile({
                ...activeFile,
                path: newPath,
                name: newPath.split('/').pop(),
              });
            } else if (activeFile.path.startsWith(folderPrefix)) {
              const rel = activeFile.path.substring(folderPrefix.length);
              const newFilePath = newPath.endsWith('/') ? `${newPath}${rel}` : `${newPath}/${rel}`;
              setActiveFile({
                ...activeFile,
                path: newFilePath,
              });
            }
          } else {
            if (activeFile.path === oldPath) {
              setActiveFile({
                ...activeFile,
                path: newPath,
                name: newPath.split('/').pop(),
              });
            }
          }
        }
        return next;
      });
    },
    [activeFile]
  );

  const handleReorderFiles = useCallback((fromIndex, toIndex) => {
    setOpenFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  // ─── Process Actions ───────────────────────────────────────
  const handleProcessAction = useCallback(
    async (action) => {
      if (!project) return;
      try {
        if (action === 'start') {
          await processAPI.start(project);
          setShowBottomPanel(true);
          setBottomPanel('logs');
        } else if (action === 'stop') {
          await processAPI.stop(project);
        } else if (action === 'restart') {
          await processAPI.restart(project);
        }
        // Refresh status
        const status = await processAPI.status(project);
        setProcessStatus(status);
      } catch (err) {
        console.error('Process action failed:', err);
      }
    },
    [project]
  );

  // ─── Panel Management ──────────────────────────────────────
  const handlePanelChange = useCallback(
    (panel) => {
      if (panel === 'explorer') {
        if (activePanel === 'explorer' && showExplorer) {
          setShowExplorer(false);
        } else {
          setActivePanel('explorer');
          setShowExplorer(true);
        }
      } else if (panel === 'search' || panel === 'git') {
        if (activePanel === panel && showExplorer) {
          setShowExplorer(false);
        } else {
          setActivePanel(panel);
          setShowExplorer(true);
        }
      } else if (panel === 'terminal') {
        setShowBottomPanel(true);
        setBottomPanel('terminal');
        setActivePanel(activePanel === 'explorer' ? 'explorer' : panel);
      } else if (panel === 'database' || panel === 'preview') {
        if (activePanel === panel && showRightPanel) {
          setShowRightPanel(false);
        } else {
          setShowRightPanel(true);
          setActivePanel(panel);
        }
      } else {
        setActivePanel(panel);
      }
    },
    [activePanel, showRightPanel, showExplorer]
  );

  // ─── Resize Handles ────────────────────────────────────────
  const handleResizeStart = useCallback((e) => {
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = bottomPanelHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('resizing');

    const handleMouseMove = (e) => {
      if (!resizingRef.current) return;
      const delta = startYRef.current - e.clientY;
      const newHeight = Math.max(120, Math.min(600, startHeightRef.current + delta));
      setBottomPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [bottomPanelHeight]);

  const handleVerticalResizeStart = useCallback((e) => {
    resizingWidthRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = rightTerminalWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('resizing');

    const handleMouseMove = (e) => {
      if (!resizingWidthRef.current) return;
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.max(250, Math.min(800, startWidthRef.current + delta));
      setRightTerminalWidth(newWidth);
    };

    const handleMouseUp = () => {
      resizingWidthRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [rightTerminalWidth]);

  const handleExplorerResizeStart = useCallback((e) => {
    resizingExplorerRef.current = true;
    startXExplorerRef.current = e.clientX;
    startWidthExplorerRef.current = explorerWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('resizing');

    const handleMouseMove = (e) => {
      if (!resizingExplorerRef.current) return;
      const delta = e.clientX - startXExplorerRef.current;
      const newWidth = Math.max(180, Math.min(600, startWidthExplorerRef.current + delta));
      setExplorerWidth(newWidth);
    };

    const handleMouseUp = () => {
      resizingExplorerRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [explorerWidth]);

  const handleRightPanelResizeStart = useCallback((e) => {
    resizingRightPanelRef.current = true;
    startXRightPanelRef.current = e.clientX;
    startWidthRightPanelRef.current = rightPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('resizing');

    const handleMouseMove = (e) => {
      if (!resizingRightPanelRef.current) return;
      const delta = startXRightPanelRef.current - e.clientX;
      const newWidth = Math.max(250, Math.min(900, startWidthRightPanelRef.current + delta));
      setRightPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      resizingRightPanelRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [rightPanelWidth]);

  // ─── Close Project ──────────────────────────────────────────
  const handleCloseProject = useCallback(async () => {
    // Stop running process before closing
    if (processStatus?.is_running && project) {
      try {
        await processAPI.stop(project);
      } catch {
        // Best-effort
      }
    }
    setProject('');
    setFileTree([]);
    setOpenFiles([]);
    setActiveFile(null);
    setProcessStatus(null);
    setShowRightPanel(false);
  }, [project, processStatus]);

  // ─── Show right panel content ─────────────────────────────
  const rightPanelContent = activePanel === 'database' ? 'database' : activePanel === 'preview' ? 'preview' : null;

  // ─── Render Panel Content ─────────────────────────────────
  const renderTerminalLogsPanel = () => {
    return (
      <div className="bottom-panel-container">
        <div className="bottom-panel-tabs">
          <button
            className={`bottom-panel-tab ${bottomPanel === 'terminal' ? 'active' : ''}`}
            onClick={() => setBottomPanel('terminal')}
          >
            Terminal
          </button>
          <button
            className={`bottom-panel-tab ${bottomPanel === 'logs' ? 'active' : ''}`}
            onClick={() => setBottomPanel('logs')}
          >
            Output
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="bottom-panel-tab"
            onClick={() => setTerminalPosition(terminalPosition === 'bottom' ? 'right' : 'bottom')}
            title={terminalPosition === 'bottom' ? 'Move Panel to Right' : 'Move Panel to Bottom'}
          >
            {terminalPosition === 'bottom' ? <VscSplitVertical /> : <VscSplitHorizontal />}
          </button>
          <button
            className="bottom-panel-tab"
            onClick={() => setShowBottomPanel(false)}
            style={{ fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
        <div className="bottom-panel-content">
          {bottomPanel === 'terminal' && (
            <TerminalPanel
              project={project}
              visible={bottomPanel === 'terminal' && showBottomPanel}
            />
          )}
          {bottomPanel === 'logs' && (
            <LogViewer
              project={project}
              processStatus={processStatus}
              onProcessAction={handleProcessAction}
            />
          )}
        </div>
      </div>
    );
  };

  if (appInitializing) {
    return (
      <div className="app-splash-screen animate-fade-in">
        <div className="splash-content">
          <div className="splash-logo">⚡</div>
          <h1 className="splash-title">Cloud IDE</h1>
          <div className="splash-loading-bar">
            <div className="splash-loading-progress" />
          </div>
          <p className="splash-subtitle">Initializing workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Auth
        onLoginSuccess={(token, loggedInUser) => {
          localStorage.setItem('cloud_ide_token', token);
          localStorage.setItem('cloud_ide_user', JSON.stringify(loggedInUser));
          setUser(loggedInUser);
        }}
      />
    );
  }

  return (
    <div className="app">
      {/* Toolbar */}
      <Toolbar
        project={project}
        processStatus={processStatus}
        onProcessAction={handleProcessAction}
        onOpenProjectManager={() => {
          setInitialPMTab('open');
          setShowProjectManager(true);
        }}
        onCloseProject={handleCloseProject}
        onOpenSettings={() => setShowSettings(true)}
        onOpenLocalProject={() => {
          setInitialPMTab('local');
          setShowProjectManager(true);
        }}
        onToggleSidebar={() => setShowExplorer((prev) => !prev)}
        userEmail={user?.email}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="app-main">
        {/* Sidebar */}
        <Sidebar
          activePanel={activePanel}
          onPanelChange={handlePanelChange}
          onOpenProjectManager={() => {
            setInitialPMTab('open');
            setShowProjectManager(true);
          }}
          onOpenSettings={() => setShowSettings(true)}
        />

        {/* Sidebar panels */}
        {project && showExplorer && (
          <>
            <div className="app-sidebar-panel-container" style={{ width: `${explorerWidth}px`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
              {activePanel === 'explorer' && (
                <FileExplorer
                  project={project}
                  fileTree={fileTree}
                  selectedFile={activeFile?.path}
                  onFileSelect={handleFileSelect}
                  onRefresh={loadFileTree}
                  onFileDelete={handleFileDelete}
                  onFileRename={handleFileRename}
                />
              )}
              {activePanel === 'search' && (
                <SearchPanel
                  project={project}
                  onOpenFileAtLine={handleOpenFileAtLine}
                />
              )}
              {activePanel === 'git' && (
                <GitPanel
                  project={project}
                />
              )}
            </div>
            <div
              className="resize-handle-vertical"
              onMouseDown={handleExplorerResizeStart}
            />
          </>
        )}

        {/* Content Area */}
        <div className="app-content">
          <div className="app-center">
            {/* Editor */}
            <div className="app-editor-area">
              <EditorPanel
                project={project}
                openFiles={openFiles}
                activeFile={activeFile}
                onFileChange={handleFileChange}
                onCloseFile={handleCloseFile}
                onFileSave={() => loadFileTree()}
                settings={settings}
                onReorderFiles={handleReorderFiles}
              />
            </div>

            {/* Right Terminal Panel */}
            {showBottomPanel && terminalPosition === 'right' && (
              <>
                <div
                  className="resize-handle-vertical"
                  onMouseDown={handleVerticalResizeStart}
                />
                <div
                  className="app-right-terminal-panel"
                  style={{ width: `${rightTerminalWidth}px` }}
                >
                  {renderTerminalLogsPanel()}
                </div>
              </>
            )}

            {/* Right Panel (Database / Preview) */}
            {showRightPanel && rightPanelContent && (
              <>
                <div
                  className="resize-handle-vertical"
                  onMouseDown={handleRightPanelResizeStart}
                />
                <div className="app-right-panel" style={{ width: `${rightPanelWidth}px` }}>
                  {rightPanelContent === 'database' && (
                    <DatabaseViewer project={project} />
                  )}
                  {rightPanelContent === 'preview' && (
                    <PreviewPanel project={project} processStatus={processStatus} />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Resize Handle */}
          {showBottomPanel && terminalPosition === 'bottom' && (
            <div
              className="resize-handle"
              onMouseDown={handleResizeStart}
            />
          )}

          {/* Bottom Panel (Terminal / Logs) */}
          {showBottomPanel && terminalPosition === 'bottom' && (
            <div
              className="app-bottom-panel"
              style={{ height: `${bottomPanelHeight}px` }}
            >
              {renderTerminalLogsPanel()}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        project={project}
        activeFile={activeFile}
        processStatus={processStatus}
      />

      {/* Project Manager Modal */}
      <ProjectManager
        isOpen={showProjectManager}
        onClose={() => setShowProjectManager(false)}
        onProjectOpen={(name) => {
          setProject(name);
          setShowProjectManager(false);
        }}
        onOpenLocalProject={(path) => {
          setProject(path);
          setShowProjectManager(false);
        }}
        currentProject={project}
        initialTab={initialPMTab}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  );
}
