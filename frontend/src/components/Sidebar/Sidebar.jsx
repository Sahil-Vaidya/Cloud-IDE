import React from 'react';
import {
  VscFiles,
  VscTerminal,
  VscDatabase,
  VscOpenPreview,
  VscSettingsGear,
  VscProject,
} from 'react-icons/vsc';
import './Sidebar.css';

const SIDEBAR_ITEMS = [
  { id: 'explorer', icon: VscFiles, label: 'Explorer' },
  { id: 'terminal', icon: VscTerminal, label: 'Terminal' },
  { id: 'database', icon: VscDatabase, label: 'Database' },
  { id: 'preview', icon: VscOpenPreview, label: 'Preview' },
];

export default function Sidebar({ activePanel, onPanelChange, onOpenProjectManager, onOpenSettings }) {
  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-logo" title="Cloud IDE">⚡</div>

      <div className="sidebar-top">
        <button
          className="sidebar-btn"
          onClick={onOpenProjectManager}
          title="Projects"
          id="sidebar-btn-projects"
        >
          <VscProject />
          <span className="tooltip-text">Projects</span>
        </button>

        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-btn ${activePanel === item.id ? 'active' : ''}`}
            onClick={() => onPanelChange(item.id)}
            title={item.label}
            id={`sidebar-btn-${item.id}`}
          >
            <item.icon />
            <span className="tooltip-text">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-bottom">
        <button
          className="sidebar-btn"
          title="Settings"
          id="sidebar-btn-settings"
          onClick={onOpenSettings}
        >
          <VscSettingsGear />
          <span className="tooltip-text">Settings</span>
        </button>
      </div>

    </aside>
  );
}
