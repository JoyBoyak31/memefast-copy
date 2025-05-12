// src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import TokenList from './components/token/TokenList';
import TokenDetails from './components/token/TokenDetails';
import websocketService from './utils/websocketService';
// Import dark theme CSS (this replaces previous CSS)
import './styles/darkTheme.css';

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
              <h1 className="app-title">Launchy.Fun Token Fetcher</h1>
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
    </Router>
  );
};

export default App;