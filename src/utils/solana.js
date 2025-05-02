import { 
    clusterApiUrl, 
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL
  } from '@solana/web3.js';
  
  import {
    createInitializeMintInstruction,
    getMinimumBalanceForRentExemptMint,
    TOKEN_PROGRAM_ID,
    MINT_SIZE,
    createMintToInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction
  } from '@solana/spl-token';
  
  /**
   * Create a new SPL token
   * @param {Connection} connection - Solana connection
   * @param {PublicKey} payer - Wallet public key
   * @param {Function} signTransaction - Function to sign transaction
   * @param {string} name - Token name
   * @param {string} symbol - Token symbol
   * @param {number} supply - Initial supply
   * @param {number} decimals - Decimal precision
   * @returns {Promise<string>} - New token address
   */
  export const createToken = async (
    connection,
    payer,
    signTransaction,
    name,
    symbol,
    supply,
    decimals = 9
  ) => {
    try {
      // Create a new keypair for the mint
      const mintKeypair = Keypair.generate();
      const mintPublicKey = mintKeypair.publicKey;
  
      // Calculate rent-exempt minimum balance
      const lamports = await getMinimumBalanceForRentExemptMint(connection);
  
      // 1. Create account for mint
      const createAccountInstruction = SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mintPublicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      });
  
      // 2. Initialize mint instruction
      const initializeMintInstruction = createInitializeMintInstruction(
        mintPublicKey,
        decimals,
        payer,
        payer,
        TOKEN_PROGRAM_ID
      );
  
      // 3. Get associated token account address
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintPublicKey,
        payer,
        false,
        TOKEN_PROGRAM_ID
      );
  
      // 4. Create associated token account instruction
      const createAssociatedTokenAccountIx = createAssociatedTokenAccountInstruction(
        payer,
        associatedTokenAddress,
        payer,
        mintPublicKey,
        TOKEN_PROGRAM_ID
      );
  
      // 5. Create mint to instruction (with initial supply)
      const mintToIx = createMintToInstruction(
        mintPublicKey,
        associatedTokenAddress,
        payer,
        supply * Math.pow(10, decimals),
        [],
        TOKEN_PROGRAM_ID
      );
  
      // 6. Create transaction and add all instructions
      const transaction = new Transaction().add(
        createAccountInstruction,
        initializeMintInstruction,
        createAssociatedTokenAccountIx,
        mintToIx
      );
  
      // Set recent blockhash and fee payer
      transaction.feePayer = payer;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
      // Partially sign the transaction (for the new mint account)
      transaction.partialSign(mintKeypair);
  
      // Have the user sign the transaction
      const signedTransaction = await signTransaction(transaction);
  
      // Send the transaction
      const txid = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(txid);
  
      // Return the mint address
      return mintPublicKey.toString();
    } catch (error) {
      console.error('Error creating token:', error);
      throw error;
    }
  };
  
  export default {
    createToken
  };