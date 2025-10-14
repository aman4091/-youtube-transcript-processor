# Project Summary - YouTube Transcript Processor + F5-TTS Integration

## Overview

Is project mein 2 major components hain:

1. **React Web App** - YouTube transcripts ko process karta hai aur AI se rewrite karta hai
2. **Vast.ai Automation** - Rewrites ko audio mein convert karta hai using F5-TTS

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     YouTube Video URL                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               React App (Local/Browser)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 1. Fetch transcript via SupaData API                   │ │
│  │ 2. Chunk into 7000 chars                               │ │
│  │ 3. Process through 4 AI models                         │ │
│  │    - DeepSeek                                          │ │
│  │    - Gemini 2.5 Flash                                  │ │
│  │    - Gemini 2.5 Pro                                    │ │
│  │    - OpenRouter                                        │ │
│  │ 4. Select final rewrite                                │ │
│  │ 5. Save locally + Upload to Google Drive              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
                  Google Drive Storage
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Vast.ai GPU Instance                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 1. Download rewrites from Google Drive                 │ │
│  │ 2. Download reference audio from Google Drive          │ │
│  │ 3. Transcribe reference using Whisper AI              │ │
│  │ 4. Chunk text into 500 chars                           │ │
│  │ 5. Generate audio using F5-TTS                         │ │
│  │ 6. Upload audio chunks back to Google Drive            │ │
│  │ 7. Merge all chunks into final audio                   │ │
│  │ 8. Upload final audio to Google Drive                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
              Final Audio in Google Drive
```

## File Structure

```
E:\appp\
│
├── React App Files (Frontend)
│   ├── src/
│   │   ├── App.tsx                      # Main app component
│   │   ├── components/                  # UI components
│   │   ├── services/
│   │   │   ├── supaDataAPI.ts          # YouTube transcript fetching
│   │   │   ├── aiProcessors.ts         # AI model processing
│   │   │   └── googleDriveAPI.ts       # ✨ NEW: Drive upload
│   │   ├── stores/
│   │   │   ├── settingsStore.ts        # ✨ UPDATED: Drive settings
│   │   │   └── historyStore.ts
│   │   └── utils/
│   │       └── chunkingService.ts      # Text chunking
│   ├── package.json
│   └── README.md
│
├── Vast.ai Automation Files (Backend)
│   ├── vast_ai_automation.py           # ✨ Main setup automation
│   ├── google_drive_manager.py         # ✨ Drive operations
│   ├── audio_processor.py              # ✨ Whisper + F5-TTS pipeline
│   ├── run_complete_pipeline.py        # ✨ One-command execution
│   ├── setup_environment.sh            # ✨ Shell setup script
│   ├── requirements.txt                # ✨ Python dependencies
│   └── config.example.json             # ✨ Configuration template
│
└── Documentation
    ├── VAST_AI_SETUP_README.md         # ✨ Detailed Vast.ai guide
    ├── QUICK_START.md                  # ✨ Quick start guide
    └── PROJECT_SUMMARY.md              # ✨ This file
```

## Components Breakdown

### Part 1: React Web App

**Purpose:** YouTube video transcript ko fetch karke AI se rewrite karna

**Key Features:**
- YouTube URL se transcript fetch
- 4 AI models se parallel processing
- Final output ko local download + Google Drive upload
- Settings mein Drive integration

**Updated Files:**
1. `src/services/googleDriveAPI.ts` - NEW
   - Google Drive upload functionality
   - OAuth authentication
   - Multipart file upload

2. `src/stores/settingsStore.ts` - UPDATED
   - Added Google Drive settings
   - Access token storage
   - Folder ID configuration

3. `src/App.tsx` - UPDATED
   - Drive upload after "Mark as Final"
   - Error handling for upload failures

### Part 2: Vast.ai Automation Scripts

**Purpose:** Text scripts ko audio mein convert karna using F5-TTS

**Key Scripts:**

#### 1. `vast_ai_automation.py`
**What it does:**
- System dependencies install (ffmpeg, git)
- Python packages install
- F5-TTS clone & setup
- Directory structure creation
- Credentials verification

**Usage:**
```bash
python vast_ai_automation.py
```

#### 2. `google_drive_manager.py`
**What it does:**
- Google Drive authentication
- Download files/folders from Drive
- Upload files/folders to Drive
- List files in folders

**Usage:**
```bash
# Download
python google_drive_manager.py download --folder-id ID --local-path path/

# Upload
python google_drive_manager.py upload --folder-id ID --local-path path/

# List
python google_drive_manager.py list --folder-id ID
```

#### 3. `audio_processor.py`
**What it does:**
- Load Whisper AI model
- Transcribe reference audio
- Load F5-TTS model
- Chunk text into 500 chars
- Generate audio for each chunk
- Upload chunks progressively
- Merge all chunks
- Upload final audio

**Usage:**
```bash
python audio_processor.py \
  --reference-audio path/to/reference.wav \
  --script path/to/script.txt \
  --output-folder-id DRIVE_FOLDER_ID \
  --whisper-model base
