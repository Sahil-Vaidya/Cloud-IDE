import React, { useState, useRef } from 'react';
import { VscRefresh, VscScreenFull, VscOpenPreview } from 'react-icons/vsc';
import './Preview.css';

const DEVICE_SIZES = {
  desktop: { width: '100%', label: 'Desktop' },
  tablet: { width: '768px', label: 'Tablet' },
  mobile: { width: '375px', label: 'Mobile' },
};

export default function PreviewPanel({ project, processStatus }) {
  const [device, setDevice] = useState('desktop');
  const [url, setUrl] = useState('');
  const iframeRef = useRef(null);

  const isRunning = processStatus?.is_running;
  const port = processStatus?.port || 8080;
  const previewUrl = url || (isRunning ? `http://localhost:${port}` : '');

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  return (
    <div className="preview-panel" id="preview-panel">
      <div className="preview-header">
        <div className="preview-actions">
          <button onClick={handleRefresh} title="Refresh">
            <VscRefresh />
          </button>
        </div>

        <div className="preview-url-bar">
          <span className="lock-icon">🔒</span>
          <input
            value={previewUrl}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:8080"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setUrl(e.target.value);
              }
            }}
          />
        </div>

        <div className="preview-device-frames">
          {Object.entries(DEVICE_SIZES).map(([key, { label }]) => (
            <button
              key={key}
              className={`device-btn ${device === key ? 'active' : ''}`}
              onClick={() => setDevice(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {previewUrl ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            background: device !== 'desktop' ? 'var(--bg-tertiary)' : 'transparent',
            padding: device !== 'desktop' ? '16px' : 0,
            overflow: 'hidden',
          }}
        >
          <iframe
            ref={iframeRef}
            className="preview-frame"
            src={previewUrl}
            title="App Preview"
            style={{
              width: DEVICE_SIZES[device].width,
              maxWidth: '100%',
              height: '100%',
              borderRadius: device !== 'desktop' ? '8px' : 0,
              boxShadow: device !== 'desktop' ? 'var(--shadow-lg)' : 'none',
            }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      ) : (
        <div className="preview-empty">
          <VscOpenPreview style={{ fontSize: 48 }} />
          <p>Start your server to see a live preview</p>
          <p style={{ fontSize: '12px', maxWidth: '300px' }}>
            The preview will load automatically when your server is running on port {port}
          </p>
        </div>
      )}
    </div>
  );
}
