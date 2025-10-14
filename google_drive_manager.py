#!/usr/bin/env python3
"""
Google Drive Manager for F5-TTS Project
Handles downloading scripts/reference audio and uploading generated audio
"""

import os
import pickle
from pathlib import Path
from pydrive2.auth import GoogleAuth
from pydrive2.drive import GoogleDrive
from typing import List, Optional
import json

class Colors:
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    OKBLUE = '\033[94m'

class DriveManager:
    def __init__(self, base_dir: Path = Path('/workspace/f5tts_project')):
        self.base_dir = base_dir
        self.creds_file = base_dir / 'credentials.json'
        self.token_file = base_dir / 'token.pickle'
        self.drive = None
        self.authenticate()

    def authenticate(self):
        """Authenticate with Google Drive using existing token.pickle"""
        print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} Authenticating with Google Drive...")

        if not self.creds_file.exists():
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} credentials.json not found at {self.creds_file}")
            raise FileNotFoundError("credentials.json is required")

        if not self.token_file.exists():
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} token.pickle not found at {self.token_file}")
            raise FileNotFoundError("token.pickle is required")

        try:
            gauth = GoogleAuth()

            # Load credentials from pickle file
            with open(self.token_file, 'rb') as token:
                gauth.credentials = pickle.load(token)

            # Refresh if expired
            if gauth.access_token_expired:
                gauth.Refresh()
                # Save refreshed token
                with open(self.token_file, 'wb') as token:
                    pickle.dump(gauth.credentials, token)
            else:
                gauth.Authorize()

            self.drive = GoogleDrive(gauth)
            print(f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} Authenticated with Google Drive")

        except Exception as e:
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Authentication failed: {str(e)}")
            raise

    def list_files_in_folder(self, folder_id: str) -> List[dict]:
        """List all files in a Google Drive folder"""
        try:
            query = f"'{folder_id}' in parents and trashed=false"
            file_list = self.drive.ListFile({'q': query}).GetList()
            return file_list
        except Exception as e:
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Failed to list files: {str(e)}")
            return []

    def download_file(self, file_id: str, destination: Path) -> bool:
        """Download a file from Google Drive"""
        try:
            file = self.drive.CreateFile({'id': file_id})
            file.GetContentFile(str(destination))
            print(f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} Downloaded: {destination.name}")
            return True
        except Exception as e:
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Failed to download {file_id}: {str(e)}")
            return False

    def download_folder(self, folder_id: str, destination_dir: Path, recursive: bool = True) -> int:
        """Download all files from a Google Drive folder"""
        destination_dir.mkdir(parents=True, exist_ok=True)
        files = self.list_files_in_folder(folder_id)
        downloaded_count = 0

        for file in files:
            file_name = file['title']
            file_id = file['id']
            mime_type = file['mimeType']

            if mime_type == 'application/vnd.google-apps.folder':
                if recursive:
                    subfolder_path = destination_dir / file_name
                    print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} Downloading folder: {file_name}")
                    downloaded_count += self.download_folder(file_id, subfolder_path, recursive)
            else:
                destination_file = destination_dir / file_name
                if self.download_file(file_id, destination_file):
                    downloaded_count += 1

        return downloaded_count

    def upload_file(self, file_path: Path, folder_id: Optional[str] = None,
                   overwrite: bool = False) -> Optional[str]:
        """Upload a file to Google Drive"""
        try:
            if not file_path.exists():
                print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} File not found: {file_path}")
                return None

            # Check if file already exists
            if folder_id and not overwrite:
                existing_files = self.list_files_in_folder(folder_id)
                for existing_file in existing_files:
                    if existing_file['title'] == file_path.name:
                        print(f"{Colors.WARNING}[WARNING]{Colors.ENDC} File already exists: {file_path.name}")
                        return existing_file['id']

            # Create file metadata
            file_metadata = {
                'title': file_path.name,
            }
            if folder_id:
                file_metadata['parents'] = [{'id': folder_id}]

            # Upload file
            file = self.drive.CreateFile(file_metadata)
            file.SetContentFile(str(file_path))
            file.Upload()

            print(f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} Uploaded: {file_path.name} (ID: {file['id']})")
            return file['id']

        except Exception as e:
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Failed to upload {file_path.name}: {str(e)}")
            return None

    def upload_folder(self, folder_path: Path, parent_folder_id: Optional[str] = None) -> int:
        """Upload all files from a local folder to Google Drive"""
        if not folder_path.exists() or not folder_path.is_dir():
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Directory not found: {folder_path}")
            return 0

        uploaded_count = 0
        for file_path in folder_path.iterdir():
            if file_path.is_file():
                if self.upload_file(file_path, parent_folder_id):
                    uploaded_count += 1
            elif file_path.is_dir():
                # Recursively upload subdirectories
                uploaded_count += self.upload_folder(file_path, parent_folder_id)

        return uploaded_count

    def create_folder(self, folder_name: str, parent_folder_id: Optional[str] = None) -> Optional[str]:
        """Create a new folder in Google Drive"""
        try:
            file_metadata = {
                'title': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            if parent_folder_id:
                file_metadata['parents'] = [{'id': parent_folder_id}]

            folder = self.drive.CreateFile(file_metadata)
            folder.Upload()

            print(f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} Created folder: {folder_name} (ID: {folder['id']})")
            return folder['id']

        except Exception as e:
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Failed to create folder: {str(e)}")
            return None


def main():
    """Main function for CLI usage"""
    import sys
    import argparse

    parser = argparse.ArgumentParser(description='Google Drive Manager for F5-TTS')
    parser.add_argument('action', choices=['download', 'upload', 'list'],
                       help='Action to perform')
    parser.add_argument('--folder-id', '-f', type=str,
                       help='Google Drive folder ID')
    parser.add_argument('--local-path', '-p', type=str,
                       help='Local file/folder path')
    parser.add_argument('--base-dir', '-b', type=str, default='/workspace/f5tts_project',
                       help='Base directory for the project')

    args = parser.parse_args()

    try:
        manager = DriveManager(Path(args.base_dir))

        if args.action == 'list':
            if not args.folder_id:
                print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} --folder-id is required for list action")
                sys.exit(1)

            files = manager.list_files_in_folder(args.folder_id)
            print(f"\n{Colors.OKBLUE}Files in folder:{Colors.ENDC}")
            for file in files:
                print(f"  - {file['title']} (ID: {file['id']})")

        elif args.action == 'download':
            if not args.folder_id or not args.local_path:
                print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} --folder-id and --local-path are required")
                sys.exit(1)

            destination = Path(args.local_path)
            count = manager.download_folder(args.folder_id, destination)
            print(f"\n{Colors.OKGREEN}Downloaded {count} files{Colors.ENDC}")

        elif args.action == 'upload':
            if not args.local_path:
                print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} --local-path is required")
                sys.exit(1)

            source = Path(args.local_path)
            if source.is_file():
                manager.upload_file(source, args.folder_id)
            else:
                count = manager.upload_folder(source, args.folder_id)
                print(f"\n{Colors.OKGREEN}Uploaded {count} files{Colors.ENDC}")

    except Exception as e:
        print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
