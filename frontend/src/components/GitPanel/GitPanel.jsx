import React, { useState, useEffect, useCallback } from 'react';
import { VscGitCommit, VscRefresh, VscAdd, VscDiscard, VscDiff, VscCloudUpload, VscRepo } from 'react-icons/vsc';
import { gitAPI } from '../../utils/api';
import { useToast } from '../common/Toast';
import './GitPanel.css';

export default function GitPanel({ project }) {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [diff, setDiff] = useState(null);
  const [diffFile, setDiffFile] = useState(null);

  const loadStatus = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      const data = await gitAPI.status(project);
      setStatus(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load git status');
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    setStatus(null);
    setDiff(null);
    setDiffFile(null);
    loadStatus();
  }, [project]);

  const handleInit = async () => {
    setInitializing(true);
    try {
      await gitAPI.init(project);
      toast.success('Git repository initialized');
      loadStatus();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setInitializing(false);
    }
  };

  const handleStageAll = async () => {
    try {
      await gitAPI.stage(project, ['.']);
      toast.success('All changes staged');
      loadStatus();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStageFile = async (filepath) => {
    try {
      await gitAPI.stage(project, [filepath]);
      loadStatus();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUnstageFile = async (filepath) => {
    try {
      await gitAPI.unstage(project, [filepath]);
      loadStatus();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCommit = async () => {
    if (!commitMsg.trim()) {
      toast.warning('Please enter a commit message');
      return;
    }
    setCommitting(true);
    try {
      await gitAPI.commit(project, commitMsg.trim());
      toast.success('Committed successfully');
      setCommitMsg('');
      loadStatus();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCommitting(false);
    }
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      await gitAPI.push(project);
      toast.success('Pushed to remote');
      loadStatus();
    } catch (err) {
      toast.error(err.message || 'Push failed. Check remote configuration.');
    } finally {
      setPushing(false);
    }
  };

  const handleShowDiff = async (filepath, staged = false) => {
    try {
      const data = await gitAPI.diff(project, filepath, staged);
      setDiff(data.diff);
      setDiffFile(`${staged ? '[staged] ' : ''}${filepath}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!project) {
    return (
      <div className="git-panel">
        <div className="git-empty">
          <VscRepo size={32} style={{ opacity: 0.3 }} />
          <p>Open a project to use Source Control</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="git-panel">
        <div className="git-panel-header">
          <h3>Source Control</h3>
        </div>
        <div className="git-empty">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!status.initialized) {
    return (
      <div className="git-panel">
        <div className="git-panel-header">
          <h3>Source Control</h3>
        </div>
        <div className="git-empty">
          <VscRepo size={32} style={{ opacity: 0.3 }} />
          <p>Not a Git repository</p>
          <button
            className="btn btn-primary"
            onClick={handleInit}
            disabled={initializing}
            style={{ marginTop: '12px' }}
          >
            {initializing ? 'Initializing...' : 'Initialize Repository'}
          </button>
        </div>
      </div>
    );
  }

  const staged = status.files.filter((f) => f.staged);
  const unstaged = status.files.filter((f) => !f.staged);

  return (
    <div className="git-panel">
      <div className="git-panel-header">
        <h3>Source Control</h3>
        <div className="git-header-actions">
          <button className="git-icon-btn" onClick={loadStatus} title="Refresh" disabled={loading}>
            <VscRefresh className={loading ? 'spin' : ''} />
          </button>
          <button className="git-icon-btn" onClick={handlePush} title="Push" disabled={pushing}>
            <VscCloudUpload />
          </button>
        </div>
      </div>

      {/* Branch Info */}
      <div className="git-branch-bar">
        <VscGitCommit />
        <span className="git-branch-name">{status.branch || 'HEAD'}</span>
        {status.ahead > 0 && (
          <span className="git-badge git-ahead" title={`${status.ahead} commit(s) ahead`}>
            ↑{status.ahead}
          </span>
        )}
        {status.behind > 0 && (
          <span className="git-badge git-behind" title={`${status.behind} commit(s) behind`}>
            ↓{status.behind}
          </span>
        )}
      </div>

      {/* Commit Input */}
      <div className="git-commit-section">
        <textarea
          className="git-commit-input"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="Commit message (press Ctrl+Enter to commit)"
          rows={2}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleCommit();
          }}
        />
        <div className="git-commit-actions">
          <button
            className="btn btn-primary git-commit-btn"
            onClick={handleCommit}
            disabled={committing || staged.length === 0 || !commitMsg.trim()}
          >
            <VscGitCommit />
            {committing ? 'Committing...' : 'Commit'}
          </button>
          {unstaged.length > 0 && (
            <button className="git-icon-btn" onClick={handleStageAll} title="Stage All Changes">
              <VscAdd /> Stage All
            </button>
          )}
        </div>
      </div>

      {/* File Groups */}
      {staged.length > 0 && (
        <GitFileGroup
          title={`Staged Changes (${staged.length})`}
          files={staged}
          staged
          onStage={handleStageFile}
          onUnstage={handleUnstageFile}
          onDiff={handleShowDiff}
        />
      )}

      {unstaged.length > 0 && (
        <GitFileGroup
          title={`Changes (${unstaged.length})`}
          files={unstaged}
          staged={false}
          onStage={handleStageFile}
          onUnstage={handleUnstageFile}
          onDiff={handleShowDiff}
        />
      )}

      {staged.length === 0 && unstaged.length === 0 && (
        <div className="git-empty" style={{ marginTop: '24px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No changes — working tree clean</p>
        </div>
      )}

      {/* Diff Viewer */}
      {diff !== null && (
        <div className="git-diff-overlay">
          <div className="git-diff-header">
            <span className="git-diff-title">{diffFile}</span>
            <button className="git-icon-btn" onClick={() => setDiff(null)}>✕</button>
          </div>
          <pre className="git-diff-content">{diff || 'No diff available'}</pre>
        </div>
      )}
    </div>
  );
}

function GitFileGroup({ title, files, staged, onStage, onUnstage, onDiff }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="git-file-group">
      <div className="git-file-group-header" onClick={() => setCollapsed(!collapsed)}>
        <span className={`git-group-arrow ${collapsed ? '' : 'open'}`}>▶</span>
        <span>{title}</span>
      </div>
      {!collapsed &&
        files.map((f) => (
          <div key={f.path} className="git-file-row">
            <span className={`git-file-status git-status-${getStatusClass(f.status)}`}>
              {getStatusLabel(f.status)}
            </span>
            <span className="git-file-path" title={f.path}>
              {f.path.split('/').pop()}
              {f.path.includes('/') && (
                <span className="git-file-dir"> {f.path.split('/').slice(0, -1).join('/')}</span>
              )}
            </span>
            <div className="git-file-actions">
              <button
                className="git-icon-btn git-file-btn"
                title="Show diff"
                onClick={() => onDiff(f.path, staged)}
              >
                <VscDiff />
              </button>
              {staged ? (
                <button
                  className="git-icon-btn git-file-btn"
                  title="Unstage"
                  onClick={() => onUnstage(f.path)}
                >
                  <VscDiscard />
                </button>
              ) : (
                <button
                  className="git-icon-btn git-file-btn"
                  title="Stage"
                  onClick={() => onStage(f.path)}
                >
                  <VscAdd />
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

function getStatusLabel(status) {
  const map = {
    'M ': 'M', ' M': 'M', 'MM': 'M',
    'A ': 'A', 'AM': 'A',
    'D ': 'D', ' D': 'D',
    'R ': 'R', 'RM': 'R',
    'C ': 'C',
    '??': 'U',
    '!!': '!',
  };
  return map[status] || status[0] || '?';
}

function getStatusClass(status) {
  const first = (status || '').trim()[0] || '?';
  const map = { M: 'modified', A: 'added', D: 'deleted', R: 'renamed', '?': 'untracked' };
  return map[first] || 'other';
}
