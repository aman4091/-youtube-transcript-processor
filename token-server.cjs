#!/usr/bin/env node
/**
 * Automatic Google Drive Token Server
 * Runs in background, automatically refreshes token from token.pickle
 * NO manual steps needed!
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5555;

app.use(cors());

// Global token cache
let cachedToken = null;
let tokenExpiry = null;

/**
 * Get token from token.pickle using Python
 */
function getTokenFromPickle() {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import pickle
import os
import sys

try:
    from google.auth.transport.requests import Request
    CAN_REFRESH = True
except ImportError:
    CAN_REFRESH = False

TOKEN_PICKLE = 'token.pickle'

if not os.path.exists(TOKEN_PICKLE):
    print('ERROR:token.pickle not found', file=sys.stderr)
    sys.exit(1)

try:
    with open(TOKEN_PICKLE, 'rb') as f:
        creds = pickle.load(f)

    # Auto-refresh if needed
    if CAN_REFRESH and creds:
        if not creds.valid and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(TOKEN_PICKLE, 'wb') as f:
                pickle.dump(creds, f)

    print(creds.token)
except Exception as e:
    print(f'ERROR:{e}', file=sys.stderr)
    sys.exit(1)
`;

    const python = spawn('python', ['-c', pythonScript]);
    let output = '';
    let error = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(error || 'Failed to get token'));
      } else {
        resolve(output.trim());
      }
    });
  });
}

/**
 * Get token with caching and auto-refresh
 */
async function getToken() {
  const now = Date.now();

  // Return cached token if still valid (valid for 55 minutes)
  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return cachedToken;
  }

  // Fetch fresh token
  try {
    const token = await getTokenFromPickle();
    cachedToken = token;
    tokenExpiry = now + (55 * 60 * 1000); // Cache for 55 minutes
    return token;
  } catch (error) {
    throw error;
  }
}

/**
 * API Endpoint: Get current token
 */
app.get('/token', async (req, res) => {
  try {
    const token = await getToken();
    res.json({
      success: true,
      token: token,
      message: 'Token retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Make sure token.pickle exists in the project folder'
    });
  }
});

/**
 * API Endpoint: Force refresh token
 */
app.get('/refresh', async (req, res) => {
  try {
    cachedToken = null;
    tokenExpiry = null;
    const token = await getToken();
    res.json({
      success: true,
      token: token,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * API Endpoint: Health check
 */
app.get('/health', (req, res) => {
  const tokenPickleExists = fs.existsSync(path.join(__dirname, 'token.pickle'));
  res.json({
    status: 'running',
    tokenPickleExists,
    hasCachedToken: !!cachedToken,
    message: tokenPickleExists
      ? 'Token server running, token.pickle found'
      : 'Token server running, but token.pickle not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Google Drive Token Server Started');
  console.log('='.repeat(60));
  console.log(`✓ Running on: http://localhost:${PORT}`);
  console.log(`✓ Token endpoint: http://localhost:${PORT}/token`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);

  // Check if token.pickle exists
  if (fs.existsSync(path.join(__dirname, 'token.pickle'))) {
    console.log('\n✅ token.pickle found - ready to serve tokens!');
  } else {
    console.log('\n⚠️  WARNING: token.pickle not found in project folder');
    console.log('   Please add token.pickle to use Google Drive upload');
  }

  console.log('\n💡 This server runs automatically with npm run dev');
  console.log('   No manual steps needed - tokens auto-refresh!');
  console.log('='.repeat(60) + '\n');
});
