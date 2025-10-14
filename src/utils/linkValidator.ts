/**
 * Validates if a string is a valid YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check for youtube.com or youtu.be domains
    if (
      hostname === 'www.youtube.com' ||
      hostname === 'youtube.com' ||
      hostname === 'youtu.be' ||
      hostname === 'm.youtube.com'
    ) {
      // Check if it has a video ID
      const videoId = extractVideoId(url);
      return videoId !== null && videoId.length > 0;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extracts video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // For youtu.be format
    if (hostname === 'youtu.be') {
      return urlObj.pathname.substring(1);
    }

    // For youtube.com format
    if (
      hostname === 'www.youtube.com' ||
      hostname === 'youtube.com' ||
      hostname === 'm.youtube.com'
    ) {
      // Check for /watch?v= format
      const searchParams = urlObj.searchParams;
      const videoId = searchParams.get('v');
      if (videoId) {
        return videoId;
      }

      // Check for /embed/ format
      const embedMatch = urlObj.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) {
        return embedMatch[1];
      }

      // Check for /v/ format
      const vMatch = urlObj.pathname.match(/\/v\/([^/?]+)/);
      if (vMatch) {
        return vMatch[1];
      }
    }

    return null;
  } catch {
    return null;
  }
}
