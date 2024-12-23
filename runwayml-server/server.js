import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Helius } from 'helius-sdk';
import RunwayML from '@runwayml/sdk';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 42354235;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Helius SDK
const helius = new Helius(process.env.HELIUS_API_KEY);

// Initialize RunwayML SDK
const runwayClient = new RunwayML({
  apiKey: process.env.RUNWAYML_API_SECRET,
});

// Endpoint to fetch NFTs for a given wallet address
app.post('/fetch-nfts', async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: 'walletAddress is required' });
  }

  try {
    console.log(`Fetching NFTs for wallet: ${walletAddress}`);

    const response = await helius.rpc.getTokenAccounts({
      page: 1,
      limit: 100,
      options: {
        showZeroBalance: false,
      },
      owner: walletAddress,
    });

    const tokenAccounts = response?.token_accounts || [];
    if (tokenAccounts.length === 0) {
      console.log(`No token accounts found for wallet: ${walletAddress}`);
      return res.json({ nfts: [] });
    }

    const mintAddresses = tokenAccounts.map((token) => token.mint);

    const assetsResponse = await helius.rpc.getAssetBatch({ ids: mintAddresses });

    const nfts = assetsResponse.map((asset) => {
      const files = asset?.content?.files || [];
      const cdnFile = files.find((file) => file.cdn_uri) || {};
      return {
        name: asset?.content?.metadata?.name || `NFT ${asset.id}`,
        imageUri: cdnFile.cdn_uri || '',
        mint: asset.id,
      };
    }).filter((nft) => nft.imageUri);

    console.log(`Fetched ${nfts.length} NFTs for wallet: ${walletAddress}`);
    res.json({ nfts });
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch NFTs' });
  }
});

// Endpoint to convert NFTs to movies using RunwayML
app.post('/convert-to-video', async (req, res) => {
    const { model, imageUrls, promptText } = req.body;
  
    if (!model || !imageUrls || !promptText) {
      console.error('Error: Missing required fields in request body.');
      return res.status(400).json({ error: 'Missing required fields: model, imageUrls, promptText' });
    }
  
    try {
      console.info(`Starting video conversion for ${imageUrls.length} NFTs using model: ${model}`);
  
      const results = await Promise.all(
        imageUrls.map(async (url, index) => {
          try {
            console.info(`Processing NFT #${index + 1} with image URL: ${url}`);
  
            // Step 1: Create a new task
            const imageToVideo = await runwayClient.imageToVideo.create({
              model: model,
              promptImage: url,
              promptText: promptText,
            });
  
            const taskId = imageToVideo.id;
            console.info(`Task created for NFT #${index + 1}, Task ID: ${taskId}`);
  
            // Step 2: Poll the task status until it's complete
            let task;
            do {
              console.info(`Polling status for Task ID: ${taskId}`);
              await new Promise((resolve) => setTimeout(resolve, 5000)); // Poll every 5 seconds
              task = await runwayClient.tasks.retrieve(taskId);
  
              // Log percentage progress if available
              if (task.progress !== undefined) {
                console.info(`Task ID: ${taskId} progress: ${task.progress}%`);
              } else {
                console.info(`Task ID: ${taskId} status: ${task.status}`);
              }
            } while (!['SUCCEEDED', 'FAILED'].includes(task.status));
  
            if (task.status === 'SUCCEEDED') {
              console.info(`Task ID: ${taskId} succeeded. Video URL: ${task.output?.[0]}`);
              return {
                id: taskId,
                videoUrl: task.output?.[0] || '', // Use the first output URL
              };
            } else {
              console.warn(`Task ID: ${taskId} failed.`);
              return null;
            }
          } catch (err) {
            console.error(`Error processing NFT with image URL: ${url}. Error:`, err.message);
            return null;
          }
        })
      );
  
      // Filter successful results
      const validResults = results.filter((result) => result !== null);
  
      if (validResults.length > 0) {
        console.info(`Video conversion completed. ${validResults.length} videos successfully generated.`);
        res.json({ success: true, results: validResults });
      } else {
        console.error('All video conversions failed. No valid results to return.');
        res.status(500).json({ error: 'No videos were successfully generated.' });
      }
    } catch (error) {
      console.error('Critical error during video conversion:', error.message);
      res.status(500).json({ error: error.message || 'Failed to convert NFTs to movies' });
    }
  });
  
  
  

// Basic test endpoint
app.get('/', (req, res) => {
  res.send('RunwayML Server is running!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`RunwayML server listening on port ${PORT}`);
});
