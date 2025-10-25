import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const CLOUD_API_URL = process.env.CLOUD_API_URL || 'https://ditech-api.auto-agents.org';

let userConfig = {
  userId: '',
  token: '',
  licenseKey: ''
};

// Load user config
async function loadConfig() {
  try {
    const configPath = path.join(__dirname, '../.config/user.json');
    const data = await fs.readFile(configPath, 'utf-8');
    userConfig = JSON.parse(data);
    console.log('✅ Config loaded:', { userId: userConfig.userId });
  } catch (error) {
    console.warn('⚠️ No config found, user needs to login');
  }
}

// Save config
async function saveConfig(config) {
  const configDir = path.join(__dirname, '../.config');
  await fs.mkdir(configDir, { recursive: true });
  const configPath = path.join(configDir, 'user.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  userConfig = config;
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    userId: userConfig.userId,
    hasToken: !!userConfig.token
  });
});

// Login endpoint
app.post('/auth/login', async (req, res) => {
  const { licenseKey } = req.body;
  
  try {
    const response = await axios.post(`${CLOUD_API_URL}/auth/verify`, {
      licenseKey,
      machineId: await getMachineId()
    });
    
    const { valid, userId, token, features } = response.data;
    
    if (!valid) {
      return res.status(403).json({ error: 'Invalid license key' });
    }
    
    await saveConfig({ userId, token, licenseKey });
    
    res.json({ 
      success: true, 
      userId, 
      features 
    });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint for AI generation (forward to cloud)
app.post('/api/redesign', async (req, res) => {
  if (!userConfig.token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { image, prompt, mode } = req.body;
  const startTime = Date.now();
  
  try {
    const response = await axios.post(
      `${CLOUD_API_URL}/proxy/redesign`,
      { image, prompt, mode },
      {
        headers: {
          'Authorization': `Bearer ${userConfig.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ Redesign completed in ${processingTime}ms`);
    
    res.json(response.data);
  } catch (error) {
    console.error('❌ Redesign failed:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error || error.message 
    });
  }
});

// Video generation proxy
app.post('/api/video', async (req, res) => {
  if (!userConfig.token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const response = await axios.post(
      `${CLOUD_API_URL}/proxy/video`,
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${userConfig.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('❌ Video generation failed:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error || error.message 
    });
  }
});

// Mockup generation proxy
app.post('/api/mockup', async (req, res) => {
  if (!userConfig.token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const response = await axios.post(
      `${CLOUD_API_URL}/proxy/mockup`,
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${userConfig.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('❌ Mockup generation failed:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error || error.message 
    });
  }
});

// Canvas generation proxy
app.post('/api/canvas/generate', async (req, res) => {
  if (!userConfig.token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const response = await axios.post(
      `${CLOUD_API_URL}/proxy/canvas/generate`,
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${userConfig.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('❌ Canvas generation failed:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error || error.message 
    });
  }
});

// Telemetry endpoint (local processing tracking)
app.post('/telemetry', async (req, res) => {
  if (!userConfig.token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { feature, processingTime, method, imageSize } = req.body;
  
  // Calculate cost for local processing
  const localProcessingCost = (processingTime / 1000) * 0.0001; // $0.0001 per second
  
  // Send to cloud (async, don't wait)
  axios.post(
    `${CLOUD_API_URL}/telemetry/local`,
    {
      userId: userConfig.userId,
      feature,
      metadata: {
        processingTime,
        method,
        imageSize,
        cost: localProcessingCost,
        processedLocally: true
      }
    },
    {
      headers: { 'Authorization': `Bearer ${userConfig.token}` }
    }
  ).catch(err => console.error('Failed to send telemetry:', err.message));
  
  res.json({ success: true });
});

// Get machine ID
async function getMachineId() {
  const { machineId } = await import('node-machine-id');
  return machineId();
}

// Initialize and start server
loadConfig()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Local server running on http://localhost:${PORT}`);
      console.log(`📡 Cloud API: ${CLOUD_API_URL}`);
      console.log(`👤 User: ${userConfig.userId || 'Not logged in'}`);
    });
  })
  .catch(console.error);

export default app;
