import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { VscTrash, VscDebugRestart, VscClose } from 'react-icons/vsc';
import { createTerminalWS } from '../../utils/api';
import '@xterm/xterm/css/xterm.css';
import './Terminal.css';

export default function TerminalPanel({ project, visible }) {
  const terminalRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || !project) return;

    const term = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: 'rgba(88, 166, 255, 0.3)',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39d353',
        white: '#e6edf3',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d364',
        brightWhite: '#f0f6fc',
      },
      fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);

    // Delay fit to ensure container has dimensions
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        // ignore
      }
    }, 100);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    connectWS(term);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        // ignore
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [project]);

  // Refit when visibility changes
  useEffect(() => {
    if (visible && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          // ignore
        }
      }, 50);
    }
  }, [visible]);

  const connectWS = useCallback(
    (term) => {
      if (!project) return;

      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = createTerminalWS(project);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'output' || msg.type === 'connected') {
            term.write(msg.data);
          } else if (msg.type === 'error') {
            term.write(`\r\n\x1b[31m${msg.data}\x1b[0m\r\n`);
          }
        } catch {
          term.write(event.data);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        term.write('\r\n\x1b[33m[Terminal disconnected]\x1b[0m\r\n');
      };

      ws.onerror = () => {
        setConnected(false);
        term.write('\r\n\x1b[31m[Connection error]\x1b[0m\r\n');
      };

      // Send input to WebSocket
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });
    },
    [project]
  );

  const handleClear = () => {
    termRef.current?.clear();
  };

  const handleReconnect = () => {
    if (termRef.current) {
      termRef.current.clear();
      termRef.current.write('\x1b[33m[Reconnecting...]\x1b[0m\r\n');
      connectWS(termRef.current);
    }
  };

  return (
    <div className="terminal-panel" id="terminal-panel">
      <div className="terminal-header">
        <div className="terminal-header-tabs">
          <button className="terminal-header-tab active">Terminal</button>
        </div>
        <div className="terminal-header-actions">
          <span
            style={{
              fontSize: '10px',
              color: connected ? 'var(--accent-success)' : 'var(--text-tertiary)',
              marginRight: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: connected ? 'var(--accent-success)' : 'var(--text-tertiary)',
                display: 'inline-block',
              }}
            />
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          <button onClick={handleClear} title="Clear Terminal">
            <VscTrash />
          </button>
          <button onClick={handleReconnect} title="Restart Terminal">
            <VscDebugRestart />
          </button>
        </div>
      </div>
      <div className="terminal-container" ref={terminalRef} />
    </div>
  );
}
