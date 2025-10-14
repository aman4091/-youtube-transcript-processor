#!/usr/bin/env python3
"""
Complete F5-TTS Pipeline Runner
One-command execution: Download → Transcribe → Generate → Upload

Usage:
    python run_complete_pipeline.py --config config.json
"""

import os
import sys
import json
import argparse
from pathlib import Path
from google_drive_manager import DriveManager
from audio_processor import AudioProcessor


class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_header(message):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message.center(70)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}\n")


def print_status(message, status='info'):
    prefix = {
        'info': f"{Colors.OKBLUE}[INFO]{Colors.ENDC}",
        'success': f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC}",
        'warning': f"{Colors.WARNING}[WARNING]{Colors.ENDC}",
        'error': f"{Colors.FAIL}[ERROR]{Colors.ENDC}",
    }
    print(f"{prefix.get(status, '')} {message}")


def load_config(config_path: Path) -> dict:
    """Load configuration from JSON file"""
    if not config_path.exists():
        print_status(f"Config file not found: {config_path}", 'error')
        print_status("Creating example config.json...", 'info')

        example_config = {
            "input_folder_id": "YOUR_INPUT_FOLDER_ID",
            "scripts_folder_id": "YOUR_SCRIPTS_FOLDER_ID",
            "reference_audio_folder_id": "YOUR_REFERENCE_AUDIO_FOLDER_ID",
            "output_folder_id": "YOUR_OUTPUT_FOLDER_ID",
            "whisper_model": "base",
            "chunk_size": 500,
            "auto_download": True,
            "auto_upload": True,
            "reference_audio_file": "reference.wav",
            "scripts": ["script1.txt", "script2.txt"]
        }

        with open(config_path, 'w') as f:
            json.dump(example_config, f, indent=2)

        print_status("Example config.json created. Please edit it with your folder IDs.", 'success')
        sys.exit(0)

    with open(config_path) as f:
        return json.load(f)


def run_pipeline(config: dict, base_dir: Path):
    """Run the complete pipeline"""

    print_header("F5-TTS Complete Pipeline")

    # Initialize managers
    print_status("Initializing Drive Manager...", 'info')
    drive_manager = DriveManager(base_dir)

    print_status("Initializing Audio Processor...", 'info')
    processor = AudioProcessor(base_dir)

    # Step 1: Download inputs from Drive
    if config.get('auto_download', True):
        print_header("Step 1: Downloading from Google Drive")

        # Download scripts
        if 'scripts_folder_id' in config:
            print_status("Downloading scripts...", 'info')
            scripts_count = drive_manager.download_folder(
                config['scripts_folder_id'],
                processor.scripts_dir
            )
            print_status(f"Downloaded {scripts_count} script files", 'success')

        # Download reference audio
        if 'reference_audio_folder_id' in config:
            print_status("Downloading reference audio...", 'info')
            audio_count = drive_manager.download_folder(
                config['reference_audio_folder_id'],
                processor.reference_audio_dir
            )
            print_status(f"Downloaded {audio_count} audio files", 'success')
    else:
        print_status("Skipping download (auto_download = false)", 'warning')

    # Step 2: Find reference audio
    print_header("Step 2: Transcribing Reference Audio")

    reference_audio_file = config.get('reference_audio_file', 'reference.wav')
    reference_audio_path = processor.reference_audio_dir / reference_audio_file

    if not reference_audio_path.exists():
        # Try to find any audio file
        audio_files = list(processor.reference_audio_dir.glob('*.wav'))
        audio_files.extend(list(processor.reference_audio_dir.glob('*.mp3')))

        if not audio_files:
            print_status("No reference audio found!", 'error')
            sys.exit(1)

        reference_audio_path = audio_files[0]
        print_status(f"Using reference audio: {reference_audio_path.name}", 'info')

    # Load Whisper and transcribe
    processor.load_whisper_model(config.get('whisper_model', 'base'))
    reference_text = processor.transcribe_audio(reference_audio_path)

    # Step 3: Process scripts
    print_header("Step 3: Generating Audio")

    # Find script files
    script_files = []
    if 'scripts' in config and config['scripts']:
        for script_name in config['scripts']:
            script_path = processor.scripts_dir / script_name
            if script_path.exists():
                script_files.append(script_path)
            else:
                print_status(f"Script not found: {script_name}", 'warning')
    else:
        # Process all .txt files in scripts directory
        script_files = list(processor.scripts_dir.glob('*.txt'))

    if not script_files:
        print_status("No script files found!", 'error')
        sys.exit(1)

    print_status(f"Found {len(script_files)} scripts to process", 'info')

    # Set Drive manager for auto-upload
    if config.get('auto_upload', True):
        processor.drive_manager = drive_manager

    # Process each script
    all_generated_files = []
    for i, script_file in enumerate(script_files, 1):
        print_header(f"Processing Script {i}/{len(script_files)}: {script_file.name}")

        try:
            generated_files = processor.process_script(
                script_file,
                reference_audio_path,
                reference_text,
                upload_to_drive=config.get('auto_upload', True),
                drive_folder_id=config.get('output_folder_id')
            )
            all_generated_files.extend(generated_files)
            print_status(f"Script {i} complete: {len(generated_files)} files generated", 'success')

        except Exception as e:
            print_status(f"Failed to process {script_file.name}: {str(e)}", 'error')
            continue

    # Final summary
    print_header("Pipeline Complete!")
    print_status(f"Total scripts processed: {len(script_files)}", 'success')
    print_status(f"Total audio files generated: {len(all_generated_files)}", 'success')
    print_status(f"Output directory: {processor.output_dir}", 'info')

    if config.get('auto_upload', True):
        print_status("All files uploaded to Google Drive", 'success')

    print(f"\n{Colors.OKGREEN}{Colors.BOLD}All done! 🎉{Colors.ENDC}\n")


def main():
    parser = argparse.ArgumentParser(
        description='Complete F5-TTS Pipeline: Download → Transcribe → Generate → Upload'
    )
    parser.add_argument('--config', '-c', type=str, default='config.json',
                       help='Path to config JSON file')
    parser.add_argument('--base-dir', '-b', type=str, default='/workspace/f5tts_project',
                       help='Base directory for project')

    args = parser.parse_args()

    config_path = Path(args.config)
    base_dir = Path(args.base_dir)

    try:
        # Load configuration
        config = load_config(config_path)
        print_status(f"Loaded config from: {config_path}", 'success')

        # Run pipeline
        run_pipeline(config, base_dir)

    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}[WARNING]{Colors.ENDC} Pipeline interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_status(f"Pipeline failed: {str(e)}", 'error')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
