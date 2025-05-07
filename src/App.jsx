import React, { useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import TokenList from './components/token/TokenList';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
  const [walletError, setWalletError] = useState(null);

  // Set up Solana network (Devnet for testing)
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = clusterApiUrl(network);

  // Initialize wallet adapters
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter()
  ];

  // Handle wallet errors
  const onError = (error) => {
    console.error('Wallet error:', error);
    setWalletError(error.message);

    // Clear error after 5 seconds
    setTimeout(() => {
      setWalletError(null);
    }, 5000);
  };

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>
          <div className="app">
            <header>
              <h1>Pump.fun Token Copy</h1>
              <div className="wallet-section">
                {walletError && (
                  <div className="wallet-error">
                    {walletError}
                  </div>
                )}
                <WalletMultiButton />
              </div>
            </header>
            <main>
              <TokenList />
            </main>
            <footer>
              <p>© 2025 Memefast Token Copy - For demonstration purposes only</p>
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;