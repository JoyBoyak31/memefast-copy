import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

function WalletConnection() {
  const { publicKey } = useWallet();

  return (
    <div className="wallet-connection">
      {publicKey ? (
        <div>
          <p>Connected: {publicKey.toString().slice(0, 6)}...{publicKey.toString().slice(-4)}</p>
          <WalletMultiButton />
        </div>
      ) : (
        <div>
          <p>Connect your wallet to use this app</p>
          <WalletMultiButton />
        </div>
      )}
    </div>
  );
}

export default WalletConnection;