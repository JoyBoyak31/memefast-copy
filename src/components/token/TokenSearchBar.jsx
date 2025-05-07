// src/components/token/TokenSearchBar.jsx
import React, { useState } from 'react';

const TokenSearchBar = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Handle search input change
  const handleChange = (e) => {
    setSearchQuery(e.target.value);
    
    // Perform live search if query length is at least 2 characters
    if (e.target.value.length >= 2) {
      onSearch(e.target.value);
    }
    
    // Clear results if query is empty
    if (e.target.value === '') {
      onSearch('');
    }
  };

  // Handle search submission
  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  // Clear search
  const handleClear = () => {
    setSearchQuery('');
    onSearch('');
  };

  return (
    <div className="token-search-container">
      <form onSubmit={handleSubmit} className={`token-search-form ${isFocused ? 'focused' : ''}`}>
        <div className="search-icon">🔍</div>
        <input
          type="text"
          className="token-search-input"
          value={searchQuery}
          onChange={handleChange}
          placeholder="Search by name or symbol..."
          aria-label="Search tokens"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {searchQuery && (
          <button 
            type="button" 
            className="token-search-clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
        <button 
          type="submit" 
          className="token-search-button"
          aria-label="Search"
        >
          Search
        </button>
      </form>

      <style jsx>{`
        .token-search-container {
          width: 100%;
          max-width: 800px;
        }
        
        .token-search-form {
          display: flex;
          align-items: center;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px 12px;
          transition: all 0.2s;
        }
        
        .token-search-form.focused {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }
        
        .search-icon {
          margin-right: 8px;
          color: #9ca3af;
        }
        
        .token-search-input {
          flex: 1;
          border: none;
          background: none;
          font-size: 16px;
          padding: 4px 0;
          color: #111827;
          outline: none;
        }
        
        .token-search-input::placeholder {
          color: #9ca3af;
        }
        
        .token-search-clear {
          background: none;
          border: none;
          font-size: 20px;
          line-height: 1;
          color: #9ca3af;
          padding: 0 8px;
          cursor: pointer;
          transition: color 0.2s;
        }
        
        .token-search-clear:hover {
          color: #6b7280;
        }
        
        .token-search-button {
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          margin-left: 8px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .token-search-button:hover {
          background-color: #2563eb;
        }
        
        @media (max-width: 640px) {
          .token-search-button {
            padding: 8px 12px;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default TokenSearchBar;