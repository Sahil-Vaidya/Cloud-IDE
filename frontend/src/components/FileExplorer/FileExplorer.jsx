import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  VscNewFile,
  VscNewFolder,
  VscRefresh,
  VscChevronRight,
  VscFolder,
  VscFolderOpened,
  VscEdit,
  VscTrash,
  VscClose,
} from 'react-icons/vsc';
import { getLanguageFromFilename } from '../../utils/languageMap';
import { fileAPI } from '../../utils/api';
import { useToast } from '../common/Toast';
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
  renamingNode,
  onRenameSubmit,
  onRenameCancel,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}) {
  const isDir = node.type === 'directory';
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = selectedFile === node.path;
  const isRenaming = renamingNode === node.path;

  return (
    <div className="tree-node">
      <div
        className={`tree-node-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => (isDir ? onToggleDir(node.path) : onFileSelect(node))}
        onContextMenu={(e) => onContextMenu(e, node)}
        draggable={!isRenaming}
        onDragStart={(e) => onDragStart(e, node)}
        onDragOver={(e) => onDragOver(e, node)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, node)}
        onDragEnd={onDragEnd}
      >
        <span className={`tree-node-arrow ${isDir ? (isExpanded ? 'expanded' : '') : 'hidden'}`}>
          <VscChevronRight />
        </span>
        <span className="tree-node-icon">
          <FileIcon name={node.name} isDirectory={isDir} isOpen={isExpanded} />
        </span>
        {isRenaming ? (
          <InlineInput
            initialValue={node.name}
            onSubmit={(newName) => onRenameSubmit(node, newName)}
            onCancel={onRenameCancel}
          />
        ) : (
          <span className="tree-node-name">{node.name}</span>
        )}
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
              renamingNode={renamingNode}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main File Explorer Component ──────────────────────────────

export default function FileExplorer({ project, fileTree, selectedFile, onFileSelect, onRefresh, onFileDelete, onFileRename }) {
  const toast = useToast();
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  // contextMenu: { x, y, node, confirmDelete: bool }
  const [contextMenu, setContextMenu] = useState(null);
  const [creatingItem, setCreatingItem] = useState(null);
  const [renamingNode, setRenamingNode] = useState(null);
  const contextMenuRef = useRef(null);

  // Drag and Drop Ref
  const draggedNodeRef = useRef(null);

  const handleDragStart = useCallback((e, node) => {
    draggedNodeRef.current = node;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.path);
    e.currentTarget.classList.add('dragging');
  }, []);

  const handleDragOver = useCallback((e, node) => {
    const sourceNode = draggedNodeRef.current;
    if (!sourceNode || sourceNode.path === node.path) return;
    // Prevent dragging a folder into its own children/descendants
    if (sourceNode.type === 'directory' && node.path.startsWith(sourceNode.path + '/')) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.currentTarget.classList.remove('drag-over');
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.classList.remove('dragging');
    draggedNodeRef.current = null;
  }, []);

  const handleDrop = useCallback(
    async (e, targetNode) => {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
      const sourceNode = draggedNodeRef.current;
      if (!sourceNode || sourceNode.path === targetNode.path) return;

      // Determine destination path: folder drops inside, file drops in parent directory
      let destParentPath = '';
      if (targetNode.type === 'directory') {
        destParentPath = targetNode.path;
      } else {
        const parts = targetNode.path.split('/');
        parts.pop();
        destParentPath = parts.join('/');
      }

      const newPath = destParentPath ? `${destParentPath}/${sourceNode.name}` : sourceNode.name;
      if (newPath === sourceNode.path) return;

      try {
        await fileAPI.renameItem(project, sourceNode.path, newPath);
        toast.success(`Moved "${sourceNode.name}" to "${destParentPath || 'Root'}"`);
        if (onFileRename) {
          onFileRename(sourceNode.path, newPath, sourceNode.type === 'directory');
        }
        onRefresh();
      } catch (err) {
        toast.error(`Move failed: ${err.message}`);
      }
    },
    [project, onRefresh, toast, onFileRename]
  );

  // Close context menu when clicking OUTSIDE of it
  useEffect(() => {
    const handler = (e) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target)) {
        return; // click inside context menu — keep it open
      }
      setContextMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
      confirmDelete: false,
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
      if (!name || !name.trim() || !creatingItem) {
        setCreatingItem(null);
        return;
      }
      const trimmedName = name.trim();
      const path = creatingItem.parentPath ? `${creatingItem.parentPath}/${trimmedName}` : trimmedName;
      try {
        await fileAPI.createItem(project, path, creatingItem.type);
        toast.success(`Created "${trimmedName}"`);
        onRefresh();
      } catch (err) {
        toast.error(`Failed to create: ${err.message}`);
      }
      setCreatingItem(null);
    },
    [project, creatingItem, onRefresh, toast]
  );

  const handleRename = useCallback((node) => {
    setRenamingNode(node.path);
    setContextMenu(null);
  }, []);

  const handleRenameSubmit = useCallback(
    async (node, newName) => {
      if (!newName || newName === node.name) {
        setRenamingNode(null);
        return;
      }
      const parentDir = node.path.includes('/')
        ? node.path.substring(0, node.path.lastIndexOf('/'))
        : '';
      const newPath = parentDir ? `${parentDir}/${newName}` : newName;
      try {
        await fileAPI.renameItem(project, node.path, newPath);
        toast.success(`Renamed to "${newName}"`);
        if (onFileRename) {
          onFileRename(node.path, newPath, node.type === 'directory');
        }
        onRefresh();
      } catch (err) {
        toast.error(`Rename failed: ${err.message}`);
      }
      setRenamingNode(null);
    },
    [project, onRefresh, toast, onFileRename]
  );

  const handleRenameCancel = useCallback(() => setRenamingNode(null), []);

  // Step 1: Show inline confirm inside context menu
  const handleDeleteRequest = useCallback(() => {
    setContextMenu((prev) => prev ? { ...prev, confirmDelete: true } : null);
  }, []);

  // Step 2: Perform the actual delete
  const handleDeleteConfirm = useCallback(
    async (node) => {
      setContextMenu(null);
      try {
        await fileAPI.deleteItem(project, node.path);
        toast.success(`Deleted "${node.name}"`);
        if (onFileDelete) {
          onFileDelete(node.path, node.type === 'directory');
        }
        onRefresh();
      } catch (err) {
        toast.error(`Delete failed: ${err.message}`);
      }
    },
    [project, onRefresh, toast, onFileDelete]
  );

  // Handle global Delete key press to delete selected item
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Delete') {
        const activeElement = document.activeElement;
        const isInput = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.hasAttribute('contenteditable') ||
          activeElement.className?.includes?.('monaco-editor') ||
          !!activeElement.closest?.('.monaco-editor')
        );
        if (selectedFile && !isInput && !renamingNode && !creatingItem) {
          e.preventDefault();
          const findNodeByPath = (nodes, targetPath) => {
            if (!nodes) return null;
            for (const node of nodes) {
              if (node.path === targetPath) return node;
              if (node.children) {
                const found = findNodeByPath(node.children, targetPath);
                if (found) return found;
              }
            }
            return null;
          };
          const node = findNodeByPath(fileTree, selectedFile);
          if (node) {
            // Show inline confirm at a sensible position
            const el = document.getElementById('file-explorer');
            const rect = el ? el.getBoundingClientRect() : { left: 260, top: 100 };
            setContextMenu({
              x: rect.left + 20,
              y: rect.top + 60,
              node,
              confirmDelete: true,
            });
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedFile, fileTree, renamingNode, creatingItem]);

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
                  renamingNode={renamingNode}
                  onRenameSubmit={handleRenameSubmit}
                  onRenameCancel={handleRenameCancel}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
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
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.confirmDelete ? (
            /* Inline delete confirmation — avoids window.confirm() timing bugs */
            <div className="context-menu-confirm">
              <div className="context-menu-confirm-text">
                Delete &ldquo;{contextMenu.node.name}&rdquo;?
              </div>
              <div className="context-menu-confirm-actions">
                <button
                  className="context-menu-confirm-btn danger"
                  onClick={() => handleDeleteConfirm(contextMenu.node)}
                >
                  <VscTrash /> Delete
                </button>
                <button
                  className="context-menu-confirm-btn"
                  onClick={() => setContextMenu(null)}
                >
                  <VscClose /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {contextMenu.node.type === 'directory' && (
                <>
                  <div className="context-menu-item" onClick={() => handleCreateFile(contextMenu.node.path)}>
                    <VscNewFile /> New File
                  </div>
                  <div className="context-menu-item" onClick={() => handleCreateFolder(contextMenu.node.path)}>
                    <VscNewFolder /> New Folder
                  </div>
                  <div className="context-menu-separator" />
                </>
              )}
              <div className="context-menu-item" onClick={() => handleRename(contextMenu.node)}>
                <VscEdit /> Rename
              </div>
              <div className="context-menu-separator" />
              <div
                className="context-menu-item danger"
                onClick={handleDeleteRequest}
              >
                <VscTrash /> Delete
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inline Input for Creating Files/Folders ────────────────────

function InlineInput({ onSubmit, onCancel, initialValue = '' }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      if (!submittedRef.current) {
        submittedRef.current = true;
        onSubmit(value);
      }
    } else if (e.key === 'Escape') {
      if (!submittedRef.current) {
        submittedRef.current = true;
        onCancel();
      }
    }
  };

  const handleBlur = () => {
    if (!submittedRef.current) {
      submittedRef.current = true;
      onSubmit(value);
    }
  };

  return (
    <div className="tree-inline-input">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="Enter name..."
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

