import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Backend server endpoints
const BACKEND_FETCH_NFTS_ENDPOINT = 'http://localhost:23423/fetch-nfts';
const BACKEND_CONVERT_VIDEO_ENDPOINT = 'http://localhost:23423/convert-to-video';

export default function App() {
  const [walletPubkey, setWalletPubkey] = useState(null);
  const [nfts, setNfts] = useState([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

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
      alert('Failed to connect to Phantom wallet.');
    }
  };

  useEffect(() => {
    if (walletPubkey) {
      fetchNFTs(walletPubkey);
    }
  }, [walletPubkey]);

  const fetchNFTs = async (pubkey) => {
    try {
      setLoadingNFTs(true);
      setNfts([]);

      const response = await axios.post(BACKEND_FETCH_NFTS_ENDPOINT, {
        walletAddress: pubkey,
      });

      const fetchedNFTs = response.data.nfts;

      // Filter NFTs with valid image URIs
      const validNFTs = await Promise.all(
        fetchedNFTs.map(async (nft) => {
          try {
            const res = await axios.head(nft.imageUri);
            return res.status === 200 ? nft : null;
          } catch {
            return null;
          }
        })
      );

      setNfts(validNFTs.filter(Boolean));
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      alert('Failed to fetch NFTs. Please try again.');
    } finally {
      setLoadingNFTs(false);
    }
  };

  const convertNFTToMovie = async (imageUri) => {
    if (!imageUri) {
      alert('Invalid NFT selected.');
      return;
    }
    setIsConverting(true);
    setSelectedMovie(null);

    try {
      const body = {
        model: 'gen3a_turbo',
        imageUrls: [imageUri],
        promptText: 'NFT is dancing',
      };

      const response = await axios.post(BACKEND_CONVERT_VIDEO_ENDPOINT, body, {
        headers: { 'Content-Type': 'application/json' },
      });

      const runwayResult = response.data.results?.[0];
      if (runwayResult && runwayResult.videoUrl) {
        setSelectedMovie(runwayResult.videoUrl);
      } else {
        alert('Failed to retrieve video. Please try again.');
      }
    } catch (error) {
      console.error('Error converting NFT:', error);
      alert('Conversion failed. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1>NFT to Movie App</h1>

      {!walletPubkey ? (
        <button style={styles.button} onClick={connectPhantom}>
          Connect Phantom
        </button>
      ) : (
        <p>Connected Wallet: {walletPubkey}</p>
      )}

      {loadingNFTs && <p>Loading your NFTs...</p>}

      {nfts.length > 0 && (
        <div style={styles.grid}>
          {nfts.map((nft, idx) => (
            <div key={idx} style={styles.nftCard}>
              {nft.imageUri ? (
                <img
                  src={nft.imageUri}
                  alt={nft.name || `NFT ${idx + 1}`}
                  style={{ width: '100%', height: 'auto' }}
                />
              ) : (
                <p>No image available</p>
              )}
              <p style={{ marginTop: '5px' }}>{nft.name || `NFT ${idx + 1}`}</p>
              <button
                style={styles.button}
                onClick={() => convertNFTToMovie(nft.imageUri)}
              >
                Watch as Movie
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.cinema}>
        <h2>NFT Theatre</h2>
        {isConverting ? (
          <div style={styles.loader} />
        ) : selectedMovie ? (
          <video
            src={selectedMovie}
            controls
            autoPlay
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <p>Select an NFT to view it as a movie.</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    textAlign: 'center',
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
    marginTop: '10px',
    fontSize: '1rem',
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
    textAlign: 'center',
    boxShadow: '2px 2px 12px rgba(0,0,0,0.1)',
  },
  cinema: {
    marginTop: '40px',
    textAlign: 'center',
    width: '80%',
    height: '500px',
    margin: '40px auto',
    padding: '20px',
    border: '2px solid #54577c',
    borderRadius: '10px',
    boxShadow: '2px 2px 12px rgba(0,0,0,0.2)',
    backgroundColor: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    border: '8px solid #f3f3f3',
    borderTop: '8px solid #54577c',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite',
  },
};
