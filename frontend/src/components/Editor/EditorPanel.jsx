import React, { useState, useCallback, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { VscClose } from 'react-icons/vsc';
import { getLanguageFromFilename, getLanguageFromExtension } from '../../utils/languageMap';
import { fileAPI } from '../../utils/api';
import { EDITOR_OPTIONS } from '../../utils/constants';
import './Editor.css';

export default function EditorPanel({ project, openFiles, activeFile, onFileChange, onCloseFile, onFileSave, settings }) {
  const [modified, setModified] = useState(new Set());
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Add Ctrl+S save shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  const handleSave = useCallback(async () => {
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
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [project, activeFile, onFileSave]);

  const handleEditorChange = useCallback(
    (value) => {
      if (!activeFile) return;
      setModified((prev) => new Set([...prev, activeFile.path]));
    },
    [activeFile]
  );

  const activeFileData = openFiles.find((f) => f.path === activeFile?.path);
  const langInfo = activeFileData ? getLanguageFromFilename(activeFileData.name) : null;

  return (
    <div className="editor-panel" id="editor-panel">
      {/* Tab Bar */}
      {openFiles.length > 0 && (
        <div className="tab-bar" id="tab-bar">
          {openFiles.map((file) => {
            const info = getLanguageFromFilename(file.name);
            const isActive = activeFile?.path === file.path;
            const isModified = modified.has(file.path);

            return (
              <button
                key={file.path}
                className={`tab ${isActive ? 'active' : ''}`}
                onClick={() => onFileChange(file)}
                title={file.path}
                id={`tab-${file.path.replace(/[\/\\\.]/g, '-')}`}
              >
                <span className="tab-icon">{info.icon}</span>
                <span className="tab-name">{file.name}</span>
                {isModified && <span className="tab-modified" title="Unsaved changes" />}
                <button
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseFile(file);
                  }}
                  title="Close"
                >
                  <VscClose />
                </button>
              </button>
            );
          })}
        </div>
      )}

      {/* Editor Area */}
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
              minimap: { enabled: settings?.minimap !== false },
              wordWrap: settings?.wordWrap || 'on',
            }}

            loading={
              <div className="empty-state">
                <div className="spinner" />
                <p>Loading editor...</p>
              </div>
            }
          />
        ) : (
          <div className="editor-welcome">
            <div className="editor-welcome-logo">⚡</div>
            <h2>Cloud IDE</h2>
            <p>Open a file from the explorer to start editing, or create a new project.</p>
            <div className="editor-welcome-shortcuts">
              <div className="editor-welcome-shortcut">
                <kbd>Ctrl</kbd>+<kbd>S</kbd>
                <span>Save file</span>
              </div>
              <div className="editor-welcome-shortcut">
                <kbd>Ctrl</kbd>+<kbd>Z</kbd>
                <span>Undo</span>
              </div>
              <div className="editor-welcome-shortcut">
                <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>
                <span>Format code</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
