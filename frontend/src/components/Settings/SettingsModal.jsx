import React from 'react';
import { VscClose } from 'react-icons/vsc';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange }) {
  if (!isOpen) return null;

  const handleChange = (key, value) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>IDE Settings</h2>
          <button className="close-btn" onClick={onClose} title="Close Settings">
            <VscClose />
          </button>
        </div>

        <div className="settings-body">
          {/* Theme Selector */}
          <div className="setting-group">
            <label htmlFor="setting-theme">Color Theme</label>
            <select
              id="setting-theme"
              value={settings.theme}
              onChange={(e) => handleChange('theme', e.target.value)}
              className="input setting-input"
            >
              <option value="vs-dark">Dark Theme (Standard)</option>
              <option value="light">Light Theme (Classic)</option>
              <option value="hc-black">High Contrast Black</option>
            </select>
            <span className="setting-description">Select the color palette for the editor and application interface.</span>
          </div>

          {/* Editor Font Size */}
          <div className="setting-group">
            <label htmlFor="setting-font-size">Editor Font Size</label>
            <select
              id="setting-font-size"
              value={settings.fontSize}
              onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
              className="input setting-input"
            >
              <option value="12">12px</option>
              <option value="13">13px</option>
              <option value="14">14px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
              <option value="20">20px</option>
            </select>
            <span className="setting-description">Adjust the size of the characters in the code editor.</span>
          </div>

          {/* Minimap toggle */}
          <div className="setting-group checkbox-group">
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="setting-minimap"
                checked={settings.minimap}
                onChange={(e) => handleChange('minimap', e.target.checked)}
              />
              <label htmlFor="setting-minimap">Show Minimap</label>
            </div>
            <span className="setting-description">Toggle the visual overview map of code on the right side of the editor.</span>
          </div>

          {/* Word wrap toggle */}
          <div className="setting-group checkbox-group">
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="setting-wordwrap"
                checked={settings.wordWrap === 'on'}
                onChange={(e) => handleChange('wordWrap', e.target.checked ? 'on' : 'off')}
              />
              <label htmlFor="setting-wordwrap">Enable Word Wrap</label>
            </div>
            <span className="setting-description">Wrap lines that exceed the editor viewport width automatically.</span>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
