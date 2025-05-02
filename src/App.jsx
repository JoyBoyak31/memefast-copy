import React from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import TokenList from './components/token/TokenList';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
  // Set up Solana network (Devnet for testing)
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = clusterApiUrl(network);
  
  // Initialize wallet adapters
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter()
  ];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="app">
            <header>
              <h1>Pump.fun Token Copy</h1>
              <WalletMultiButton />
            </header>
            <main>
              <TokenList />
            </main>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;