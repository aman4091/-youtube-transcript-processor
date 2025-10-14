#!/usr/bin/env python3
"""
Audio Processor for F5-TTS
- Transcribe reference audio using Whisper AI
- Generate audio using F5-TTS in 500-character chunks
- Upload generated audio to Google Drive progressively
"""

import os
import sys
import torch
import whisper
import soundfile as sf
import numpy as np
from pathlib import Path
from typing import List, Optional, Tuple
from tqdm import tqdm
import time

# Import Google Drive manager
from google_drive_manager import DriveManager

class Colors:
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    OKBLUE = '\033[94m'
    HEADER = '\033[95m'
    BOLD = '\033[1m'


class AudioProcessor:
    def __init__(self, base_dir: Path = Path('/workspace/f5tts_project')):
        self.base_dir = base_dir
        self.input_dir = base_dir / 'input'
        self.output_dir = base_dir / 'output' / 'generated_audio'
        self.reference_audio_dir = base_dir / 'input' / 'reference_audio'
        self.scripts_dir = base_dir / 'input' / 'scripts'
        self.temp_dir = base_dir / 'temp'

        # Ensure directories exist
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)

        # Initialize models
        self.whisper_model = None
        self.f5tts_model = None

        # Google Drive manager
        self.drive_manager = None

        print(f"{Colors.OKGREEN}[INIT]{Colors.ENDC} AudioProcessor initialized")
        print(f"  Base dir: {self.base_dir}")
        print(f"  Reference audio: {self.reference_audio_dir}")
        print(f"  Output dir: {self.output_dir}")

    def load_whisper_model(self, model_size: str = 'base'):
        """Load Whisper AI model for transcription"""
        print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} Loading Whisper model ({model_size})...")
        try:
            self.whisper_model = whisper.load_model(model_size)
            print(f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} Whisper model loaded")
        except Exception as e:
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Failed to load Whisper: {str(e)}")
            raise

    def transcribe_audio(self, audio_path: Path) -> str:
        """Transcribe audio file using Whisper"""
        if self.whisper_model is None:
            self.load_whisper_model()

        print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} Transcribing: {audio_path.name}")
        try:
            result = self.whisper_model.transcribe(str(audio_path))
            transcription = result['text'].strip()
            print(f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} Transcription complete")
            print(f"  Text: {transcription[:100]}..." if len(transcription) > 100 else f"  Text: {transcription}")
            return transcription
        except Exception as e:
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Transcription failed: {str(e)}")
            raise

    def load_f5tts_model(self):
        """Load F5-TTS model"""
        print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} Loading F5-TTS model...")
        try:
            # Import F5-TTS components
            sys.path.insert(0, str(self.base_dir / 'F5-TTS'))
            from f5_tts.api import F5TTS

            self.f5tts_model = F5TTS()
            print(f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} F5-TTS model loaded")
        except Exception as e:
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Failed to load F5-TTS: {str(e)}")
            print(f"{Colors.WARNING}[WARNING]{Colors.ENDC} Make sure F5-TTS is properly installed")
            raise

    def chunk_text(self, text: str, max_chars: int = 500) -> List[str]:
        """Split text into chunks of max_chars, breaking at sentence boundaries"""
        if len(text) <= max_chars:
            return [text]

        chunks = []
        current_pos = 0

        while current_pos < len(text):
            # Calculate end position
            end_pos = current_pos + max_chars

            if end_pos >= len(text):
                # Last chunk
                chunks.append(text[current_pos:].strip())
                break

            # Look for sentence ending near the chunk boundary
            chunk = text[current_pos:end_pos]

            # Try to find last sentence ending
            for delimiter in ['. ', '! ', '? ', '.\n', '!\n', '?\n']:
                last_delim = chunk.rfind(delimiter)
                if last_delim != -1:
                    end_pos = current_pos + last_delim + len(delimiter)
                    break

            chunks.append(text[current_pos:end_pos].strip())
            current_pos = end_pos

        return chunks

    def generate_audio_chunk(self, text: str, reference_audio: Path,
                           reference_text: str, output_path: Path) -> bool:
        """Generate audio for a single text chunk using F5-TTS"""
        if self.f5tts_model is None:
            self.load_f5tts_model()

        try:
            print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} Generating audio chunk...")
            print(f"  Text: {text[:50]}..." if len(text) > 50 else f"  Text: {text}")

            # Generate audio using F5-TTS
            audio_data = self.f5tts_model.infer(
                ref_file=str(reference_audio),
                ref_text=reference_text,
                gen_text=text,
            )

            # Save audio file
            sf.write(str(output_path), audio_data, 24000)  # F5-TTS typically uses 24kHz

            print(f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} Audio chunk generated: {output_path.name}")
            return True

        except Exception as e:
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Failed to generate audio: {str(e)}")
            return False

    def merge_audio_files(self, audio_files: List[Path], output_path: Path) -> bool:
        """Merge multiple audio files into one"""
        try:
            print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} Merging {len(audio_files)} audio files...")

            audio_segments = []
            for audio_file in audio_files:
                audio, sr = sf.read(str(audio_file))
                audio_segments.append(audio)

            # Concatenate audio
            merged_audio = np.concatenate(audio_segments)

            # Save merged audio
            sf.write(str(output_path), merged_audio, sr)

            print(f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} Merged audio saved: {output_path.name}")
            return True

        except Exception as e:
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Failed to merge audio: {str(e)}")
            return False

    def process_script(self, script_path: Path, reference_audio: Path,
                      reference_text: str, upload_to_drive: bool = True,
                      drive_folder_id: Optional[str] = None) -> List[Path]:
        """Process a complete script file"""
        print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}Processing Script: {script_path.name}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")

        # Read script
        with open(script_path, 'r', encoding='utf-8') as f:
            script_text = f.read().strip()

        print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} Script length: {len(script_text)} characters")

        # Split into chunks
        chunks = self.chunk_text(script_text, max_chars=500)
        print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} Split into {len(chunks)} chunks")

        # Generate audio for each chunk
        generated_files = []
        script_name = script_path.stem

        for i, chunk in enumerate(tqdm(chunks, desc="Generating audio chunks")):
            chunk_output = self.temp_dir / f"{script_name}_chunk_{i+1:03d}.wav"

            if self.generate_audio_chunk(chunk, reference_audio, reference_text, chunk_output):
                generated_files.append(chunk_output)

                # Upload chunk to Drive immediately if enabled
                if upload_to_drive and self.drive_manager:
                    self.drive_manager.upload_file(chunk_output, drive_folder_id)

            # Small delay to avoid overwhelming the GPU
            time.sleep(0.5)

        # Merge all chunks
        if generated_files:
            final_output = self.output_dir / f"{script_name}_complete.wav"
            if self.merge_audio_files(generated_files, final_output):
                generated_files.append(final_output)

                # Upload final merged file to Drive
                if upload_to_drive and self.drive_manager:
                    self.drive_manager.upload_file(final_output, drive_folder_id)

        print(f"\n{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} Processing complete!")
        print(f"  Generated {len(generated_files)} files")

        return generated_files


