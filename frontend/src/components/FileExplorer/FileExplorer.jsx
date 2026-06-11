import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  VscNewFile,
  VscNewFolder,
  VscRefresh,
  VscChevronRight,
  VscFolder,
  VscFolderOpened,
} from 'react-icons/vsc';
import { getLanguageFromFilename } from '../../utils/languageMap';
import { fileAPI } from '../../utils/api';
import './FileExplorer.css';

// ─── File/Folder Icon Component ────────────────────────────────

function FileIcon({ name, isDirectory, isOpen }) {
  if (isDirectory) {
    return isOpen ? (
      <VscFolderOpened style={{ color: '#dcb67a' }} />
    ) : (
      <VscFolder style={{ color: '#dcb67a' }} />
    );
  }
  const info = getLanguageFromFilename(name);
  return <span>{info.icon}</span>;
}

// ─── Tree Node Component ───────────────────────────────────────

function TreeNode({
  node,
  depth = 0,
  selectedFile,
  expandedDirs,
  onFileSelect,
  onToggleDir,
  onContextMenu,
}) {
  const isDir = node.type === 'directory';
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = selectedFile === node.path;

  return (
    <div className="tree-node">
      <div
        className={`tree-node-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => (isDir ? onToggleDir(node.path) : onFileSelect(node))}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        <span className={`tree-node-arrow ${isDir ? (isExpanded ? 'expanded' : '') : 'hidden'}`}>
          <VscChevronRight />
        </span>
        <span className="tree-node-icon">
          <FileIcon name={node.name} isDirectory={isDir} isOpen={isExpanded} />
        </span>
        <span className="tree-node-name">{node.name}</span>
      </div>

      {isDir && isExpanded && node.children && (
        <div className="tree-node-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              expandedDirs={expandedDirs}
              onFileSelect={onFileSelect}
              onToggleDir={onToggleDir}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main File Explorer Component ──────────────────────────────

export default function FileExplorer({ project, fileTree, selectedFile, onFileSelect, onRefresh }) {
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [contextMenu, setContextMenu] = useState(null);
  const [creatingItem, setCreatingItem] = useState(null); // { type: 'file' | 'directory', parentPath: '' }
  const inputRef = useRef(null);

  // Close context menu on outside click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const toggleDir = useCallback((path) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e, node) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
    });
  }, []);

  const handleCreateFile = useCallback(
    (parentPath = '') => {
      setCreatingItem({ type: 'file', parentPath });
      setContextMenu(null);
      if (parentPath) {
        setExpandedDirs((prev) => new Set([...prev, parentPath]));
      }
    },
    []
  );

  const handleCreateFolder = useCallback(
    (parentPath = '') => {
      setCreatingItem({ type: 'directory', parentPath });
      setContextMenu(null);
      if (parentPath) {
        setExpandedDirs((prev) => new Set([...prev, parentPath]));
      }
    },
    []
  );

  const handleCreateSubmit = useCallback(
    async (name) => {
      if (!name || !creatingItem) return;
      const path = creatingItem.parentPath ? `${creatingItem.parentPath}/${name}` : name;
      try {
        await fileAPI.createItem(project, path, creatingItem.type);
        onRefresh();
      } catch (err) {
        console.error('Failed to create item:', err);
      }
      setCreatingItem(null);
    },
    [project, creatingItem, onRefresh]
  );

  const handleDelete = useCallback(
    async (node) => {
      if (!window.confirm(`Delete "${node.name}"? This cannot be undone.`)) return;
      try {
        await fileAPI.deleteItem(project, node.path);
        onRefresh();
      } catch (err) {
        console.error('Failed to delete:', err);
      }
      setContextMenu(null);
    },
    [project, onRefresh]
  );

  return (
    <div className="file-explorer" id="file-explorer">
      <div className="file-explorer-header">
        <h3>{project || 'Explorer'}</h3>
        <div className="file-explorer-actions">
          <button onClick={() => handleCreateFile('')} title="New File">
            <VscNewFile />
          </button>
          <button onClick={() => handleCreateFolder('')} title="New Folder">
            <VscNewFolder />
          </button>
          <button onClick={onRefresh} title="Refresh">
            <VscRefresh />
          </button>
        </div>
      </div>

      <div className="file-tree" id="file-tree">
        {fileTree && fileTree.length > 0 ? (
          <>
            {creatingItem && !creatingItem.parentPath && (
              <InlineInput onSubmit={handleCreateSubmit} onCancel={() => setCreatingItem(null)} />
            )}
            {fileTree.map((node) => (
              <React.Fragment key={node.path}>
                <TreeNode
                  node={node}
                  selectedFile={selectedFile}
                  expandedDirs={expandedDirs}
                  onFileSelect={onFileSelect}
                  onToggleDir={toggleDir}
                  onContextMenu={handleContextMenu}
                />
                {creatingItem && creatingItem.parentPath === node.path && node.type === 'directory' && (
                  <div style={{ paddingLeft: '32px' }}>
                    <InlineInput onSubmit={handleCreateSubmit} onCancel={() => setCreatingItem(null)} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </>
        ) : (
          <div className="file-explorer-empty">
            <VscFolder style={{ fontSize: 32, opacity: 0.3 }} />
            <p>No files yet</p>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.node.type === 'directory' && (
            <>
              <div
                className="context-menu-item"
                onClick={() => handleCreateFile(contextMenu.node.path)}
              >
                <VscNewFile /> New File
              </div>
              <div
                className="context-menu-item"
                onClick={() => handleCreateFolder(contextMenu.node.path)}
              >
                <VscNewFolder /> New Folder
              </div>
              <div className="context-menu-separator" />
            </>
          )}
          <div
            className="context-menu-item danger"
            onClick={() => handleDelete(contextMenu.node)}
          >
            Delete
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline Input for Creating Files/Folders ────────────────────

function InlineInput({ onSubmit, onCancel }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSubmit(value);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="tree-inline-input">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => (value ? onSubmit(value) : onCancel())}
        placeholder="Enter name..."
      />
    </div>
  );
}
