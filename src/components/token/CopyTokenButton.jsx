// src/components/token/CopyTokenButton.jsx
import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

const CopyTokenButton = ({ token, onSuccess, onError, theme = 'light' }) => {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Determine if we're using dark theme
  const isDarkTheme = theme === 'dark';

  // Handle token copy
  const handleCopyToken = async () => {
    if (!connected || !publicKey || !signTransaction) {
      alert('Please connect your wallet first!');
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      // For demo purposes, we'll just log the token parameters
      // and simulate a successful token creation
      console.log('Creating token with parameters:', {
        name: token.name,
        symbol: token.symbol,
        initialSupply: 1000000,
        decimals: 9,
        bondingCurve: token.bondingCurve
      });
      
      // Simulate token creation delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate a mock token address
      const mockTokenAddress = `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      
      // Set success result
      setResult({
        success: true,
        message: 'Token copied successfully!',
        tokenAddress: mockTokenAddress
      });
      
      // Call onSuccess callback
      if (onSuccess) {
        onSuccess(mockTokenAddress);
      }
    } catch (error) {
      console.error('Error creating token:', error);
      
      // Set error result
      setResult({
        success: false,
        message: `Error: ${error.message || 'Unknown error'}`
      });
      
      // Call onError callback
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`copy-token-button-container ${isDarkTheme ? 'dark' : 'light'}`}>
      <button 
        className={`copy-token-button ${loading ? 'loading' : ''} ${isDarkTheme ? 'dark' : 'light'}`}
        onClick={handleCopyToken}
        disabled={loading || !connected}
      >
        {loading ? (
          <>
            <span className="spinner"></span>
            <span>Creating Token...</span>
          </>
        ) : (
          <>
            <span className="copy-icon">🔄</span>
            <span>Copy This Token</span>
          </>
        )}
      </button>
      
      {!connected && (
        <div className={`copy-token-notice ${isDarkTheme ? 'dark' : 'light'}`}>
          <p>Connect your wallet to copy this token</p>
        </div>
      )}
      
      {result && (
        <div className={`copy-token-result ${result.success ? 'success' : 'error'} ${isDarkTheme ? 'dark' : 'light'}`}>
          <h4>{result.message}</h4>
          {result.success && result.tokenAddress && (
            <div className="token-address-display">
              <p>Token Address:</p>
              <div className="address-container">
                <code>{result.tokenAddress}</code>
                <button 
                  className="copy-address-button"
                  onClick={() => {
                    navigator.clipboard.writeText(result.tokenAddress);
                    alert('Token address copied to clipboard!');
                  }}
                  title="Copy address to clipboard"
                >
                  📋
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .copy-token-button-container {
          margin: 16px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .copy-token-button-container.dark {
          color: #e5e7eb;
        }
        
        .copy-token-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
          max-width: 300px;
        }
        
        .copy-token-button:hover:not(:disabled) {
          background-color: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }
        
        .copy-token-button:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .copy-token-button:disabled {
          background-color: #9ca3af;
          cursor: not-allowed;
        }
        
        .copy-token-button.loading {
          background-color: #6b7280;
          cursor: wait;
        }
        
        .copy-token-button.dark {
          background-color: #4f46e5;
        }
        
        .copy-token-button.dark:hover:not(:disabled) {
          background-color: #4338ca;
          box-shadow: 0 4px 12px rgba(67, 56, 202, 0.3);
        }
        
        .copy-token-button.dark:disabled {
          background-color: #6b7280;
        }
        
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease infinite;
        }
        
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        
        .copy-token-notice {
          margin-top: 12px;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
          background-color: #f3f4f6;
          border-radius: 8px;
          padding: 8px 16px;
          border: 1px solid #e5e7eb;
        }
        
        .copy-token-notice.dark {
          background-color: #374151;
          border-color: #4b5563;
          color: #e5e7eb;
        }
        
        .copy-token-result {
          margin-top: 16px;
          width: 100%;
          max-width: 500px;
          padding: 16px;
          border-radius: 8px;
          animation: fadeIn 0.3s ease;
        }
        
        .copy-token-result.success {
          background-color: #d1fae5;
          border: 1px solid #a7f3d0;
          color: #065f46;
        }
        
        .copy-token-result.error {
          background-color: #fee2e2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }
        
        .copy-token-result.dark.success {
          background-color: #064e3b;
          border-color: #065f46;
          color: #d1fae5;
        }
        
        .copy-token-result.dark.error {
          background-color: #7f1d1d;
          border-color: #b91c1c;
          color: #fee2e2;
        }
        
        .copy-token-result h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .token-address-display {
          margin-top: 8px;
        }
        
        .token-address-display p {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 500;
        }
        
        .address-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 8px 12px;
        }
        
        .copy-token-result.dark .address-container {
          background-color: #1f2937;
          border-color: #374151;
        }
        
        .address-container code {
          font-family: monospace;
          font-size: 14px;
          word-break: break-all;
        }
        
        .copy-address-button {
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          padding: 4px;
          margin-left: 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .copy-address-button:hover {
          background-color: #e5e7eb;
        }
        
        .copy-token-result.dark .copy-address-button:hover {
          background-color: #374151;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @media (max-width: 640px) {
          .copy-token-button {
            width: 100%;
            max-width: none;
          }
          
          .copy-token-result {
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
};

export default CopyTokenButton;