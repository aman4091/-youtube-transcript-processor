#!/usr/bin/env python3
"""
Vast.ai Automation Script for F5-TTS Audio Generation
This script automates the entire pipeline:
1. Setup environment and dependencies
2. Install F5-TTS
3. Download scripts and reference audio from Google Drive
4. Transcribe reference audio using Whisper AI
5. Generate audio using F5-TTS (500 chars at a time)
6. Upload generated audio back to Google Drive

Usage:
    python vast_ai_automation.py
"""

import os
import sys
import subprocess
import time
from pathlib import Path

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_status(message, status='info'):
    """Print colored status messages"""
    if status == 'info':
        print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} {message}")
    elif status == 'success':
        print(f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} {message}")
    elif status == 'warning':
        print(f"{Colors.WARNING}[WARNING]{Colors.ENDC} {message}")
    elif status == 'error':
        print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} {message}")
    elif status == 'header':
        print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{message}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")

def run_command(command, description, check=True, shell=True):
    """Run a shell command with error handling"""
    print_status(f"{description}...", 'info')
    try:
        result = subprocess.run(
            command,
            shell=shell,
            check=check,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.stdout:
            print(result.stdout)
        print_status(f"{description} completed", 'success')
        return True
    except subprocess.CalledProcessError as e:
        print_status(f"{description} failed: {e.stderr}", 'error')
        if check:
            sys.exit(1)
        return False

def setup_directories():
    """Create necessary directory structure"""
    print_status("Setting up directory structure", 'header')

    base_dir = Path('/workspace/f5tts_project')
    dirs = [
        base_dir,
        base_dir / 'input' / 'scripts',
        base_dir / 'input' / 'reference_audio',
        base_dir / 'output' / 'generated_audio',
        base_dir / 'temp',
    ]

    for dir_path in dirs:
        dir_path.mkdir(parents=True, exist_ok=True)
        print_status(f"Created directory: {dir_path}", 'success')

    return base_dir

def install_system_dependencies():
    """Install system-level dependencies"""
    print_status("Installing system dependencies", 'header')

    commands = [
        ("apt-get update", "Updating apt repositories"),
        ("apt-get install -y ffmpeg git python3-pip", "Installing ffmpeg, git, and pip"),
    ]

    for cmd, desc in commands:
        run_command(cmd, desc)

def install_python_dependencies():
    """Install Python packages"""
    print_status("Installing Python dependencies", 'header')

    packages = [
        "torch torchaudio --index-url https://download.pytorch.org/whl/cu118",
        "openai-whisper",
        "pydrive2",
        "numpy",
        "scipy",
        "soundfile",
        "tqdm",
        "librosa",
    ]

    for package in packages:
        run_command(
            f"pip install {package}",
            f"Installing {package.split()[0]}",
            check=False  # Don't exit if one fails
        )

def install_f5tts(base_dir):
    """Clone and install F5-TTS"""
    print_status("Installing F5-TTS", 'header')

    f5tts_dir = base_dir / 'F5-TTS'

    if f5tts_dir.exists():
        print_status("F5-TTS already exists, updating...", 'warning')
        run_command(
            f"cd {f5tts_dir} && git pull",
            "Updating F5-TTS"
        )
    else:
        run_command(
            f"git clone https://github.com/SWivid/F5-TTS.git {f5tts_dir}",
            "Cloning F5-TTS repository"
        )

    # Install F5-TTS requirements
    requirements_file = f5tts_dir / 'requirements.txt'
    if requirements_file.exists():
        run_command(
            f"pip install -r {requirements_file}",
            "Installing F5-TTS requirements",
            check=False
        )

    # Install F5-TTS as package
    run_command(
        f"cd {f5tts_dir} && pip install -e .",
        "Installing F5-TTS package",
        check=False
    )

    return f5tts_dir

def setup_google_drive(base_dir):
    """Setup Google Drive authentication"""
    print_status("Setting up Google Drive", 'header')

    # Check if credentials files exist
    creds_file = base_dir / 'credentials.json'
    token_file = base_dir / 'token.pickle'

    if not creds_file.exists():
        print_status("credentials.json not found!", 'error')
        print_status("Please upload credentials.json to /workspace/f5tts_project/", 'warning')
        sys.exit(1)

    if not token_file.exists():
        print_status("token.pickle not found!", 'error')
        print_status("Please upload token.pickle to /workspace/f5tts_project/", 'warning')
        sys.exit(1)

    print_status("Google Drive credentials found", 'success')
    return True

def main():
    """Main execution flow"""
    print_status("F5-TTS Automation Script Started", 'header')
    print_status(f"Starting at: {time.strftime('%Y-%m-%d %H:%M:%S')}", 'info')

    try:
        # Step 1: Setup directories
        base_dir = setup_directories()

        # Step 2: Install system dependencies
        install_system_dependencies()

        # Step 3: Install Python dependencies
        install_python_dependencies()

        # Step 4: Install F5-TTS
        f5tts_dir = install_f5tts(base_dir)

        # Step 5: Setup Google Drive
        setup_google_drive(base_dir)

        print_status("Setup completed successfully!", 'header')
        print_status("Next steps:", 'info')
        print_status("1. Ensure credentials.json and token.pickle are in /workspace/f5tts_project/", 'info')
        print_status("2. Run: python google_drive_manager.py download", 'info')
        print_status("3. Run: python audio_processor.py", 'info')

    except KeyboardInterrupt:
        print_status("\nScript interrupted by user", 'warning')
        sys.exit(1)
    except Exception as e:
        print_status(f"Unexpected error: {str(e)}", 'error')
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