def main():
    """Main execution function"""
    import argparse

    parser = argparse.ArgumentParser(description='Audio Processor with Whisper + F5-TTS')
    parser.add_argument('--reference-audio', '-r', type=str, required=True,
                       help='Path to reference audio file')
    parser.add_argument('--script', '-s', type=str, required=True,
                       help='Path to script text file')
    parser.add_argument('--output-folder-id', '-o', type=str,
                       help='Google Drive folder ID for uploads')
    parser.add_argument('--no-upload', action='store_true',
                       help='Disable automatic upload to Drive')
    parser.add_argument('--whisper-model', '-w', type=str, default='base',
                       choices=['tiny', 'base', 'small', 'medium', 'large'],
                       help='Whisper model size')
    parser.add_argument('--base-dir', '-b', type=str, default='/workspace/f5tts_project',
                       help='Base directory')

    args = parser.parse_args()

    try:
        # Initialize processor
        processor = AudioProcessor(Path(args.base_dir))

        # Load Whisper model
        processor.load_whisper_model(args.whisper_model)

        # Transcribe reference audio
        reference_audio = Path(args.reference_audio)
        if not reference_audio.exists():
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Reference audio not found: {reference_audio}")
            sys.exit(1)

        reference_text = processor.transcribe_audio(reference_audio)

        # Initialize Drive manager if upload is enabled
        if not args.no_upload:
            processor.drive_manager = DriveManager(Path(args.base_dir))

        # Process script
        script_path = Path(args.script)
        if not script_path.exists():
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Script file not found: {script_path}")
            sys.exit(1)

        generated_files = processor.process_script(
            script_path,
            reference_audio,
            reference_text,
            upload_to_drive=not args.no_upload,
            drive_folder_id=args.output_folder_id
        )

        print(f"\n{Colors.OKGREEN}{Colors.BOLD}All done!{Colors.ENDC}")
        print(f"Generated files: {len(generated_files)}")

    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}[WARNING]{Colors.ENDC} Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
