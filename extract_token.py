#!/usr/bin/env python3
"""
Simple script to extract Google Drive access token from token.pickle
Run once, copy token to settings, done!
"""

import pickle
import os

try:
    from google.auth.transport.requests import Request
    CAN_REFRESH = True
except ImportError:
    print("⚠️  google-auth not installed. Token refresh not available.")
    print("   Install with: pip install google-auth")
    CAN_REFRESH = False

TOKEN_PICKLE = 'token.pickle'

def extract_token():
    """Extract access token from token.pickle"""

    if not os.path.exists(TOKEN_PICKLE):
        print(f"❌ Error: {TOKEN_PICKLE} not found!")
        print(f"   Please make sure {TOKEN_PICKLE} exists in the project folder.")
        return None

    try:
        print(f"📦 Reading {TOKEN_PICKLE}...")

        with open(TOKEN_PICKLE, 'rb') as token_file:
            credentials = pickle.load(token_file)

        print("✓ Token loaded successfully")

        # Check if token needs refresh
        if CAN_REFRESH and credentials and hasattr(credentials, 'valid'):
            if not credentials.valid:
                if credentials.expired and credentials.refresh_token:
                    print("🔄 Token expired, refreshing...")
                    credentials.refresh(Request())
                    print("✓ Token refreshed")

                    # Save refreshed token back
                    with open(TOKEN_PICKLE, 'wb') as token_file:
                        pickle.dump(credentials, token_file)
                    print(f"✓ Refreshed token saved to {TOKEN_PICKLE}")
                else:
                    print("⚠️  Token invalid and cannot be refreshed")

        print("\n" + "="*60)
        print("🎉 SUCCESS! Your Google Drive Access Token:")
        print("="*60)
        print(credentials.token)
        print("="*60)

        print("\n📋 How to use:")
        print("1. Copy the token above (the long string)")
        print("2. Open app → Settings (gear icon)")
        print("3. Scroll to 'Google Drive Integration'")
        print("4. Paste token in 'Google Drive Access Token' field")
        print("5. Check 'Enable Google Drive Upload'")
        print("6. Click 'Save Settings'")
        print("\n✅ Done! Token saved in settings forever.")
        print("⚠️  Token expires? Just run: python extract_token.py")
        print("="*60)

        # Also save to file for easy copy
        with open('extracted_token.txt', 'w') as f:
            f.write(credentials.token)
        print(f"\n💾 Token also saved to: extracted_token.txt")
        print("   (You can copy from this file too)")
        print("="*60)

        return credentials.token

    except Exception as e:
        print(f"❌ Error: {e}")
        print(f"   Make sure {TOKEN_PICKLE} is a valid Google OAuth token file")
        return None

if __name__ == '__main__':
    print("="*60)
    print("  Google Drive Token Extractor")
    print("="*60)
    extract_token()
