import React, { useState, useEffect, useRef } from 'react';
import { VscClose } from 'react-icons/vsc';
import './SettingsModal.css';

const FONT_FAMILIES = [
  { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
  { value: "'Fira Code', monospace", label: 'Fira Code' },
  { value: "'Cascadia Code', monospace", label: 'Cascadia Code' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: "monospace", label: 'System Monospace' },
];

const SECTIONS = ['Editor', 'Appearance', 'Terminal', 'Auto Save'];

export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange }) {
  const [activeSection, setActiveSection] = useState('Editor');

  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleDragStart = (e) => {
    if (e.button !== 0) return; // only left click
    if (e.target.closest('.close-btn') || e.target.closest('input') || e.target.closest('button') || e.target.closest('select')) {
      return;
    }
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - dragPos.x,
      y: e.clientY - dragPos.y,
    };
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e) => {
      setDragPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (isOpen) {
      setDragPos({ x: 0, y: 0 });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (key, value) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal settings-modal animate-scale-in" 
        onClick={(e) => e.stopPropagation()}
        style={{ transform: `translate(${dragPos.x}px, ${dragPos.y}px)` }}
      >
        <div className="settings-header" onMouseDown={handleDragStart}>
          <h2>⚙ Settings</h2>
          <button className="close-btn" onClick={onClose} title="Close">
            <VscClose />
          </button>
        </div>

        <div className="settings-layout">
          {/* Section Nav */}
          <nav className="settings-nav">
            {SECTIONS.map((s) => (
              <button
                key={s}
                className={`settings-nav-item ${activeSection === s ? 'active' : ''}`}
                onClick={() => setActiveSection(s)}
              >
                {s}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="settings-body">
            {activeSection === 'Editor' && (
              <>
                <SettingRow label="Font Size" description="Editor character size in pixels.">
                  <select
                    id="setting-font-size"
                    value={settings.fontSize}
                    onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
                    className="input setting-input"
                  >
                    {[11, 12, 13, 14, 15, 16, 18, 20, 22].map((s) => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                </SettingRow>

                <SettingRow label="Font Family" description="Monospace font used in the editor.">
                  <select
                    id="setting-font-family"
                    value={settings.fontFamily}
                    onChange={(e) => handleChange('fontFamily', e.target.value)}
                    className="input setting-input"
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </SettingRow>

                <SettingRow label="Tab Size" description="Number of spaces per tab character.">
                  <select
                    id="setting-tab-size"
                    value={settings.tabSize}
                    onChange={(e) => handleChange('tabSize', parseInt(e.target.value))}
                    className="input setting-input"
                  >
                    <option value={2}>2 Spaces</option>
                    <option value={4}>4 Spaces</option>
                    <option value={8}>8 Spaces</option>
                  </select>
                </SettingRow>

                <SettingRow label="Editor Keybindings" description="Choose keybinding mode for the editor.">
                  <select
                    id="setting-keybindings"
                    value={settings.keybindings || 'default'}
                    onChange={(e) => handleChange('keybindings', e.target.value)}
                    className="input setting-input"
                  >
                    <option value="default">Default (VS Code)</option>
                    <option value="vim">Vim</option>
                    <option value="emacs">Emacs</option>
                  </select>
                </SettingRow>

                <SettingCheckbox
                  id="setting-wordwrap"
                  label="Word Wrap"
                  description="Wrap long lines at the editor viewport width."
                  checked={settings.wordWrap === 'on'}
                  onChange={(v) => handleChange('wordWrap', v ? 'on' : 'off')}
                />

                <SettingCheckbox
                  id="setting-minimap"
                  label="Show Minimap"
                  description="Show a mini overview map on the right side of the editor."
                  checked={settings.minimap !== false}
                  onChange={(v) => handleChange('minimap', v)}
                />

                <SettingCheckbox
                  id="setting-bracket-pairs"
                  label="Bracket Pair Colorization"
                  description="Color matching brackets for easier code reading."
                  checked={settings.bracketPairs !== false}
                  onChange={(v) => handleChange('bracketPairs', v)}
                />

                <SettingCheckbox
                  id="setting-line-numbers"
                  label="Line Numbers"
                  description="Show line numbers in the editor gutter."
                  checked={settings.lineNumbers !== false}
                  onChange={(v) => handleChange('lineNumbers', v)}
                />
              </>
            )}

            {activeSection === 'Appearance' && (
              <>
                <SettingRow label="Color Theme" description="UI and editor color theme.">
                  <select
                    id="setting-theme"
                    value={settings.theme}
                    onChange={(e) => handleChange('theme', e.target.value)}
                    className="input setting-input"
                  >
                    <option value="vs-dark">Dark (Standard)</option>
                    <option value="light">Light (Classic)</option>
                    <option value="hc-black">High Contrast</option>
                  </select>
                </SettingRow>
              </>
            )}

            {activeSection === 'Auto Save' && (
              <>
                <SettingCheckbox
                  id="setting-autosave"
                  label="Auto Save"
                  description="Automatically save files after a 2-second delay when changes are made."
                  checked={settings.autoSave !== false}
                  onChange={(v) => handleChange('autoSave', v)}
                />

                <SettingRow label="Auto Save Delay" description="Milliseconds to wait before auto-saving.">
                  <select
                    id="setting-autosave-delay"
                    value={settings.autoSaveDelay || 2000}
                    onChange={(e) => handleChange('autoSaveDelay', parseInt(e.target.value))}
                    className="input setting-input"
                    disabled={settings.autoSave === false}
                  >
                    <option value={500}>500ms</option>
                    <option value={1000}>1 second</option>
                    <option value={2000}>2 seconds</option>
                    <option value={5000}>5 seconds</option>
                  </select>
                </SettingRow>
              </>
            )}

            {activeSection === 'Terminal' && (
              <>
                <SettingRow label="Terminal Font Size" description="Font size inside the integrated terminal.">
                  <select
                    id="setting-terminal-font"
                    value={settings.terminalFontSize || 13}
                    onChange={(e) => handleChange('terminalFontSize', parseInt(e.target.value))}
                    className="input setting-input"
                  >
                    {[11, 12, 13, 14, 16].map((s) => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                </SettingRow>

                <SettingCheckbox
                  id="setting-terminal-cursor-blink"
                  label="Cursor Blink"
                  description="Blink the terminal cursor."
                  checked={settings.terminalCursorBlink !== false}
                  onChange={(v) => handleChange('terminalCursorBlink', v)}
                />
              </>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="setting-group">
      <label>{label}</label>
      {children}
      {description && <span className="setting-description">{description}</span>}
    </div>
  );
}

function SettingCheckbox({ id, label, description, checked, onChange }) {
  return (
    <div className="setting-group checkbox-group">
      <div className="checkbox-row">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label htmlFor={id}>{label}</label>
      </div>
      {description && <span className="setting-description">{description}</span>}
    </div>
  );
}
