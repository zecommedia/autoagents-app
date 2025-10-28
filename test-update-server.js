// Development Update Server - Mock GitHub Releases API
// Dùng để test auto-update locally without publishing to GitHub

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5555;

// Mock latest release info
const LATEST_VERSION = '1.0.1';
const CURRENT_VERSION = '1.0.0';

// Mock GitHub Releases API endpoint
app.get('/repos/:owner/:repo/releases/latest', (req, res) => {
  console.log(`📡 Update check from app version ${req.headers['user-agent']}`);
  
  const latestRelease = {
    tag_name: `v${LATEST_VERSION}`,
    name: `AutoAgents Agent v${LATEST_VERSION}`,
    body: `## 🎉 What's New in v${LATEST_VERSION}

### ✨ New Features
- Auto-update system implemented
- Remote API support added
- Settings dialog for API configuration

### 🐛 Bug Fixes
- Fixed passive event listener warnings
- Improved Mockup mode file selection

### 📝 Documentation
- Added comprehensive guides
- PowerShell commands reference

Download and install to get the latest features!`,
    published_at: new Date().toISOString(),
    assets: [
      {
        name: `AutoAgents-Agent-${LATEST_VERSION}-Setup.exe`,
        browser_download_url: `http://localhost:${PORT}/download/AutoAgents-Agent-${LATEST_VERSION}-Setup.exe`,
        size: 115000000,
        content_type: 'application/octet-stream'
      }
    ]
  };

  res.json(latestRelease);
});

// Mock download endpoint (return dummy file for testing)
app.get('/download/:filename', (req, res) => {
  console.log(`📥 Download request for ${req.params.filename}`);
  
  // In real scenario, this would serve the actual installer
  // For testing, we just send a response
  res.status(200).send('Mock installer file - In production this would be the actual .exe file');
});

// YAML feed for electron-updater - MUST BE BEFORE the general :filename route
app.get('/repos/:owner/:repo/releases/latest/download/latest.yml', (req, res) => {
  console.log('✅ Request: GET /repos/.../releases/latest/download/latest.yml');
  
  const yml = `version: ${LATEST_VERSION}
files:
  - url: http://localhost:${PORT}/repos/${req.params.owner}/${req.params.repo}/releases/latest/download/AutoAgents-Agent-${LATEST_VERSION}-Setup.exe
    sha512: mock-sha512-hash
    size: 115000000
path: AutoAgents-Agent-${LATEST_VERSION}-Setup.exe
sha512: mock-sha512-hash
releaseDate: ${new Date().toISOString()}`;

  res.type('text/yaml').send(yml);
});

// Simple latest.yml at root - CORRECT FORMAT FOR WINDOWS NSIS
app.get('/latest.yml', (req, res) => {
  console.log('✅ Request: GET /latest.yml');
  
  const yml = `version: ${LATEST_VERSION}
path: AutoAgents-Agent-Setup-${LATEST_VERSION}.exe
sha512: abc123def456mock
releaseDate: ${new Date().toISOString()}`;

  res.type('text/yaml').send(yml);
});

// Download endpoint for the installer
app.get('/AutoAgents-Agent-Setup-:version.exe', (req, res) => {
  console.log(`✅ Download: AutoAgents-Agent-Setup-${req.params.version}.exe`);
  res.status(200).send('Mock installer - 1KB test file');
});

// Mock download endpoint for full path
app.get('/repos/:owner/:repo/releases/latest/download/:filename', (req, res) => {
  console.log(`📥 Download request for ${req.params.filename}`);
  res.status(200).send('Mock installer file - In production this would be the actual .exe file');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mock update server running' });
});

app.listen(PORT, () => {
  console.log('🚀 Mock Update Server Started');
  console.log('================================');
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`📦 Latest Version: ${LATEST_VERSION}`);
  console.log(`🔄 Current App Version: ${CURRENT_VERSION}`);
  console.log('');
  console.log('💡 To test auto-update:');
  console.log('   1. Make sure app version is 1.0.0 in package.json');
  console.log('   2. Update electron/updater.js to point to this mock server');
  console.log('   3. Build and run the app');
  console.log('   4. App should detect version 1.0.1 is available');
  console.log('================================');
});
