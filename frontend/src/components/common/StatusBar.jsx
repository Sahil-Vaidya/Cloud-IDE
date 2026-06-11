import React from 'react';
import { getLanguageName } from '../../utils/languageMap';
import './common.css';

export default function StatusBar({ project, activeFile, processStatus }) {
  const isRunning = processStatus?.is_running;

  return (
    <div className="statusbar" id="statusbar">
      <div className="statusbar-left">
        <div className="statusbar-item">
          <span className={`status-indicator ${isRunning ? 'active' : 'inactive'}`} />
          {isRunning ? `Server running (PID: ${processStatus.pid})` : 'Server stopped'}
        </div>
        {activeFile && (
          <div className="statusbar-item">
            📄 {activeFile.path}
          </div>
        )}
      </div>

      <div className="statusbar-right">
        {activeFile && (
          <div className="statusbar-item">
            {getLanguageName(activeFile.name?.split('.').pop())}
          </div>
        )}
        <div className="statusbar-item">
          UTF-8
        </div>
        <div className="statusbar-item statusbar-powered">
          Cloud IDE v1.0
        </div>
      </div>
    </div>
  );
}
