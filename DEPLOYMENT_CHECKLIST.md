# Deployment Checklist

## Pre-Deployment Preparation

### ☐ Google Drive Setup

- [ ] Create Google Cloud Project
- [ ] Enable Google Drive API
- [ ] Create OAuth 2.0 credentials
- [ ] Download `credentials.json`
- [ ] Generate `token.pickle` (run local auth script)
- [ ] Create Drive folder structure:
  ```
  F5TTS_Project/
  ├── rewrites/
  ├── input/
  │   ├── scripts/
  │   └── reference_audio/
  └── output/
      └── generated_audio/
  ```
- [ ] Note down all folder IDs from URLs

### ☐ Local Files Ready

- [ ] `credentials.json` - Ready to upload
- [ ] `token.pickle` - Ready to upload
- [ ] `vast_ai_automation.py` - Downloaded
- [ ] `google_drive_manager.py` - Downloaded
- [ ] `audio_processor.py` - Downloaded
- [ ] `run_complete_pipeline.py` - Downloaded
- [ ] `setup_environment.sh` - Downloaded
- [ ] `requirements.txt` - Downloaded
- [ ] `config.example.json` - Downloaded

### ☐ Reference Audio Ready

- [ ] Record 10-30 seconds of clear voice
- [ ] No background noise
- [ ] Natural speaking tone
- [ ] Save as WAV or MP3
- [ ] Upload to Drive `reference_audio/` folder

### ☐ Test Scripts Ready

- [ ] Create test script (100-500 chars)
- [ ] Upload to Drive `scripts/` folder
- [ ] Verify file is accessible

---

## React App Setup

### ☐ Install and Configure

- [ ] Run `npm install`
- [ ] Run `npm run dev`
- [ ] Open http://localhost:5173
- [ ] Click Settings (gear icon)

### ☐ Configure API Keys

- [ ] SupaData API Key
- [ ] DeepSeek API Key
- [ ] Google Gemini API Key
- [ ] OpenRouter API Key
- [ ] Custom prompt (optional)

### ☐ Configure Google Drive

- [ ] Get OAuth access token from:
  https://developers.google.com/oauthplayground/
- [ ] Select scope: `https://www.googleapis.com/auth/drive.file`
- [ ] Authorize and get token
- [ ] Enter token in settings
- [ ] Enter Drive folder ID for uploads
- [ ] Enable "Upload to Google Drive"
- [ ] Save settings

### ☐ Test React App

- [ ] Paste YouTube URL
- [ ] Wait for transcript
- [ ] Check AI processing
- [ ] Select final output
- [ ] Verify local download
- [ ] Verify Drive upload

---

## Vast.ai Deployment

### ☐ Rent GPU Instance

- [ ] Sign up at https://vast.ai/
- [ ] Add credits to account
- [ ] Search for instance:
  - CUDA 11.8+
  - 16GB+ VRAM (RTX 3090 recommended)
  - Ubuntu 20.04/22.04
  - Jupyter or SSH template
- [ ] Launch instance
- [ ] Wait for instance to start
- [ ] Note down SSH/Jupyter URL

### ☐ Upload Files to Vast.ai

**Via Jupyter:**
- [ ] Open Jupyter in browser
- [ ] Navigate to `/workspace/`
- [ ] Create folder: `f5tts_project`
- [ ] Upload all files:
  - [ ] `credentials.json`
  - [ ] `token.pickle`
  - [ ] `vast_ai_automation.py`
  - [ ] `google_drive_manager.py`
  - [ ] `audio_processor.py`
  - [ ] `run_complete_pipeline.py`
  - [ ] `setup_environment.sh`
  - [ ] `requirements.txt`

**Via SSH:**
```bash
scp credentials.json token.pickle *.py *.sh *.txt \
  root@ssh_url:/workspace/f5tts_project/
```

### ☐ Run Setup Script

```bash
cd /workspace/f5tts_project
chmod +x setup_environment.sh
./setup_environment.sh
```

**Verify:**
- [ ] No errors during installation
- [ ] All directories created
- [ ] F5-TTS cloned successfully
- [ ] Python packages installed
- [ ] Credentials verified

### ☐ Configure Settings

- [ ] Copy `config.example.json` to `config.json`
- [ ] Edit `config.json`:
  - [ ] Set `scripts_folder_id`
  - [ ] Set `reference_audio_folder_id`
  - [ ] Set `output_folder_id`
  - [ ] Set `whisper_model` (recommend: base)
  - [ ] Set `reference_audio_file` name
  - [ ] List scripts to process
- [ ] Save config.json

### ☐ Test Drive Connection

```bash
# List files in scripts folder
python google_drive_manager.py list --folder-id YOUR_SCRIPTS_FOLDER_ID

# Download test
python google_drive_manager.py download \
  --folder-id YOUR_SCRIPTS_FOLDER_ID \
  --local-path input/scripts/
```

**Verify:**
- [ ] Files listed successfully
- [ ] Downloaded without errors
- [ ] Files appear in `input/scripts/`

### ☐ Test Audio Processing

