# F5-TTS Vast.ai Automation Setup Guide

Complete automation for running F5-TTS audio generation on Vast.ai with Google Drive integration.

## Features

- **Automated Setup**: One-command installation of all dependencies
- **Google Drive Integration**: Auto-download inputs and auto-upload outputs
- **Whisper AI Transcription**: Automatic reference audio transcription
- **F5-TTS Audio Generation**: Generate high-quality audio from text
- **Smart Chunking**: Process text in 500-character chunks
- **Progressive Upload**: Upload audio chunks as they're generated
- **Complete Pipeline**: From script to final audio, fully automated

---

## Prerequisites

### 1. Google Drive Setup

Before running on Vast.ai, you need to prepare your Google Drive credentials:

#### Get Google Drive API Credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Download the credentials as `credentials.json`

#### Generate token.pickle:

Run this script locally (with Python + pydrive2 installed):

```python
from pydrive2.auth import GoogleAuth

gauth = GoogleAuth()
gauth.LocalWebserverAuth()  # Opens browser for authentication

# Save credentials
import pickle
with open('token.pickle', 'wb') as token:
    pickle.dump(gauth.credentials, token)

print("token.pickle created successfully!")
```

### 2. Organize Your Google Drive

Create the following folder structure in your Google Drive:

```
F5TTS_Project/
├── input/
│   ├── scripts/          (Upload your text scripts here)
│   └── reference_audio/  (Upload reference audio files here)
└── output/
    └── generated_audio/  (Generated audio will be uploaded here)
```

**Get Folder IDs:**
- Open each folder in Google Drive
- Copy the folder ID from the URL:
  - URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
  - Copy: `FOLDER_ID_HERE`

---

## Setup on Vast.ai

### Step 1: Rent a GPU Instance

