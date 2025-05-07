// src/components/ProxiedPumpFun.jsx
import React, { useState, useEffect, useRef } from 'react';

const ProxiedPumpFun = ({ path = '/coins/for-you' }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  
  // The base URL of your proxy server
  const PROXY_BASE_URL = 'http://localhost:3001/pump-proxy';
  
  useEffect(() => {
    const fetchProxiedContent = async () => {
      try {
        setLoading(true);
        
        // Fetch the content through your proxy
        const response = await fetch(`${PROXY_BASE_URL}${path}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
        }
        
        // Get the HTML content
        const html = await response.text();
        
        // Process the HTML to make it work in your context
        const processedHtml = processHtml(html);
        
        // Set the content
        setContent(processedHtml);
        setError(null);
      } catch (err) {
        console.error('Error fetching proxied content:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProxiedContent();
  }, [path]);
  
  // Function to process the HTML content
  const processHtml = (html) => {
    // Replace all absolute URLs with proxy URLs
    let processedHtml = html.replace(
      /(href|src)="https:\/\/pump\.fun/g, 
      `$1="${PROXY_BASE_URL}`
    );
    
    // Fix relative URLs
    processedHtml = processedHtml.replace(
      /(href|src)="\/(?!\/)/g, 
      `$1="${PROXY_BASE_URL}/`
    );
    
    // Remove any scripts that might cause issues
    processedHtml = processedHtml.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ''
    );
    
    // Inject custom CSS to make it fit your site better
    processedHtml = processedHtml.replace(
      '</head>',
      `<style>
        /* Custom styles to integrate with your site */
        body { 
          margin: 0; 
          padding: 0; 
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        }
        /* Hide Pump.fun header and footer */
        header, footer, nav, .navbar, .footer { 
          display: none !important; 
        }
        /* Adjust the main content area */
        main, .main-content, .container { 
          padding: 0 !important; 
          margin: 0 !important; 
          width: 100% !important; 
        }
        /* Additional custom styles */
        .token-card {
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          margin-bottom: 16px;
        }
      </style></head>`
    );
    
    return processedHtml;
  };
  
  // Inject the HTML content into the DOM
  useEffect(() => {
    if (containerRef.current && content && !loading) {
      // Clear previous content
      containerRef.current.innerHTML = '';
      
      // Create an iframe to sandbox the content
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '800px';
      iframe.style.border = 'none';
      iframe.title = 'Pump.fun Content';
      containerRef.current.appendChild(iframe);
      
      // Write the content to the iframe
      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(content);
      iframeDoc.close();
      
      // Attempt to adjust iframe height based on content
      const adjustHeight = () => {
        try {
          const height = iframeDoc.body.scrollHeight;
          iframe.style.height = `${height}px`;
        } catch (e) {
          console.error('Could not adjust iframe height:', e);
        }
      };
      
      // Adjust height when iframe loads
      iframe.onload = adjustHeight;
      
      // Also try after a slight delay (for images, etc.)
      setTimeout(adjustHeight, 1000);
    }
  }, [content, loading]);
  
  return (
    <div className="proxied-pumpfun-container">
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading Pump.fun content...</p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <h3>Error Loading Content</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      )}
      
      <div ref={containerRef} className="content-container"></div>
      
      <style jsx>{`
        .proxied-pumpfun-container {
          width: 100%;
          position: relative;
          min-height: 400px;
          border-radius: 16px;
          overflow: hidden;
          background-color: #fff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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
        
        .loading-spinner {
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
          padding: 24px;
          text-align: center;
          color: #b91c1c;
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
        
        .content-container {
          width: 100%;
          min-height: 400px;
        }
      `}</style>
    </div>
  );
};

export default ProxiedPumpFun;