```

#### 4. `run_complete_pipeline.py`
**What it does:**
- One-command complete automation
- Reads config.json
- Downloads inputs from Drive
- Processes all scripts
- Uploads all outputs to Drive

**Usage:**
```bash
python run_complete_pipeline.py --config config.json
```

#### 5. `setup_environment.sh`
**What it does:**
- Bash script for initial setup
- System packages installation
- Python environment setup
- Directory creation
- F5-TTS installation

**Usage:**
```bash
chmod +x setup_environment.sh
./setup_environment.sh
```

## Workflow Examples

### Workflow 1: Basic Usage

1. **Get Transcript (React App):**
   ```
   User: Pastes YouTube URL
   App: Fetches transcript → Processes through AI → User selects best
   Result: Text saved locally + uploaded to Drive
   ```

2. **Generate Audio (Vast.ai):**
   ```bash
   # Setup
   ./setup_environment.sh

   # Download from Drive
   python google_drive_manager.py download \
     --folder-id SCRIPTS_ID --local-path input/scripts/

   python google_drive_manager.py download \
     --folder-id AUDIO_ID --local-path input/reference_audio/

   # Process
   python audio_processor.py \
     --reference-audio input/reference_audio/my_voice.wav \
     --script input/scripts/rewrite.txt \
     --output-folder-id OUTPUT_ID
   ```

### Workflow 2: Automated Pipeline

```bash
# One-time setup
./setup_environment.sh

# Edit config.json with your Drive folder IDs
nano config.json

# Run complete pipeline (downloads → transcribes → generates → uploads)
python run_complete_pipeline.py --config config.json
```

### Workflow 3: Batch Processing

```bash
# Process multiple scripts at once
python run_complete_pipeline.py --config config.json
# config.json mein multiple scripts define karo:
# "scripts": ["script1.txt", "script2.txt", "script3.txt"]
```

## Google Drive Folder Structure

```
My Drive/
└── F5TTS_Project/
    ├── rewrites/                    # From React app
    │   └── Gemini_output_*.txt
    │
    ├── input/
    │   ├── scripts/                 # Text scripts
    │   │   ├── script1.txt
    │   │   └── script2.txt
    │   └── reference_audio/         # Voice samples
    │       └── my_voice.wav
    │
    └── output/
        └── generated_audio/         # Generated audio
            ├── script1_chunk_001.wav
            ├── script1_chunk_002.wav
            └── script1_complete.wav
```

## Dependencies

### React App
```json
{
  "react": "^18.3.1",
  "axios": "^1.7.9",
  "zustand": "^5.0.2",
  "lucide-react": "^0.462.0"
}
```

### Vast.ai Scripts
```
torch>=2.0.0
openai-whisper>=20231117
pydrive2>=1.15.0
soundfile>=0.12.0
librosa>=0.10.0
```

## Configuration

### React App Settings
```typescript
{
  googleDriveAccessToken: string,    // OAuth token
  googleDriveFolderId: string,       // Target folder ID
  enableDriveUpload: boolean         // Enable/disable upload
}
```

### Vast.ai Config (`config.json`)
```json
{
  "scripts_folder_id": "...",
  "reference_audio_folder_id": "...",
  "output_folder_id": "...",
  "whisper_model": "base",
  "chunk_size": 500,
  "auto_download": true,
  "auto_upload": true
}
```

## Key Features

### ✅ Completed Features

1. **Google Drive Integration**
   - Browser-based upload from React app
   - Python-based download/upload for Vast.ai
   - Token-based authentication

2. **Automated Setup**
   - One-command installation
   - Dependency resolution
   - Directory creation

3. **Audio Processing Pipeline**
   - Whisper AI transcription
   - F5-TTS generation
   - 500-char chunking
   - Progressive upload

4. **Error Handling**
   - Graceful failures
   - Retry logic
   - Status reporting

5. **Batch Processing**
   - Multiple scripts support
   - Parallel processing
   - Progress tracking

## Performance

**React App:**
- Transcript fetch: 5-30 seconds (depends on video length)
- AI processing: 10-60 seconds per chunk (4 models parallel)
- Drive upload: 1-5 seconds

**Vast.ai:**
- Whisper transcription: 5-30 seconds (depends on model size)
- F5-TTS generation: 30-60 seconds per 500 chars
- Drive upload: Concurrent with generation

**Estimated Total Time:**
- 10,000 char script: ~30-45 minutes on RTX 3090

## Cost Estimates

**Vast.ai GPU Rental:**
- RTX 3090: $0.20-0.40/hour
- For 30 min processing: $0.10-0.20

**API Costs:**
- YouTube transcript: Free (via SupaData)
- AI models: Variable (depends on provider)
- Google Drive: Free (15GB storage)

## Security Notes

1. **API Keys:** Store in environment variables or secure settings
2. **OAuth Tokens:** Expire regularly, need refresh
3. **Credentials Files:** Never commit to Git
4. **Drive Access:** Use specific folder IDs, not root access

## Future Enhancements

Potential improvements:
- [ ] Voice cloning improvements
- [ ] Multi-language support
- [ ] Real-time progress tracking
- [ ] Web UI for Vast.ai scripts
- [ ] Automatic token refresh
- [ ] Cost optimization
- [ ] Audio quality enhancement
- [ ] Batch processing UI

## Support

**Documentation:**
- `README.md` - React app documentation
- `VAST_AI_SETUP_README.md` - Detailed Vast.ai setup
- `QUICK_START.md` - Quick start guide

**Resources:**
- F5-TTS: https://github.com/SWivid/F5-TTS
- Whisper AI: https://github.com/openai/whisper
- PyDrive2: https://docs.iterative.ai/PyDrive2/

## Conclusion

Is project ne successfully integrate kiya hai:
1. YouTube transcript processing
2. AI-powered rewriting
3. Google Drive cloud storage
4. F5-TTS audio generation
5. Automated deployment on Vast.ai

Complete end-to-end solution hai: Video → Transcript → Rewrite → Audio → Cloud Storage

Sab kuch automated hai with minimal manual intervention!