1. Go to [Vast.ai](https://vast.ai/)
2. Search for an instance with:
   - **CUDA 11.8+**
   - **At least 16GB VRAM** (RTX 3090 or better recommended)
   - **Ubuntu 20.04 or 22.04**
3. Select **Jupyter** or **SSH** template
4. Launch the instance

### Step 2: Upload Files

Upload these files to `/workspace/f5tts_project/`:

```bash
# Files to upload:
1. credentials.json
2. token.pickle
3. vast_ai_automation.py
4. google_drive_manager.py
5. audio_processor.py
6. setup_environment.sh
7. requirements.txt
```

**Quick Upload via Jupyter:**
- Open Jupyter terminal
- Use the file upload button to upload all files to `/workspace/f5tts_project/`

### Step 3: Run Automated Setup

```bash
cd /workspace/f5tts_project
chmod +x setup_environment.sh
./setup_environment.sh
```

This will:
- Install system dependencies (ffmpeg, git)
- Install Python packages (PyTorch, Whisper, etc.)
- Clone and install F5-TTS
- Create directory structure
- Verify credentials

**Alternatively, run the Python automation script:**

```bash
python vast_ai_automation.py
```

---

## Usage

### Method 1: Automated Pipeline (Recommended)

1. **Download inputs from Google Drive:**

```bash
python google_drive_manager.py download \
  --folder-id YOUR_INPUT_FOLDER_ID \
  --local-path /workspace/f5tts_project/input/
```

2. **Process and generate audio:**

```bash
python audio_processor.py \
  --reference-audio /workspace/f5tts_project/input/reference_audio/your_audio.wav \
  --script /workspace/f5tts_project/input/scripts/your_script.txt \
  --output-folder-id YOUR_OUTPUT_FOLDER_ID
```

This will:
- Transcribe reference audio using Whisper
- Split script into 500-char chunks
- Generate audio for each chunk
- Upload chunks progressively to Drive
- Merge all chunks into final audio
- Upload final merged audio

### Method 2: Manual Steps

#### Step 1: Transcribe Reference Audio

```bash
python -c "
from audio_processor import AudioProcessor
from pathlib import Path

processor = AudioProcessor()
processor.load_whisper_model('base')
text = processor.transcribe_audio(Path('input/reference_audio/reference.wav'))
print(text)
"
```

#### Step 2: Generate Audio Chunks

```python
from audio_processor import AudioProcessor
from pathlib import Path

processor = AudioProcessor()
processor.load_f5tts_model()

chunks = processor.chunk_text(your_script_text, max_chars=500)

for i, chunk in enumerate(chunks):
    output = f"output/generated_audio/chunk_{i}.wav"
    processor.generate_audio_chunk(
        text=chunk,
        reference_audio=Path('input/reference_audio/reference.wav'),
        reference_text=reference_text,
        output_path=Path(output)
    )
```

#### Step 3: Upload to Drive

```bash
python google_drive_manager.py upload \
  --folder-id YOUR_OUTPUT_FOLDER_ID \
  --local-path /workspace/f5tts_project/output/generated_audio/
```

---

## Configuration

### Whisper Model Sizes

Choose based on your GPU memory and accuracy needs:

| Model  | VRAM | Speed  | Accuracy |
|--------|------|--------|----------|
| tiny   | 1GB  | Fastest| Low      |
| base   | 1GB  | Fast   | Good     |
| small  | 2GB  | Medium | Better   |
| medium | 5GB  | Slow   | High     |
| large  | 10GB | Slowest| Best     |

**Recommendation for Vast.ai:** Use `base` or `small`

### Chunk Size

Default: 500 characters

Adjust in `audio_processor.py` if needed:
```python
chunks = processor.chunk_text(text, max_chars=500)
```

---

## Troubleshooting

### Issue: "credentials.json not found"

**Solution:**
```bash
# Make sure files are in correct location
ls -la /workspace/f5tts_project/
# Should show credentials.json and token.pickle
```

### Issue: "Failed to load F5-TTS model"

**Solution:**
```bash
cd /workspace/f5tts_project/F5-TTS
pip install -e .
```

### Issue: "CUDA out of memory"

**Solution:**
- Use smaller Whisper model (`tiny` or `base`)
- Process fewer chunks at once
- Rent GPU with more VRAM

### Issue: "Google Drive authentication failed"

**Solution:**
```bash
# Regenerate token.pickle locally and re-upload
# Make sure credentials.json is valid
```

### Issue: "Audio quality is poor"

**Solution:**
- Use better reference audio (clear, no background noise)
- Try larger Whisper model for better transcription
- Ensure reference audio matches target voice

---

## Project Structure

```
/workspace/f5tts_project/
├── credentials.json          # Google OAuth credentials
├── token.pickle             # Google Drive auth token
├── config.json              # Configuration file
│
├── input/
│   ├── scripts/            # Text scripts to convert
│   └── reference_audio/    # Reference audio files
│
├── output/
│   └── generated_audio/    # Generated audio output
│
├── temp/                   # Temporary chunk files
│
├── F5-TTS/                 # F5-TTS repository
│
├── vast_ai_automation.py   # Main automation script
├── google_drive_manager.py # Drive operations
├── audio_processor.py      # Audio generation pipeline
├── setup_environment.sh    # Setup script
└── requirements.txt        # Python dependencies
```

---

## Google Drive Manager CLI Reference

### Download Files

```bash
# Download entire folder
python google_drive_manager.py download \
  --folder-id FOLDER_ID \
  --local-path /path/to/destination

# List files in folder
python google_drive_manager.py list \
  --folder-id FOLDER_ID
```

### Upload Files

```bash
# Upload single file
python google_drive_manager.py upload \
  --local-path /path/to/file.txt \
  --folder-id FOLDER_ID

# Upload entire folder
python google_drive_manager.py upload \
  --local-path /path/to/folder \
  --folder-id FOLDER_ID
```

---

## Audio Processor CLI Reference

```bash
python audio_processor.py \
  --reference-audio PATH_TO_REFERENCE \    # Required
  --script PATH_TO_SCRIPT \                # Required
  --output-folder-id DRIVE_FOLDER_ID \     # Optional
  --whisper-model base \                   # Optional (tiny/base/small/medium/large)
  --no-upload \                            # Optional (disable Drive upload)
  --base-dir /workspace/f5tts_project      # Optional
```

---

## Performance Tips

1. **Use SSD Storage**: Faster I/O for audio processing
2. **GPU Selection**: RTX 3090 or A5000 recommended
3. **Parallel Processing**: Process multiple scripts simultaneously
4. **Batch Upload**: Upload chunks in batches to reduce API calls
5. **Local Cache**: Keep generated audio locally before final merge

---

## Cost Optimization

**Estimated Costs (Vast.ai):**
- RTX 3090: ~$0.20-0.40/hour
- Processing time: ~1-2 minutes per 500 chars
- For 10,000 chars: ~20-40 minutes = $0.10-0.30

**Tips:**
- Stop instance when not in use
- Use cheaper GPUs for testing
- Batch process multiple scripts

---

## Support & Resources

- **F5-TTS GitHub**: https://github.com/SWivid/F5-TTS
- **Whisper AI**: https://github.com/openai/whisper
- **Vast.ai Docs**: https://vast.ai/docs
- **Google Drive API**: https://developers.google.com/drive

---

## License

This automation setup is MIT licensed. F5-TTS follows its own license.
