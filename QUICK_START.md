# Quick Start Guide - F5-TTS + Google Drive Integration

## Part 1: React App Setup (Local)

### Enable Google Drive Upload

1. **Start your React app:**
   ```bash
   npm install
   npm run dev
   ```

2. **Configure Google Drive in Settings:**
   - Click the Settings gear icon
   - Scroll to "Google Drive Settings" section
   - Enable "Upload to Google Drive"
   - Get your Google Drive Access Token:
     - Go to: https://developers.google.com/oauthplayground/
     - Select "Drive API v3" → scope: `/auth/drive.file`
     - Click "Authorize APIs"
     - Exchange authorization code for tokens
     - Copy the "Access token"
   - Enter the Access Token
   - (Optional) Enter Google Drive Folder ID where files should be saved
   - Click "Save Settings"

3. **Process Videos:**
   - Your final rewrites will now automatically upload to Google Drive!

---

## Part 2: Vast.ai Setup

### 1. Prepare Locally

```bash
# Create a new folder
mkdir f5tts_vastai
cd f5tts_vastai

# Copy these files from your project:
cp vast_ai_automation.py .
cp google_drive_manager.py .
cp audio_processor.py .
cp setup_environment.sh .
cp requirements.txt .

# Add your Google Drive credentials
# (Get these from Google Cloud Console - see VAST_AI_SETUP_README.md)
# Place credentials.json and token.pickle in this folder
```

### 2. On Vast.ai Terminal

```bash
# Navigate to workspace
cd /workspace
mkdir f5tts_project
cd f5tts_project

# Upload all files here (use Jupyter file upload or scp)
# Then run:

chmod +x setup_environment.sh
./setup_environment.sh
```

### 3. Download from Google Drive

```bash
# Replace FOLDER_ID with your Google Drive folder IDs

# Download scripts
python google_drive_manager.py download \
  --folder-id YOUR_SCRIPTS_FOLDER_ID \
  --local-path input/scripts/

# Download reference audio
python google_drive_manager.py download \
  --folder-id YOUR_AUDIO_FOLDER_ID \
  --local-path input/reference_audio/
```

### 4. Generate Audio

```bash
# Process your script
python audio_processor.py \
  --reference-audio input/reference_audio/reference.wav \
  --script input/scripts/script.txt \
  --output-folder-id YOUR_OUTPUT_FOLDER_ID \
  --whisper-model base
```

**That's it!** Audio chunks will be generated and automatically uploaded to Google Drive as they're created.

---

## Complete Workflow Example

### Scenario: Convert YouTube Transcript to Audio

1. **Get Transcript (React App):**
   - Paste YouTube URL
   - Wait for AI processing
   - Select final rewrite
   - Downloads locally + uploads to Drive

2. **Prepare Script:**
   - Open Drive file
   - Copy text to a new file: `my_script.txt`
   - Upload to your Drive scripts folder

3. **Record Reference Audio:**
   - Record 10-30 seconds of your voice
   - Upload to Drive reference_audio folder

4. **Generate Audio (Vast.ai):**
   ```bash
   # Download everything
   python google_drive_manager.py download \
     --folder-id YOUR_INPUT_FOLDER_ID \
     --local-path input/

   # Process
   python audio_processor.py \
     --reference-audio input/reference_audio/my_voice.wav \
     --script input/scripts/my_script.txt \
     --output-folder-id YOUR_OUTPUT_FOLDER_ID
   ```

5. **Result:**
   - Generated audio chunks uploaded to Drive
   - Final merged audio uploaded to Drive
   - Download from Drive and use!

---

## Folder Structure in Google Drive

```
My Drive/
└── F5TTS_Project/
    ├── rewrites/           # Auto-uploaded from React app
    │   └── Gemini_2_5_Flash_output_2025-01-15.txt
    │
    ├── scripts/           # Text scripts to convert
    │   └── my_script.txt
    │
    ├── reference_audio/   # Your voice samples
    │   └── my_voice.wav
    │
    └── generated_audio/   # Auto-uploaded generated audio
        ├── my_script_chunk_001.wav
        ├── my_script_chunk_002.wav
        └── my_script_complete.wav
```

---

## Tips

### For Better Audio Quality:
1. Use clear reference audio (no background noise)
2. Reference audio should be 10-30 seconds
3. Speak naturally in reference
4. Use `small` or `medium` Whisper model for better transcription

### For Faster Processing:
1. Use `tiny` or `base` Whisper model
2. Rent GPU with more VRAM
3. Process multiple scripts in parallel

### Cost Saving:
1. Test with small scripts first
2. Stop Vast.ai instance when not using
3. Use spot instances (cheaper but can be interrupted)

---

## Common Issues

**Q: React app says "Drive upload failed"**
- Check if access token is valid (they expire)
- Re-authenticate in OAuth Playground
- Update token in settings

**Q: Vast.ai says "credentials not found"**
- Make sure you uploaded `credentials.json` and `token.pickle`
- Check files are in `/workspace/f5tts_project/`

**Q: Audio sounds robotic**
- Use better reference audio
- Try larger Whisper model
- Ensure reference text matches audio

**Q: Process is slow**
- Rent faster GPU (RTX 3090 recommended)
- Use smaller Whisper model
- Process in chunks

---

## Next Steps

1. Read `VAST_AI_SETUP_README.md` for detailed setup
2. Check `README.md` for React app details
3. Explore F5-TTS documentation for advanced features

Happy audio generating!
