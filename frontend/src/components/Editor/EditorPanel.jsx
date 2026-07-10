import React, { useState, useCallback, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { VscClose, VscSave, VscChevronRight } from 'react-icons/vsc';
import { getLanguageFromFilename } from '../../utils/languageMap';
import { fileAPI } from '../../utils/api';
import { EDITOR_OPTIONS } from '../../utils/constants';
import { useToast } from '../common/Toast';
import './Editor.css';

export default function EditorPanel({
  project,
  openFiles,
  activeFile,
  onFileChange,
  onCloseFile,
  onFileSave,
  settings,
  onReorderFiles,
}) {
  const toast = useToast();
  const [modified, setModified] = useState(new Set());
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const handleSaveRef = useRef(null); // Latest handleSave reference for auto-save

  // Drag Tab Refs & Handlers
  const dragTabIdxRef = useRef(null);

  const handleTabDragStart = (e, index) => {
    dragTabIdxRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTabDragOver = (e, index) => {
    if (dragTabIdxRef.current === null || dragTabIdxRef.current === index) return;
    e.preventDefault();
  };

  const handleTabDrop = (e, index) => {
    const sourceIndex = dragTabIdxRef.current;
    if (sourceIndex === null || sourceIndex === index) return;
    if (onReorderFiles) {
      onReorderFiles(sourceIndex, index);
    }
    dragTabIdxRef.current = null;
  };

  // ─── Auto-save timer ───────────────────────────────────────────
  const scheduleAutoSave = useCallback(() => {
    if (!settings?.autoSave) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      // Use ref to always call latest handleSave
      if (handleSaveRef.current) handleSaveRef.current(true);
    }, settings?.autoSaveDelay || 2000);
  }, [settings?.autoSave, settings?.autoSaveDelay]);

  // Cleanup auto-save on unmount
  useEffect(() => () => clearTimeout(autoSaveTimerRef.current), []);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Ctrl+S save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => handleSave(false));

    // Apply keybinding model
    if (settings?.keybindings === 'vim') {
      // Vim keybindings require monaco-vim — show a toast hint
    }
  };

  // Scroll to line when activeFile.line changes
  useEffect(() => {
    if (editorRef.current && activeFile?.line) {
      // Small timeout to ensure Monaco has parsed the layout
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.revealLineInCenter(activeFile.line);
          editorRef.current.setPosition({ lineNumber: activeFile.line, column: 1 });
          editorRef.current.focus();
        }
      }, 100);
    }
  }, [activeFile?.path, activeFile?.line]);

  const handleSave = useCallback(
    async (silent = false) => {
      if (!activeFile || !project) return;
      const content = editorRef.current?.getValue();
      if (content === undefined) return;

      try {
        await fileAPI.writeFile(project, activeFile.path, content);
        setModified((prev) => {
          const next = new Set(prev);
          next.delete(activeFile.path);
          return next;
        });
        if (onFileSave) onFileSave(activeFile.path);
        if (!silent) toast.success(`Saved ${activeFile.name}`, { duration: 2000 });
      } catch (err) {
        toast.error(`Failed to save: ${err.message}`);
      }
    },
    [project, activeFile, onFileSave, toast]
  );

  // Keep ref updated so scheduleAutoSave always calls the latest version
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  const handleEditorChange = useCallback(() => {
    if (!activeFile) return;
    setModified((prev) => new Set([...prev, activeFile.path]));
    scheduleAutoSave();
  }, [activeFile, scheduleAutoSave]);

  const handleCloseFile = useCallback(
    (file, e) => {
      e?.stopPropagation();
      if (modified.has(file.path)) {
        const confirmed = window.confirm(
          `"${file.name}" has unsaved changes. Close anyway?`
        );
        if (!confirmed) return;
      }
      onCloseFile(file);
    },
    [modified, onCloseFile]
  );

  const activeFileData = openFiles.find((f) => f.path === activeFile?.path);
  const langInfo = activeFileData ? getLanguageFromFilename(activeFileData.name) : null;

  // Breadcrumb segments from file path
  const breadcrumbs = activeFile?.path
    ? activeFile.path.split('/').filter(Boolean)
    : [];

  return (
    <div className="editor-panel" id="editor-panel">
      {/* ── Tab Bar ─────────────────────────────────────────── */}
      {openFiles.length > 0 && (
        <div className="tab-bar" id="tab-bar">
          {openFiles.map((file, index) => {
            const info = getLanguageFromFilename(file.name);
            const isActive = activeFile?.path === file.path;
            const isModified = modified.has(file.path);

            return (
              <button
                key={file.path}
                className={`tab ${isActive ? 'active' : ''}`}
                onClick={() => onFileChange(file)}
                title={file.path}
                id={`tab-${file.path.replace(/[\/\\.]/g, '-')}`}
                draggable
                onDragStart={(e) => handleTabDragStart(e, index)}
                onDragOver={(e) => handleTabDragOver(e, index)}
                onDrop={(e) => handleTabDrop(e, index)}
              >
                <span className="tab-icon">{info.icon}</span>
                <span className="tab-name">{file.name}</span>
                {isModified && <span className="tab-modified" title="Unsaved changes" />}
                <button
                  className="tab-close"
                  onClick={(e) => handleCloseFile(file, e)}
                  title="Close"
                >
                  <VscClose />
                </button>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Breadcrumb ──────────────────────────────────────── */}
      {activeFile && breadcrumbs.length > 0 && (
        <div className="editor-breadcrumb">
          {breadcrumbs.map((segment, i) => (
            <React.Fragment key={i}>
              {i > 0 && <VscChevronRight className="breadcrumb-sep" />}
              <span
                className={`breadcrumb-seg ${i === breadcrumbs.length - 1 ? 'last' : ''}`}
              >
                {i === breadcrumbs.length - 1 ? `${langInfo?.icon || ''} ${segment}` : segment}
              </span>
            </React.Fragment>
          ))}

          {modified.has(activeFile?.path) && (
            <span className="breadcrumb-unsaved" title="Unsaved changes">●</span>
          )}

          {/* Save button in breadcrumb */}
          <button
            className="breadcrumb-save-btn"
            onClick={() => handleSave(false)}
            title="Save (Ctrl+S)"
          >
            <VscSave />
          </button>
        </div>
      )}

      {/* ── Editor Area ─────────────────────────────────────── */}
      <div className="editor-area">
        {activeFileData ? (
          <Editor
            height="100%"
            language={langInfo?.language || 'plaintext'}
            value={activeFileData.content}
            theme={settings?.theme || 'vs-dark'}
            onMount={handleEditorMount}
            onChange={handleEditorChange}
            options={{
              ...EDITOR_OPTIONS,
              fontSize: settings?.fontSize || 14,
              fontFamily: settings?.fontFamily || "'JetBrains Mono', monospace",
              minimap: { enabled: settings?.minimap !== false },
              wordWrap: settings?.wordWrap || 'on',
              tabSize: settings?.tabSize || 4,
              lineNumbers: settings?.lineNumbers !== false ? 'on' : 'off',
              bracketPairColorization: { enabled: settings?.bracketPairs !== false },
            }}
            loading={
              <div className="empty-state">
                <div className="spinner" />
                <p>Loading editor...</p>
              </div>
            }
          />
        ) : (
          <WelcomeScreen />
        )}
      </div>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="editor-welcome">
      <div className="editor-welcome-logo">⚡</div>
      <h2>Cloud IDE</h2>
      <p>Open a file from the explorer or create a new project.</p>
      <div className="editor-welcome-shortcuts">
        {[
          ['Ctrl+S', 'Save file'],
          ['Ctrl+Z', 'Undo'],
          ['Ctrl+Shift+F', 'Search'],
          ['Ctrl+Shift+G', 'Source Control'],
          ['Ctrl+`', 'Toggle Terminal'],
          ['Ctrl+Shift+P', 'Projects'],
        ].map(([key, desc]) => (
          <div key={key} className="editor-welcome-shortcut">
            <span className="shortcut-keys">
              {key.split('+').map((k, i) => (
                <React.Fragment key={i}>
                  {i > 0 && '+'}
                  <kbd>{k}</kbd>
                </React.Fragment>
              ))}
            </span>
            <span>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
