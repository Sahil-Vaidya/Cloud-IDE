import React, { useState, useCallback, useRef, useEffect } from 'react';
import { VscSearch, VscCaseSensitive, VscRegex, VscLoading } from 'react-icons/vsc';
import { searchAPI } from '../../utils/api';
import './SearchPanel.css';

export default function SearchPanel({ project, onFileSelect, onOpenFileAtLine }) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    // Reset when project changes
    setResults(null);
    setError('');
    setQuery('');
  }, [project]);

  const runSearch = useCallback(
    async (q) => {
      if (!project || !q.trim()) {
        setResults(null);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await searchAPI.searchFiles(project, q, { caseSensitive, useRegex });
        setResults(data);
      } catch (err) {
        setError(err.message || 'Search failed');
        setResults(null);
      } finally {
        setLoading(false);
      }
    },
    [project, caseSensitive, useRegex]
  );

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      clearTimeout(debounceRef.current);
      runSearch(query);
    }
  };

  const totalMatches = results?.total_matches || 0;
  const totalFiles = results?.results?.length || 0;

  return (
    <div className="search-panel" id="search-panel">
      <div className="search-panel-header">
        <h3>Search</h3>
      </div>

      {/* Search Input */}
      <div className="search-input-row">
        <div className="search-input-wrap">
          <VscSearch className="search-input-icon" />
          <input
            ref={inputRef}
            className="search-input"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder={project ? 'Search in files...' : 'Open a project first'}
            disabled={!project}
          />
          {loading && <VscLoading className="search-spinner" />}
        </div>
        <div className="search-options">
          <button
            className={`search-opt-btn ${caseSensitive ? 'active' : ''}`}
            onClick={() => {
              const newVal = !caseSensitive;
              setCaseSensitive(newVal);
              if (query.trim()) runSearch(query);
            }}
            title="Case Sensitive"
          >
            Aa
          </button>
          <button
            className={`search-opt-btn ${useRegex ? 'active' : ''}`}
            onClick={() => {
              const newVal = !useRegex;
              setUseRegex(newVal);
              if (query.trim()) runSearch(query);
            }}
            title="Use Regular Expression"
          >
            .*
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="search-error">{error}</div>}

      {/* Summary */}
      {results && !error && (
        <div className="search-summary">
          {totalMatches === 0 ? (
            <span>No results for "{query}"</span>
          ) : (
            <span>
              {totalMatches} match{totalMatches !== 1 ? 'es' : ''} in {totalFiles} file{totalFiles !== 1 ? 's' : ''}
              {results.truncated && ' (truncated)'}
            </span>
          )}
        </div>
      )}

      {/* Results */}
      <div className="search-results">
        {results?.results?.map((fileResult) => (
          <FileResult
            key={fileResult.file}
            fileResult={fileResult}
            query={query}
            caseSensitive={caseSensitive}
            onOpenFileAtLine={onOpenFileAtLine}
          />
        ))}
      </div>
    </div>
  );
}

function FileResult({ fileResult, query, caseSensitive, onOpenFileAtLine }) {
  const [collapsed, setCollapsed] = useState(false);
  const filename = fileResult.file.split('/').pop();
  const dirPath = fileResult.file.includes('/')
    ? fileResult.file.split('/').slice(0, -1).join('/')
    : '';

  return (
    <div className="search-file-group">
      <div
        className="search-file-header"
        onClick={() => setCollapsed(!collapsed)}
        title={fileResult.file}
      >
        <span className={`search-file-arrow ${collapsed ? '' : 'open'}`}>▶</span>
        <span className="search-file-name">{filename}</span>
        {dirPath && <span className="search-file-dir">{dirPath}</span>}
        <span className="search-file-count">{fileResult.match_count}</span>
      </div>

      {!collapsed && (
        <div className="search-file-matches">
          {fileResult.matches.map((match) => (
            <div
              key={match.line}
              className="search-match-row"
              onClick={() => onOpenFileAtLine && onOpenFileAtLine(fileResult.file, match.line)}
              title={`${fileResult.file}:${match.line}`}
            >
              <span className="search-match-line">{match.line}</span>
              <span className="search-match-content">
                <HighlightedLine
                  line={match.content}
                  query={query}
                  caseSensitive={caseSensitive}
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightedLine({ line, query, caseSensitive }) {
  if (!query) return <span>{line.slice(0, 200)}</span>;

  const trimmed = line.slice(0, 200);
  const flags = caseSensitive ? 'g' : 'gi';
  let pattern;
  try {
    pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, flags);
  } catch {
    return <span>{trimmed}</span>;
  }

  const parts = trimmed.split(pattern);
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = pattern.test(part);
        pattern.lastIndex = 0;
        return isMatch ? (
          <mark key={i} className="search-highlight">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}
