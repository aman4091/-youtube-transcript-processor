# Google Drive - FULLY AUTOMATIC Setup! 🚀

## Super Simple - Just 2 Steps!

### Step 1: Add token.pickle
Put your `token.pickle` file in the project folder:
```
E:\appp\token.pickle
```

### Step 2: Start the app
```bash
npm run dev
```

**That's it!** ✨

## What Happens Automatically:

1. ✅ Token server starts in background
2. ✅ Token loads from token.pickle automatically
3. ✅ Token auto-refreshes when expired
4. ✅ NO manual copy-paste needed!
5. ✅ NO scripts to run!

## How to Use:

1. Open Settings
2. Enable "Google Drive Upload" checkbox
3. **Token loads automatically!** 🎉
4. Click Save

## Behind the Scenes:

- Background server runs on `http://localhost:5555`
- Reads token.pickle using Python
- Auto-refreshes expired tokens
- Caches token for 55 minutes
- All automatic - zero manual work!

## Troubleshooting:

**"Token server not running"**
- Make sure you started with `npm run dev` (not just vite)
- Check console for server startup message

**"token.pickle not found"**
- Put token.pickle in project root: `E:\appp\token.pickle`

**"Failed to refresh token"**
- Make sure Python is installed
- Install: `pip install google-auth`

## No More Manual Steps! 🎊

- ❌ No more running `extract_token.py`
- ❌ No more copy-pasting tokens
- ❌ No more manual token refresh
- ✅ Just enable checkbox and done!
