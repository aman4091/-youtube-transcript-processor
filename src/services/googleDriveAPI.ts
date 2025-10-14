import axios from 'axios';

const AUTH_SERVER_URL = 'http://localhost:5000';

export interface DriveUploadResponse {
  fileId: string;
  webViewLink: string;
  error?: string;
}

export interface DriveAuthStatus {
  authenticated: boolean;
  token_exists?: boolean;
  credentials_exists?: boolean;
  valid?: boolean;
  expired?: boolean;
  message: string;
  error?: string;
}

/**
 * Upload text content to Google Drive
 * Note: This is a browser-based implementation using Google Drive REST API
 */
export async function uploadToGoogleDrive(
  content: string,
  filename: string,
  accessToken: string,
  folderId?: string
): Promise<DriveUploadResponse> {
  try {
    // Create file metadata
    const metadata = {
      name: filename,
      mimeType: 'text/plain',
      ...(folderId && { parents: [folderId] }),
    };

    // Create multipart upload
    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/plain\r\n\r\n' +
      content +
      closeDelimiter;

    const response = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      multipartRequestBody,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
      }
    );

    return {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        return {
          fileId: '',
          webViewLink: '',
          error: 'Google Drive access token is invalid or expired. Please re-authenticate.',
        };
      }
      if (error.response?.status === 403) {
        return {
          fileId: '',
          webViewLink: '',
          error: 'Insufficient permissions. Please ensure Drive access is granted.',
        };
      }
      return {
        fileId: '',
        webViewLink: '',
        error: `Upload failed: ${error.response?.data?.error?.message || error.message}`,
      };
    }
    throw error;
  }
}

/**
 * Get Google OAuth2 access token from credentials
 * This is a simplified approach - in production, you'd want proper OAuth flow
 */
export async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get access token:', error);
    throw new Error('Failed to authenticate with Google Drive');
  }
}

/**
 * Initialize Google Drive OAuth flow
 * Opens a popup for user to authenticate
 */
export function initiateGoogleDriveAuth(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const redirectUri = window.location.origin;
    const scope = 'https://www.googleapis.com/auth/drive.file';

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(scope)}`;

    const authWindow = window.open(authUrl, 'Google Drive Auth', 'width=500,height=600');

    const checkInterval = setInterval(() => {
      try {
        if (authWindow?.closed) {
          clearInterval(checkInterval);
          reject(new Error('Authentication window closed'));
        }

        // Check if we got redirected back with token
        const url = authWindow?.location.href;
        if (url?.includes('access_token=')) {
          const params = new URLSearchParams(url.split('#')[1]);
          const accessToken = params.get('access_token');

          if (accessToken) {
            clearInterval(checkInterval);
            authWindow?.close();
            resolve(accessToken);
          }
        }
      } catch (e) {
        // Cross-origin error - expected until redirect back to our domain
      }
    }, 500);
  });
}

/**
 * Get access token from local auth server (uses token.pickle)
 */
export async function getTokenFromAuthServer(): Promise<string> {
  try {
    const response = await axios.get(`${AUTH_SERVER_URL}/api/drive/token`);

    if (response.data.success && response.data.access_token) {
      return response.data.access_token;
    }

    throw new Error(response.data.error || 'Failed to get token from auth server');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        throw new Error(
          'Auth server not running. Please start it with: python google_auth_server.py'
        );
      }
      throw new Error(
        error.response?.data?.error || 'Failed to get token from auth server'
      );
    }
    throw error;
  }
}

/**
 * Check authentication status from auth server
 */
export async function checkAuthStatus(): Promise<DriveAuthStatus> {
  try {
    const response = await axios.get(`${AUTH_SERVER_URL}/api/drive/status`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        return {
          authenticated: false,
          message: 'Auth server not running',
          error: 'Please start the auth server with: python google_auth_server.py',
        };
      }
    }
    return {
      authenticated: false,
      message: 'Error checking status',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Trigger new authentication flow on auth server
 */
export async function authenticateWithAuthServer(): Promise<{ success: boolean; message: string; access_token?: string }> {
  try {
    const response = await axios.post(`${AUTH_SERVER_URL}/api/drive/authenticate`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.error || 'Failed to authenticate with auth server'
      );
    }
    throw error;
  }
}
