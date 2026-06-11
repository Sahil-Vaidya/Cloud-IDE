import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VscClose, VscTrash } from 'react-icons/vsc';
import { projectAPI } from '../../utils/api';
import { PROJECT_TEMPLATES } from '../../utils/constants';
import './ProjectManager.css';

export default function ProjectManager({ isOpen, onClose, onProjectOpen, onOpenLocalProject, currentProject, initialTab = 'open' }) {
  const [tab, setTab] = useState('open'); // 'open' | 'local' | 'create' | 'clone'
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create form state
  const [projectName, setProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('blank');

  // Clone form state
  const [cloneName, setCloneName] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');

  // Manual local folder state
  const [localPath, setLocalPath] = useState('');

  // Reference for directory selector input
  const fileInputRef = useRef(null);

  // Load projects
  useEffect(() => {
    if (isOpen) {
      loadProjects();
      setTab(initialTab || 'open');
    }
  }, [isOpen, initialTab]);

  const loadProjects = async () => {
    try {
      const data = await projectAPI.list();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreate = useCallback(async () => {
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await projectAPI.create(projectName.trim(), selectedTemplate);
      onProjectOpen(projectName.trim());
      setProjectName('');
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [projectName, selectedTemplate, onProjectOpen, onClose]);

  const handleClone = useCallback(async () => {
    if (!cloneName.trim() || !cloneUrl.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await projectAPI.clone(cloneName.trim(), cloneUrl.trim());
      onProjectOpen(cloneName.trim());
      setCloneName('');
      setCloneUrl('');
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [cloneName, cloneUrl, onProjectOpen, onClose]);

  const handleOpenLocal = useCallback(() => {
    if (!localPath.trim()) {
      setError('Please enter a folder path');
      return;
    }
    onOpenLocalProject(localPath.trim());
    setLocalPath('');
    onClose();
  }, [localPath, onOpenLocalProject, onClose]);

  const handleDirectoryUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Get the root folder name from the first file path
    const firstFile = files[0];
    const relativePath = firstFile.webkitRelativePath || '';
    const folderName = relativePath.split('/')[0] || 'local-project';

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('project_name', folderName);

    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i], files[i].webkitRelativePath || files[i].name);
    }

    try {
      const response = await fetch('http://localhost:8000/api/projects/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to upload folder files');
      }

      const data = await response.json();
      onProjectOpen(data.name);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = useCallback(
    async (name, e) => {
      e.stopPropagation();
      if (!window.confirm(`Delete project "${name}"? This will delete all files permanently.`)) return;
      try {
        await projectAPI.delete(name);
        loadProjects();
        if (currentProject === name) {
          onProjectOpen('');
        }
      } catch (err) {
        setError(err.message);
      }
    },
    [currentProject, onProjectOpen]
  );

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="project-manager-overlay" onClick={onClose}>
      <div className="project-manager" onClick={(e) => e.stopPropagation()}>
        <div className="project-manager-header">
          <h2>⚡ Project Manager</h2>
          <button className="project-manager-close" onClick={onClose}>
            <VscClose />
          </button>
        </div>

        <div className="project-manager-body">
          {/* Tabs */}
          <div className="pm-tabs">
            <button
              className={`pm-tab ${tab === 'open' ? 'active' : ''}`}
              onClick={() => { setTab('open'); setError(''); }}
            >
              Open Project
            </button>
            <button
              className={`pm-tab ${tab === 'local' ? 'active' : ''}`}
              onClick={() => { setTab('local'); setError(''); }}
            >
              Open Local Folder
            </button>
            <button
              className={`pm-tab ${tab === 'create' ? 'active' : ''}`}
              onClick={() => { setTab('create'); setError(''); }}
            >
              New Project
            </button>
            <button
              className={`pm-tab ${tab === 'clone' ? 'active' : ''}`}
              onClick={() => { setTab('clone'); setError(''); }}
            >
              Clone from GitHub
            </button>
          </div>

          {error && <div className="pm-error">{error}</div>}

          {/* Open Project Tab */}
          {tab === 'open' && (
            <div className="pm-project-list">
              {projects.length > 0 ? (
                projects.map((p) => (
                  <div
                    key={p.name}
                    className="pm-project-item"
                    onClick={() => {
                      onProjectOpen(p.name);
                      onClose();
                    }}
                  >
                    <div className="pm-project-info">
                      <span className="pm-project-name">{p.name}</span>
                      <span className="pm-project-meta">
                        {p.file_count} files · {formatSize(p.size)}
                      </span>
                    </div>
                    <div className="pm-project-actions">
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={(e) => handleDelete(p.name, e)}
                        title="Delete project"
                      >
                        <VscTrash />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="db-empty" style={{ padding: '40px' }}>
                  <p>No projects yet. Create one, open a local directory, or clone from GitHub!</p>
                </div>
              )}
            </div>
          )}

          {/* Open Local Folder Tab */}
          {tab === 'local' && (
            <div className="pm-form">
              <div className="pm-form-group">
                <label>Select & Upload Directory</label>
                
                {/* Hidden input for webkitdirectory */}
                <input
                  type="file"
                  ref={fileInputRef}
                  webkitdirectory="true"
                  directory="true"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleDirectoryUpload}
                />
                
                <button
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '16px',
                    fontSize: '14px',
                    width: '100%',
                    marginTop: '8px'
                  }}
                  disabled={loading}
                >
                  {loading ? 'Uploading Folder...' : '📂 Choose Local Folder from Device'}
                </button>
                <span className="setting-description" style={{ marginTop: '8px', textAlign: 'center', display: 'block' }}>
                  Clicking this will open your device's native folder explorer and ask for directory permission.
                </span>
              </div>

              <div className="file-menu-separator" style={{ margin: '20px 0' }} />

              <div className="pm-form-group">
                <label>Or Enter Absolute Path Manually</label>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <input
                    className="input"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    placeholder="e.g. D:\Yuvro Assesment"
                    onKeyDown={(e) => e.key === 'Enter' && handleOpenLocal()}
                    style={{ flex: 1 }}
                    disabled={loading}
                  />
                  <button
                    className="btn"
                    onClick={async () => {
                      setError('');
                      try {
                        const res = await projectAPI.selectLocal();
                        if (res.status === 'selected' && res.path) {
                          setLocalPath(res.path);
                        }
                      } catch (err) {
                        setError('Failed to open native dialog. Please enter the path manually.');
                      }
                    }}
                    type="button"
                    style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    disabled={loading}
                  >
                    📁 Browse PC
                  </button>
                </div>
                <span className="setting-description" style={{ marginTop: '4px' }}>
                  Optionally, enter the path manually or click Browse PC to choose a directory on the server.
                </span>
              </div>

              <div className="pm-form-actions">
                <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleOpenLocal}
                  disabled={loading || !localPath.trim()}
                >
                  Open Path
                </button>
              </div>
            </div>
          )}

          {/* Create Project Tab */}
          {tab === 'create' && (
            <div className="pm-form">
              <div className="pm-form-group">
                <label>Project Name</label>
                <input
                  className="input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="my-awesome-project"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>

              <div className="pm-form-group">
                <label>Template</label>
                <div className="pm-templates">
                  {PROJECT_TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className={`pm-template-card ${selectedTemplate === tmpl.id ? 'selected' : ''}`}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                    >
                      <div className="pm-template-icon">{tmpl.icon}</div>
                      <div className="pm-template-name">{tmpl.name}</div>
                      <div className="pm-template-desc">{tmpl.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pm-form-actions">
                <button className="btn" onClick={onClose}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleCreate}
                  disabled={loading || !projectName.trim()}
                >
                  {loading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          )}

          {/* Clone Project Tab */}
          {tab === 'clone' && (
            <div className="pm-form">
              <div className="pm-form-group">
                <label>Project Name</label>
                <input
                  className="input"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="my-cloned-project"
                />
              </div>

              <div className="pm-form-group">
                <label>GitHub URL</label>
                <input
                  className="input"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  placeholder="https://github.com/username/repo.git"
                  onKeyDown={(e) => e.key === 'Enter' && handleClone()}
                />
              </div>

              <div className="pm-form-actions">
                <button className="btn" onClick={onClose}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleClone}
                  disabled={loading || !cloneName.trim() || !cloneUrl.trim()}
                >
                  {loading ? 'Cloning...' : 'Clone Repository'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
