import React, { useState, useEffect } from 'react';
import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';

// Adjust to your local runway server endpoint
const RUNWAY_SERVER_ENDPOINT = 'http://localhost:3001/convert-to-video';

export default function App() {
  const [walletPubkey, setWalletPubkey] = useState(null);
  const [nfts, setNfts] = useState([]); // fetched NFT list
  const [videos, setVideos] = useState([]); // "converted" results
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [promptText, setPromptText] = useState('NFT is dancing in a meadow');
  const [model, setModel] = useState('gen3a_turbo'); // Just an example

  // 1. Phantom check + connect
  const isPhantomInstalled = () => {
    return window.solana && window.solana.isPhantom;
  };

  const connectPhantom = async () => {
    if (!isPhantomInstalled()) {
      alert('Please install Phantom wallet first!');
      return;
    }
    try {
      const resp = await window.solana.connect();
      setWalletPubkey(resp.publicKey.toString());
    } catch (err) {
      console.error('Phantom connect error:', err);
    }
  };

  // 2. On walletPubkey change, fetch the NFTs
  useEffect(() => {
    if (!walletPubkey) return;

    async function fetchNFTsForWallet(pubkeyStr) {
      try {
        // Connect to mainnet (adjust if you want devnet)
        const connection = new Connection(clusterApiUrl('mainnet-beta'));
        // We do not actually need a real "wallet adapter" identity for read-only calls,
        // but Metaplex requires an identity to be set. We'll just use a "dummy" approach.
        const metaplex = new Metaplex(connection);
        // If you want to eventually sign transactions with Metaplex, you'd do:
        //   metaplex.use(walletAdapterIdentity(yourWalletAdapter))
        // For now, just read.

        // Convert to PublicKey
        const ownerPublicKey = new PublicKey(pubkeyStr);

        // Find all NFTs for that owner
        const nftArray = await metaplex.nfts().findAllByOwner({ owner: ownerPublicKey });

        // The above array contains "Sft" or "Nft" objects with metadata.
        // We'll filter out anything that doesn't have an on-chain metadata address or isn't standard.
        // Then we'll fetch the JSON metadata to get the image URI (some might fail if corrupted).
        const validNfts = [];
        for (const token of nftArray) {
          try {
            // fetch the metadata JSON. Metaplex tries to do it automatically if we use .load(), e.g.:
            const nft = await metaplex.nfts().load({ metadata: token.metadataAddress });
            // We'll push an object with the image, mint, etc.
            validNfts.push({
              mint: token.mintAddress.toBase58(),
              name: nft.name,
              imageUrl: nft.json?.image, // many NFT metadata JSON files have an "image" field
            });
          } catch (e) {
            console.warn(`Failed to load NFT metadata for ${token.mintAddress.toBase58()}`, e);
          }
        }

        // set state
        setNfts(validNfts);
        console.log('Fetched NFTs:', validNfts);
      } catch (err) {
        console.error('Error fetching NFTs', err);
      }
    }

    fetchNFTsForWallet(walletPubkey);
  }, [walletPubkey]);

  // 3. Convert the selected NFTs to video
  const convertNFTsToVideo = async () => {
    if (nfts.length === 0) {
      alert('No NFTs to convert or not loaded yet!');
      return;
    }

    setLoading(true);
    setLoadingProgress(0);
    setVideos([]);

    try {
      // Collect the image URLs, filter out any that might be empty
      const imageUrls = nfts
        .map((n) => n.imageUrl)
        .filter((url) => url && url.startsWith('http')); // basic check

      if (imageUrls.length === 0) {
        throw new Error('No valid NFT image URLs found');
      }

      const body = {
        model,
        imageUrls,
        promptText,
      };

      const res = await fetch(RUNWAY_SERVER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error);
      }
      const data = await res.json();
      console.log('RunwayML results:', data);

      // Simulate "1 item at a time" loading
      for (let i = 0; i < data.results.length; i++) {
        setVideos((prev) => [...prev, data.results[i]]);
        const progressPercent = Math.floor(((i + 1) / data.results.length) * 100);
        setLoadingProgress(progressPercent);

        await new Promise((r) => setTimeout(r, 800)); // small delay for demo
      }
    } catch (err) {
      console.error('Error calling local server:', err);
      alert('Conversion failed: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingProgress(100);
    }
  };

  return (
    <div style={styles.container}>
      <h1>My NFT to Movie App</h1>

      {/* Connect wallet button */}
      {!walletPubkey ? (
        <button style={styles.button} onClick={connectPhantom}>
          Connect Phantom
        </button>
      ) : (
        <div>
          <p>Connected wallet: {walletPubkey}</p>
        </div>
      )}

      {/* NFT grid */}
      {nfts.length > 0 && (
        <div style={styles.grid}>
          {nfts.map((n) => (
            <div key={n.mint} style={styles.nftCard}>
              {n.imageUrl ? (
                <img
                  src={n.imageUrl}
                  alt={n.name || n.mint}
                  style={{ width: '100%', height: 'auto' }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <p>No image</p>
                </div>
              )}
              <p>{n.name || n.mint}</p>
            </div>
          ))}
        </div>
      )}

      {/* Panel for runway model + promptText */}
      <div style={styles.panel}>
        <h3>Runway Settings</h3>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ marginRight: '10px' }}>Prompt text:</label>
          <input
            type="text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ marginRight: '10px' }}>Model:</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={styles.input}
          />
        </div>
        <button style={styles.button} onClick={convertNFTsToVideo}>
          Convert NFTs to Movie
        </button>
      </div>

      {/* Loading bar */}
      {loading && (
        <div style={styles.loadingContainer}>
          <p>Converting images... {loadingProgress}%</p>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${loadingProgress}%` }} />
          </div>
        </div>
      )}

      {/* Display resulting videos */}
      {videos.length > 0 && (
        <div style={styles.videoGrid}>
          {videos.map((v, idx) => (
            <div key={idx} style={styles.videoCard}>
              <h4>Video result #{idx + 1}</h4>
              {/* If the runway response includes an actual video url: */}
              {/* <video src={v.videoUrl} controls style={{ width: '100%', height: 'auto' }} /> */}
              <p>Runway response ID: {v.id}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Some simple styles
const styles = {
  container: {
    textAlign: 'center',
    marginTop: '40px',
    fontFamily: 'Arial, sans-serif',
    padding: '20px',
  },
  button: {
    backgroundColor: '#bf211e',
    color: '#eef4ed',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '5px',
    cursor: 'pointer',
    margin: '0 10px',
  },
  grid: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    margin: '20px 0',
  },
  nftCard: {
    width: '200px',
    border: '1px solid #54577c',
    borderRadius: '5px',
    padding: '10px',
  },
  panel: {
    display: 'inline-block',
    textAlign: 'left',
    border: '1px solid #54577c',
    borderRadius: '5px',
    padding: '20px',
    marginTop: '20px',
    backgroundColor: '#f5f5f5',
  },
  input: {
    padding: '6px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    width: '250px',
  },
  loadingContainer: {
    marginTop: '20px',
  },
  progressBar: {
    width: '50%',
    margin: '0 auto',
    height: '10px',
    backgroundColor: '#ddd',
    borderRadius: '5px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#54577c',
    transition: 'width 0.5s ease',
  },
  videoGrid: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    marginTop: '20px',
  },
  videoCard: {
    border: '1px solid #54577c',
    borderRadius: '5px',
    padding: '10px',
    width: '300px',
  },
};