```bash
# Process single script
python audio_processor.py \
  --reference-audio input/reference_audio/reference.wav \
  --script input/scripts/test.txt \
  --output-folder-id YOUR_OUTPUT_FOLDER_ID \
  --whisper-model base
```

**Verify:**
- [ ] Whisper model loaded
- [ ] Reference audio transcribed
- [ ] F5-TTS model loaded
- [ ] Audio chunks generated
- [ ] Chunks uploaded to Drive
- [ ] Final audio merged
- [ ] Final audio uploaded

### ☐ Test Complete Pipeline

```bash
python run_complete_pipeline.py --config config.json
```

**Verify:**
- [ ] Downloads from Drive
- [ ] Processes all scripts
- [ ] Generates all audio
- [ ] Uploads all audio
- [ ] No errors in logs

---

## Production Checklist

### ☐ React App Production

- [ ] Build for production: `npm run build`
- [ ] Deploy to hosting (Vercel/Netlify/etc.)
- [ ] Test production URL
- [ ] Verify all API calls work
- [ ] Check Drive upload works

### ☐ Vast.ai Production

- [ ] Test with full-length scripts
- [ ] Monitor GPU usage
- [ ] Check output quality
- [ ] Verify upload success
- [ ] Test error recovery

### ☐ Documentation

- [ ] Update README with specific instructions
- [ ] Document folder IDs used
- [ ] Note any custom configurations
- [ ] Create user guide if needed

### ☐ Monitoring

- [ ] Set up cost alerts on Vast.ai
- [ ] Monitor Drive storage usage
- [ ] Track API usage/costs
- [ ] Check for errors regularly

---

## Troubleshooting Checklist

### ☐ React App Issues

**Drive upload fails:**
- [ ] Check access token validity
- [ ] Re-authenticate in OAuth Playground
- [ ] Verify folder ID is correct
- [ ] Check folder permissions

**AI processing fails:**
- [ ] Verify API keys are correct
- [ ] Check API quota/credits
- [ ] Try different model
- [ ] Check network connection

### ☐ Vast.ai Issues

**Setup fails:**
- [ ] Check CUDA version
- [ ] Verify disk space
- [ ] Check internet connection
- [ ] Try manual installation

**Drive connection fails:**
- [ ] Verify credentials.json exists
- [ ] Verify token.pickle exists
- [ ] Check file permissions
- [ ] Re-generate token.pickle

**Audio generation fails:**
- [ ] Check GPU memory
- [ ] Use smaller Whisper model
- [ ] Reduce chunk size
- [ ] Check reference audio format

**Upload fails:**
- [ ] Check Drive folder ID
- [ ] Verify folder permissions
- [ ] Check internet connection
- [ ] Check Drive storage quota

---

## Performance Optimization

### ☐ Speed Improvements

- [ ] Use `base` Whisper model for faster processing
- [ ] Rent faster GPU (RTX 4090 if available)
- [ ] Process multiple scripts in parallel
- [ ] Use SSD storage on Vast.ai

### ☐ Cost Optimization

- [ ] Use spot instances (cheaper)
- [ ] Stop instance when not in use
- [ ] Process in batches
- [ ] Use smaller Whisper models
- [ ] Monitor and set budget limits

### ☐ Quality Improvements

- [ ] Use `small` or `medium` Whisper model
- [ ] Better quality reference audio
- [ ] Longer reference audio (30 seconds)
- [ ] Clean background noise
- [ ] Test different F5-TTS settings

---

## Maintenance Checklist

### ☐ Weekly

- [ ] Check Drive storage usage
- [ ] Review API costs
- [ ] Clean up old files
- [ ] Update access tokens if needed

### ☐ Monthly

- [ ] Update dependencies
- [ ] Check for F5-TTS updates
- [ ] Review and optimize costs
- [ ] Backup important files

### ☐ As Needed

- [ ] Regenerate OAuth tokens
- [ ] Update API keys
- [ ] Scale Vast.ai instance
- [ ] Optimize configurations

---

## Success Criteria

### ☐ React App Working

- [✓] Can fetch YouTube transcripts
- [✓] AI processing works for all models
- [✓] Final output downloads locally
- [✓] Final output uploads to Drive
- [✓] Settings persist across sessions

### ☐ Vast.ai Working

- [✓] Environment setup completes
- [✓] Can download from Drive
- [✓] Whisper transcription works
- [✓] F5-TTS generates audio
- [✓] Audio uploads to Drive
- [✓] Complete pipeline runs end-to-end

### ☐ End-to-End Working

- [✓] Video URL → Transcript → Rewrite
- [✓] Rewrite → Drive → Download
- [✓] Download → Audio Generation
- [✓] Audio → Drive → Download
- [✓] Complete cycle under 1 hour

---

## Final Verification

- [ ] Run complete test with real video
- [ ] Generate audio from test script
- [ ] Verify audio quality
- [ ] Check all files in Drive
- [ ] Confirm costs are acceptable
- [ ] Document any issues found
- [ ] Create backup of working config

---

## 🎉 Deployment Complete!

Once all checkboxes are marked, your system is ready for production use!

**Remember:**
- Keep credentials secure
- Monitor costs regularly
- Backup important files
- Document any custom changes

Good luck! 🚀
