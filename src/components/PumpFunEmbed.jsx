// src/components/PumpFunEmbed.jsx
import React, { useState, useRef, useEffect } from 'react';

const PumpFunEmbed = ({ height = 800 }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);

  // Handle iframe loading
  const handleLoad = () => {
    setLoading(false);
  };

  // Handle iframe errors
  const handleError = () => {
    setError('Failed to load content. Please check if the server is running.');
    setLoading(false);
  };

  // Automatic refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (iframeRef.current) {
        iframeRef.current.src = iframeRef.current.src;
        setLoading(true);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  // Manual refresh function
  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
      setLoading(true);
      setError(null);
    }
  };

  return (
    <div className="pumpfun-embed-container">
      <div className="pumpfun-header">
        <h2>Trending Tokens</h2>
        <div className="controls">
          {loading && (
            <div className="loading-indicator">
              <div className="spinner-small"></div>
              <span>Loading...</span>
            </div>
          )}
          <button 
            className="refresh-button" 
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="iframe-wrapper">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Loading token data...</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <h3>Error Loading Content</h3>
            <p>{error}</p>
            <button onClick={handleRefresh}>Try Again</button>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src="http://localhost:3002"
          width="100%"
          height={height}
          frameBorder="0"
          onLoad={handleLoad}
          onError={handleError}
          title="Pump.fun Tokens"
        />
      </div>

      <style jsx>{`
        .pumpfun-embed-container {
          width: 100%;
          border-radius: 12px;
          overflow: hidden;
          background-color: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .pumpfun-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .pumpfun-header h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: #111827;
        }

        .controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .loading-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #6b7280;
        }

        .spinner-small {
          border: 2px solid rgba(0, 0, 0, 0.1);
          border-left-color: #3b82f6;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          animation: spin 1s linear infinite;
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

        .refresh-button:disabled {
          background-color: #93c5fd;
          cursor: not-allowed;
        }

        .iframe-wrapper {
          position: relative;
          width: 100%;
          height: ${height}px;
        }

        .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(255, 255, 255, 0.9);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-left-color: #3b82f6;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-message {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: rgba(255, 255, 255, 0.95);
          z-index: 10;
          padding: 24px;
          text-align: center;
        }

        .error-message h3 {
          color: #b91c1c;
          margin-top: 0;
        }

        .error-message button {
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 14px;
          cursor: pointer;
          margin-top: 16px;
        }
      `}</style>
    </div>
  );
};

export default PumpFunEmbed;