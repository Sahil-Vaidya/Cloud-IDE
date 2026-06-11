/**
 * Application Constants
 */

export const APP_NAME = 'CloudIDE';
export const APP_VERSION = '1.0.0';

export const PANEL_IDS = {
  EXPLORER: 'explorer',
  TERMINAL: 'terminal',
  DATABASE: 'database',
  PREVIEW: 'preview',
};

export const PROCESS_STATUS = {
  RUNNING: 'running',
  STOPPED: 'stopped',
  ERROR: 'error',
};

export const PROJECT_TEMPLATES = [
  {
    id: 'django',
    name: 'Django',
    description: 'Full-featured Python web framework with admin, ORM, and authentication',
    icon: '🟢',
    color: '#092e20',
  },
  {
    id: 'flask',
    name: 'Flask',
    description: 'Lightweight Python micro-framework for web applications',
    icon: '🧪',
    color: '#000000',
  },
  {
    id: 'fastapi',
    name: 'FastAPI',
    description: 'Modern, fast Python web framework with automatic API docs',
    icon: '⚡',
    color: '#009688',
  },
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Empty Python project with just main.py and requirements.txt',
    icon: '📁',
    color: '#6e7681',
  },
];

export const EDITOR_OPTIONS = {
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  tabSize: 4,
  insertSpaces: true,
  formatOnPaste: true,
  formatOnType: false,
  autoIndent: 'full',
  bracketPairColorization: { enabled: true },
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  renderLineHighlight: 'gutter',
  renderWhitespace: 'selection',
  guides: {
    bracketPairs: true,
    indentation: true,
  },
};
