# YouTube Transcript Processor

A powerful web application that fetches YouTube video transcripts and processes them through multiple AI models (DeepSeek, Gemini 2.5 Flash, Gemini 2.5 Pro, and OpenRouter) with custom prompts.

## Features

- **YouTube Transcript Fetching**: Automatically fetch transcripts from any YouTube video using SupaData API
- **Smart Chunking**: Splits long transcripts into ~7000 character chunks at the nearest full stop
- **Multi-AI Processing**: Processes each chunk through 4 different AI models simultaneously:
  - DeepSeek
  - Google Gemini 2.5 Flash
  - Google Gemini 2.5 Pro
  - OpenRouter (with customizable model selection)
- **Custom Prompts**: Define your own processing prompt in settings
- **Link History**: Tracks previously processed videos and warns about duplicates
- **Output Management**: Compare outputs from all models and select your preferred final result
- **Character Counting**: Shows character counts for transcript and all outputs
- **Dark Mode Support**: Automatic dark/light theme based on system preferences

## Getting Started

### Prerequisites

- Node.js 18+ installed
- API keys for:
  - SupaData (for YouTube transcripts)
  - DeepSeek
  - Google Gemini
  - OpenRouter

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173`

### Configuration

1. Click the **Settings** icon (gear icon) in the top-right corner
2. Enter your API keys:
   - **SupaData API Key**: Required for fetching YouTube transcripts
   - **DeepSeek API Key**: For DeepSeek AI processing
   - **Google Gemini API Key**: For both Gemini 2.5 Flash and Pro
   - **OpenRouter API Key**: For OpenRouter processing

3. Set your **Custom Prompt**: This text will be prepended to each transcript chunk before processing

4. Select **OpenRouter Model**: Search and select your preferred model from the dropdown

5. Click **Save Settings**

## Usage

1. Paste a YouTube video URL into the input field
2. Click **Start Processing**
3. If the link was previously processed, you'll get a warning with option to proceed
4. Wait for the transcript to be fetched and chunked
5. All chunks will be processed through all 4 AI models in parallel
6. Review the outputs from each model
7. Click **Mark as Final** under your preferred output to save it

## Project Structure

```
src/
├── components/          # React UI components
│   ├── InputSection.tsx
│   ├── SettingsModal.tsx
│   ├── OutputCard.tsx
│   ├── TranscriptDisplay.tsx
│   └── ProcessingStatus.tsx
├── services/           # API integration services
│   ├── supaDataAPI.ts
│   └── aiProcessors.ts
├── stores/            # State management (Zustand)
│   ├── settingsStore.ts
│   └── historyStore.ts
├── utils/             # Utility functions
│   ├── chunkingService.ts
│   ├── characterCounter.ts
│   └── linkValidator.ts
├── App.tsx            # Main application component
└── main.tsx          # Application entry point
```

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Notes

- All settings and history are stored in browser's localStorage
- The chunking algorithm tries to break at the nearest full stop after 7000 characters
- Multiple chunks are processed in parallel for faster results
- Each AI model processes chunks independently

## Troubleshooting

### SupaData API Errors
- **"SupaData API key is invalid or expired"**: Your API key is incorrect. Check and update it in settings
- **"SupaData API rate limit exceeded"**: You've hit your API quota limit. Wait or upgrade your plan
- **"SupaData API access forbidden"**: Your API key may have insufficient permissions or credits
- **"Failed to fetch transcript"**: The video may not have captions available, or there's a network issue

### AI Model Errors
- **"Rate limit exceeded"**: You've hit the API rate limit. Wait a few minutes and try again
- **"Invalid API key"**: Your API key is incorrect for that specific AI service
- **"API key not set"**: You haven't configured the API key for that service in settings
- **Insufficient credits/quota**: Top up your account or wait for quota reset

### General Tips
- For large videos, SupaData may take longer to process (it will poll for results automatically)
- All settings are stored locally in your browser
- If you see persistent errors, try clearing your browser cache and re-entering API keys

## License

MIT License
