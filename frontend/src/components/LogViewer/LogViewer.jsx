import React, { useRef, useEffect, useState, useCallback } from 'react';
import { VscTrash, VscDebugStart, VscDebugStop, VscDebugRestart } from 'react-icons/vsc';
import { createLogsWS, processAPI } from '../../utils/api';
import './LogViewer.css';

export default function LogViewer({ project, processStatus, onProcessAction }) {
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef(null);
  const wsRef = useRef(null);

  // Connect to log WebSocket
  useEffect(() => {
    if (!project) return;

    const ws = createLogsWS(project);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'log') {
          setLogs((prev) => [...prev.slice(-4999), msg.data]);
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      // Silently handle - will reconnect if needed
    };

    return () => {
      ws.close();
    };
  }, [project]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Fetch initial logs
  useEffect(() => {
    if (!project) return;
    processAPI.getLogs(project, 200).then((data) => {
      if (data.logs?.length) {
        setLogs(data.logs);
      }
    }).catch(() => {});
  }, [project]);

  const getLogClass = (line) => {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('traceback') || lower.includes('exception')) return 'log-error';
    if (lower.includes('warning') || lower.includes('warn')) return 'log-warning';
    if (lower.includes('success') || lower.includes('ok') || lower.includes('200')) return 'log-success';
    return '';
  };

  const isRunning = processStatus?.is_running;

  return (
    <div className="log-viewer" id="log-viewer">
      <div className="log-viewer-header">
        <h4>Output</h4>
        <div className="terminal-header-actions">
          {isRunning ? (
            <>
              <button onClick={() => onProcessAction('restart')} title="Restart Server">
                <VscDebugRestart />
              </button>
              <button onClick={() => onProcessAction('stop')} title="Stop Server">
                <VscDebugStop style={{ color: 'var(--accent-danger)' }} />
              </button>
            </>
          ) : (
            <button onClick={() => onProcessAction('start')} title="Start Server">
              <VscDebugStart style={{ color: 'var(--accent-success)' }} />
            </button>
          )}
          <button onClick={() => setLogs([])} title="Clear Logs">
            <VscTrash />
          </button>
        </div>
      </div>

      <div className="log-viewer-content" id="log-viewer-content">
        {logs.length > 0 ? (
          <>
            {logs.map((line, i) => (
              <div key={i} className={`log-line ${getLogClass(line)}`}>
                {line}
              </div>
            ))}
            <div ref={logEndRef} />
          </>
        ) : (
          <div className="log-empty">
            No output yet. Start a server to see logs.
          </div>
        )}
      </div>
    </div>
  );
}
