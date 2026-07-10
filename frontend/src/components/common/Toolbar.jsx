import React, { useState, useEffect, useRef } from 'react';
import { VscDebugStart, VscDebugStop, VscDebugRestart, VscChevronDown, VscFiles } from 'react-icons/vsc';
import './common.css';

export default function Toolbar({
  project,
  processStatus,
  onProcessAction,
  onOpenProjectManager,
  onCloseProject,
  onOpenSettings,
  onOpenLocalProject,
  onToggleSidebar,
  userEmail,
  onLogout,
}) {
  const isRunning = processStatus?.is_running;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="toolbar" id="toolbar">
      <div className="toolbar-left">
        <div className="file-menu-container" ref={dropdownRef}>
          <button
            className="file-menu-btn"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            title="File menu"
          >
            File <VscChevronDown size={12} />
          </button>
          
          {isDropdownOpen && (
            <div className="file-menu-dropdown animate-scale-in">
              {userEmail && (
                <div className="file-menu-user" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)', userSelect: 'none', wordBreak: 'break-all' }}>
                  👤 {userEmail}
                </div>
              )}
              <button
                className="file-menu-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onOpenProjectManager();
                }}
              >
                📂 Open Project...
              </button>
              <button
                className="file-menu-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onOpenLocalProject();
                }}
              >
                📁 Open Local Folder...
              </button>
              {project && (
                <>
                  <div className="file-menu-separator" />
                  <button
                    className="file-menu-item"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onCloseProject();
                    }}
                  >
                    ❌ Close Project
                  </button>
                </>
              )}
              <div className="file-menu-separator" />
              <button
                className="file-menu-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onLogout();
                }}
                style={{ color: '#FF5A5A' }}
              >
                🚪 Log Out
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-project-name">
          {project ? (
            <>
              <span 
                className="project-title-label"
                onClick={onOpenProjectManager}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Click to open Project Manager"
              >
                📂 {project}
              </span>
              {isRunning && <span className="project-badge">Running</span>}
            </>
          ) : (
            <button 
              className="toolbar-open-project-btn"
              onClick={onOpenProjectManager}
              title="Open Project Manager"
            >
              🚀 Open Project
            </button>
          )}
        </div>
      </div>

      <div className="toolbar-center">
        <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px' }}>
          <span style={{
            background: 'var(--gradient-accent)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            ⚡ Cloud IDE
          </span>
        </span>
      </div>

      <div className="toolbar-right">
        {project && (
          <div className="toolbar-run-group">
            <span className={`toolbar-status-dot ${isRunning ? 'running' : 'stopped'}`} />

            {isRunning ? (
              <>
                <button
                  className="toolbar-run-btn restart"
                  onClick={() => onProcessAction('restart')}
                  title="Restart Server"
                >
                  <VscDebugRestart /> Restart
                </button>
                <button
                  className="toolbar-run-btn stop"
                  onClick={() => onProcessAction('stop')}
                  title="Stop Server"
                >
                  <VscDebugStop /> Stop
                </button>
              </>
            ) : (
              <button
                className="toolbar-run-btn run"
                onClick={() => onProcessAction('start')}
                title="Start Server"
              >
                <VscDebugStart /> Run
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
