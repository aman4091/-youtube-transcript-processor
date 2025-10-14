#!/bin/bash
# Setup Environment Script for Vast.ai
# This script sets up everything needed for F5-TTS audio generation

set -e  # Exit on error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   F5-TTS Vast.ai Environment Setup Script${NC}"
echo -e "${BLUE}================================================${NC}\n"

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if running with sudo
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root"
fi

# Update system
print_info "Updating system packages..."
apt-get update -qq
apt-get install -y -qq ffmpeg git python3-pip wget curl > /dev/null 2>&1
print_status "System packages updated"

# Create project directory
PROJECT_DIR="/workspace/f5tts_project"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"
print_status "Project directory created: $PROJECT_DIR"

# Create directory structure
print_info "Creating directory structure..."
mkdir -p input/scripts
mkdir -p input/reference_audio
mkdir -p output/generated_audio
mkdir -p temp
print_status "Directories created"

# Install Python packages
print_info "Installing Python dependencies..."
pip install -q torch torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install -q openai-whisper pydrive2 numpy scipy soundfile tqdm librosa
print_status "Python dependencies installed"

# Clone and install F5-TTS
print_info "Installing F5-TTS..."
if [ -d "F5-TTS" ]; then
    print_warning "F5-TTS directory already exists, updating..."
    cd F5-TTS
    git pull -q
    cd ..
else
    git clone -q https://github.com/SWivid/F5-TTS.git
fi

cd F5-TTS
if [ -f "requirements.txt" ]; then
    pip install -q -r requirements.txt
fi
pip install -q -e .
cd ..
print_status "F5-TTS installed"

# Check for credentials
print_info "Checking for Google Drive credentials..."
if [ ! -f "credentials.json" ]; then
    print_warning "credentials.json not found!"
    print_warning "Please upload credentials.json to $PROJECT_DIR"
else
    print_status "credentials.json found"
fi

if [ ! -f "token.pickle" ]; then
    print_warning "token.pickle not found!"
    print_warning "Please upload token.pickle to $PROJECT_DIR"
else
    print_status "token.pickle found"
fi

# Create example config file
cat > config.json <<EOF
{
  "input_folder_id": "YOUR_INPUT_FOLDER_ID",
  "output_folder_id": "YOUR_OUTPUT_FOLDER_ID",
  "reference_audio_folder_id": "YOUR_REFERENCE_AUDIO_FOLDER_ID",
  "whisper_model": "base",
  "chunk_size": 500
}
EOF
print_status "Example config.json created"

echo -e "\n${GREEN}================================================${NC}"
echo -e "${GREEN}   Setup completed successfully!${NC}"
echo -e "${GREEN}================================================${NC}\n"

echo -e "${BLUE}Next steps:${NC}"
echo "1. Upload credentials.json and token.pickle to: $PROJECT_DIR"
echo "2. Edit config.json with your Google Drive folder IDs"
echo "3. Run: python google_drive_manager.py download --folder-id YOUR_ID --local-path input/"
echo "4. Run: python audio_processor.py --reference-audio input/reference_audio/your_audio.wav --script input/scripts/your_script.txt"

echo -e "\n${YELLOW}Tip:${NC} You can run 'python vast_ai_automation.py' to automate the entire process"
