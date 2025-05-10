// src/App.jsx - Updated with proper routing for token details

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import TokenList from './components/token/TokenList';
import TokenDetails from './components/token/TokenDetails';
import websocketService from './utils/websocketService';

const App = () => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Setup global WebSocket connection status listener
  useEffect(() => {
    const handleConnectionStatus = (status) => {
      setConnectionStatus(status);
    };

    // Add listener for connection status updates
    websocketService.addConnectionStatusListener(handleConnectionStatus);

    // Connect to WebSocket server when app loads
    if (!websocketService.isConnected) {
      websocketService.connect();
    }

    // Cleanup on unmount
    return () => {
      websocketService.removeConnectionStatusListener(handleConnectionStatus);
    };
  }, []);

  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <div className="logo-container">
            <Link to="/" className="logo-link">
              <h1 className="app-title">Pump.fun Live Token Feed</h1>
            </Link>
          </div>
          
          <div className={`connection-status ${connectionStatus}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {connectionStatus === 'connected' ? 'Live Updates' : 
               connectionStatus === 'connecting' ? 'Connecting...' : 
               'Updates Offline'}
            </span>
            {connectionStatus !== 'connected' && (
              <button 
                className="reconnect-button" 
                onClick={() => websocketService.reconnect()}
              >
                Reconnect
              </button>
            )}
          </div>
        </header>
        
        <main className="app-content">
          <Routes>
            <Route path="/" element={<TokenList />} />
            <Route path="/token/:tokenAddress" element={<TokenDetails />} />
          </Routes>
        </main>
        
        <footer className="app-footer">
          <div className="footer-content">
            <p>Real-time token data | Market cap updates every 1.5s</p>
            <p className="api-status">
              API Status: 
              <a href="http://localhost:5000/health" target="_blank" rel="noopener noreferrer">
                Server Status
              </a>
            </p>
          </div>
        </footer>
      </div>
      
      <style jsx>{`
        .app-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background-color: #f9fafb;
        }
        
        .app-header {
          background-color: #fff;
          border-bottom: 1px solid #e5e7eb;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .logo-container {
          display: flex;
          align-items: center;
        }
        
        .logo-link {
          text-decoration: none;
          color: inherit;
        }
        
        .app-title {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: #111827;
        }
        
        .connection-status {
          display: flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }
        
        .connection-status.connected {
          background-color: #d1fae5;
          color: #065f46;
        }
        
        .connection-status.connecting {
          background-color: #fef3c7;
          color: #92400e;
        }
        
        .connection-status.disconnected,
        .connection-status.error {
          background-color: #fee2e2;
          color: #b91c1c;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 8px;
        }
        
        .connected .status-dot {
          background-color: #10b981;
        }
        
        .connecting .status-dot {
          background-color: #f59e0b;
          animation: pulse 1.5s infinite;
        }
        
        .disconnected .status-dot,
        .error .status-dot {
          background-color: #ef4444;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
        
        .reconnect-button {
          margin-left: 8px;
          padding: 4px 8px;
          font-size: 12px;
          background-color: #fff;
          border: 1px solid currentColor;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .app-content {
          flex: 1;
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }
        
        .app-footer {
          background-color: #fff;
          border-top: 1px solid #e5e7eb;
          padding: 16px 24px;
        }
        
        .footer-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #6b7280;
          font-size: 14px;
        }
        
        .api-status {
          display: flex;
          gap: 8px;
        }
        
        .api-status a {
          color: #3b82f6;
          text-decoration: none;
        }
        
        .api-status a:hover {
          text-decoration: underline;
        }
        
        @media (max-width: 768px) {
          .app-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          
          .footer-content {
            flex-direction: column;
            gap: 8px;
          }
        }
      `}</style>
    </Router>
  );
};

export default App;