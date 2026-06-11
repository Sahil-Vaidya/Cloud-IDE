/**
 * Language Map
 * Maps file extensions to Monaco editor language IDs and display names.
 * Extensible for adding new language support.
 */

const LANGUAGE_MAP = {
  // Python
  py: { language: 'python', name: 'Python', icon: '🐍' },
  pyw: { language: 'python', name: 'Python', icon: '🐍' },
  pyi: { language: 'python', name: 'Python Stub', icon: '🐍' },

  // JavaScript / TypeScript
  js: { language: 'javascript', name: 'JavaScript', icon: '📜' },
  jsx: { language: 'javascript', name: 'React JSX', icon: '⚛️' },
  ts: { language: 'typescript', name: 'TypeScript', icon: '📘' },
  tsx: { language: 'typescript', name: 'React TSX', icon: '⚛️' },
  mjs: { language: 'javascript', name: 'ES Module', icon: '📜' },
  cjs: { language: 'javascript', name: 'CommonJS', icon: '📜' },

  // Web
  html: { language: 'html', name: 'HTML', icon: '🌐' },
  htm: { language: 'html', name: 'HTML', icon: '🌐' },
  css: { language: 'css', name: 'CSS', icon: '🎨' },
  scss: { language: 'scss', name: 'SCSS', icon: '🎨' },
  less: { language: 'less', name: 'Less', icon: '🎨' },
  svg: { language: 'xml', name: 'SVG', icon: '🖼️' },

  // Data / Config
  json: { language: 'json', name: 'JSON', icon: '📋' },
  yaml: { language: 'yaml', name: 'YAML', icon: '📋' },
  yml: { language: 'yaml', name: 'YAML', icon: '📋' },
  toml: { language: 'ini', name: 'TOML', icon: '📋' },
  xml: { language: 'xml', name: 'XML', icon: '📋' },
  ini: { language: 'ini', name: 'INI', icon: '⚙️' },
  env: { language: 'ini', name: 'Environment', icon: '🔐' },
  conf: { language: 'ini', name: 'Config', icon: '⚙️' },

  // Markdown / Text
  md: { language: 'markdown', name: 'Markdown', icon: '📝' },
  mdx: { language: 'markdown', name: 'MDX', icon: '📝' },
  txt: { language: 'plaintext', name: 'Plain Text', icon: '📄' },
  log: { language: 'plaintext', name: 'Log', icon: '📄' },
  rst: { language: 'plaintext', name: 'reStructuredText', icon: '📝' },

  // Shell
  sh: { language: 'shell', name: 'Shell', icon: '💻' },
  bash: { language: 'shell', name: 'Bash', icon: '💻' },
  zsh: { language: 'shell', name: 'Zsh', icon: '💻' },
  ps1: { language: 'powershell', name: 'PowerShell', icon: '💻' },
  bat: { language: 'bat', name: 'Batch', icon: '💻' },
  cmd: { language: 'bat', name: 'Command', icon: '💻' },

  // Java
  java: { language: 'java', name: 'Java', icon: '☕' },
  kt: { language: 'kotlin', name: 'Kotlin', icon: '🟪' },
  gradle: { language: 'groovy', name: 'Gradle', icon: '🐘' },

  // C / C++ / C#
  c: { language: 'c', name: 'C', icon: '🔧' },
  h: { language: 'c', name: 'C Header', icon: '🔧' },
  cpp: { language: 'cpp', name: 'C++', icon: '🔧' },
  cs: { language: 'csharp', name: 'C#', icon: '🟢' },

  // Go / Rust
  go: { language: 'go', name: 'Go', icon: '🐹' },
  rs: { language: 'rust', name: 'Rust', icon: '🦀' },

  // Ruby / PHP
  rb: { language: 'ruby', name: 'Ruby', icon: '💎' },
  php: { language: 'php', name: 'PHP', icon: '🐘' },

  // SQL
  sql: { language: 'sql', name: 'SQL', icon: '🗃️' },

  // Docker
  dockerfile: { language: 'dockerfile', name: 'Dockerfile', icon: '🐳' },

  // Misc
  graphql: { language: 'graphql', name: 'GraphQL', icon: '◻️' },
  r: { language: 'r', name: 'R', icon: '📊' },
  swift: { language: 'swift', name: 'Swift', icon: '🐦' },
};

/**
 * Get the Monaco language ID for a file extension.
 */
export function getLanguageFromExtension(ext) {
  if (!ext) return 'plaintext';
  const cleaned = ext.toLowerCase().replace(/^\./, '');
  return LANGUAGE_MAP[cleaned]?.language || 'plaintext';
}

/**
 * Get the display name for a file extension.
 */
export function getLanguageName(ext) {
  if (!ext) return 'Plain Text';
  const cleaned = ext.toLowerCase().replace(/^\./, '');
  return LANGUAGE_MAP[cleaned]?.name || 'Plain Text';
}

/**
 * Get the icon for a file extension.
 */
export function getFileIcon(ext) {
  if (!ext) return '📄';
  const cleaned = ext.toLowerCase().replace(/^\./, '');
  return LANGUAGE_MAP[cleaned]?.icon || '📄';
}

/**
 * Get language info from a filename.
 */
export function getLanguageFromFilename(filename) {
  if (!filename) return { language: 'plaintext', name: 'Plain Text', icon: '📄' };

  // Handle special filenames
  const lower = filename.toLowerCase();
  if (lower === 'dockerfile') return LANGUAGE_MAP.dockerfile;
  if (lower === '.gitignore' || lower === '.env') return { language: 'ini', name: 'Config', icon: '⚙️' };
  if (lower === 'makefile') return { language: 'makefile', name: 'Makefile', icon: '🔨' };
  if (lower === 'requirements.txt') return { language: 'plaintext', name: 'Requirements', icon: '📦' };

  const ext = filename.split('.').pop();
  return LANGUAGE_MAP[ext] || { language: 'plaintext', name: 'Plain Text', icon: '📄' };
}

export default LANGUAGE_MAP;
