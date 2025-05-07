// src/components/token/RefreshButton.jsx
import React, { useState } from 'react';
import { forceRefreshTrendingTokens } from '../../utils/pumpFunAPI';

const RefreshButton = ({ onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleRefresh = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setStatus({ type: 'info', message: 'Refreshing tokens...' });
      
      // Call the API to force refresh
      const result = await forceRefreshTrendingTokens();
      
      setStatus({ 
        type: 'success', 
        message: `Successfully refreshed tokens from ${result.source || 'API'}` 
      });
      
      // Notify parent component
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      setStatus({ 
        type: 'error', 
        message: `Failed to refresh: ${error.message}` 
      });
    } finally {
      setLoading(false);
      
      // Auto-clear status after 5 seconds
      setTimeout(() => {
        setStatus(null);
      }, 5000);
    }
  };

  return (
    <div className="refresh-container">
      <button 
        className={`refresh-button ${loading ? 'loading' : ''}`} 
        onClick={handleRefresh}
        disabled={loading}
      >
        {loading ? 'Refreshing...' : 'Refresh Trending Tokens'}
      </button>
      
      {status && (
        <div className={`refresh-status ${status.type}`}>
          {status.message}
        </div>
      )}
      
      {/* Inline styles for simplicity */}
      <style jsx>{`
        .refresh-container {
          margin: 16px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .refresh-button {
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .refresh-button:hover {
          background-color: #2563eb;
        }
        
        .refresh-button.loading {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .refresh-status {
          margin-top: 8px;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .refresh-status.success {
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        
        .refresh-status.error {
          background-color: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }
        
        .refresh-status.info {
          background-color: #e0f2fe;
          color: #0369a1;
          border: 1px solid #bae6fd;
        }
      `}</style>
    </div>
  );
};

export default RefreshButton;