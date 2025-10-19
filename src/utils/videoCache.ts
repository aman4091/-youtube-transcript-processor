import { YouTubeVideo } from '../services/youtubeAPI';

const CACHE_KEY_PREFIX = 'youtube_videos_cache_';
const CACHE_METADATA_KEY = 'youtube_cache_metadata';
const CACHE_VERSION = 2; // Increment when YouTubeVideo interface changes
const CACHE_VERSION_KEY = 'youtube_cache_version';

export interface CachedChannelData {
  channelUrl: string;
  videos: YouTubeVideo[];
  lastUpdated: string;
  pageToken?: string; // Track where to fetch next
  version?: number; // Cache version for migration
}

export interface CacheMetadata {
  [channelUrl: string]: {
    videoCount: number;
    lastUpdated: string;
  };
}

/**
 * Get cache key for a specific channel
 */
const getCacheKey = (channelUrl: string): string => {
  return `${CACHE_KEY_PREFIX}${encodeURIComponent(channelUrl)}`;
};

/**
 * Check if cache version is outdated and clear if needed
 */
const checkAndClearOldCache = (): void => {
  try {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    const currentVersion = CACHE_VERSION.toString();

    if (storedVersion !== currentVersion) {
      console.log(`🔄 Cache version mismatch (stored: ${storedVersion}, current: ${currentVersion}). Clearing old cache...`);
      clearAllVideoCache();
      localStorage.setItem(CACHE_VERSION_KEY, currentVersion);
      console.log('✓ Cache cleared and version updated');
    }
  } catch (error) {
    console.error('Error checking cache version:', error);
  }
};

/**
 * Get cached videos for a specific channel
 */
export const getCachedVideos = (channelUrl: string): YouTubeVideo[] => {
  try {
    // Check cache version first
    checkAndClearOldCache();

    const cacheKey = getCacheKey(channelUrl);
    const cached = localStorage.getItem(cacheKey);

    if (!cached) {
      console.log(`📦 No cache found for ${channelUrl}`);
      return [];
    }

    let data: CachedChannelData;
    try {
      data = JSON.parse(cached);
    } catch (error) {
      console.error('❌ CRITICAL: Corrupted JSON detected in cache! Clearing ALL cache for safety...', error);
      clearAllVideoCache(); // Nuclear option - clear everything
      return [];
    }

    // Double-check: if cached data doesn't have version, it's old
    if (!data.version || data.version < CACHE_VERSION) {
      console.log(`🗑️ Cached data for ${channelUrl} is outdated (v${data.version || 0} < v${CACHE_VERSION}). Clearing...`);
      clearChannelCache(channelUrl);
      return [];
    }

    console.log(`✓ Loaded ${data.videos.length} cached videos for ${channelUrl} (v${data.version})`);
    return data.videos;
  } catch (error) {
    console.error('Error reading cache:', error);
    return [];
  }
};

/**
 * Save videos to cache for a specific channel
 */
export const saveCachedVideos = (channelUrl: string, videos: YouTubeVideo[], pageToken?: string): void => {
  try {
    // Validate videos array
    if (!Array.isArray(videos)) {
      console.error('❌ Cannot save cache: videos is not an array');
      return;
    }

    // Clean videos array - remove any invalid entries
    const validVideos = videos.filter(video => {
      try {
        return (
          video &&
          typeof video === 'object' &&
          typeof video.videoId === 'string' &&
          typeof video.title === 'string' &&
          video.videoId.length > 0
        );
      } catch {
        return false;
      }
    });

    if (validVideos.length !== videos.length) {
      console.warn(`⚠️ Filtered out ${videos.length - validVideos.length} invalid videos before caching`);
    }

    const cacheKey = getCacheKey(channelUrl);
    const data: CachedChannelData = {
      channelUrl,
      videos: validVideos,
      lastUpdated: new Date().toISOString(),
      pageToken,
      version: CACHE_VERSION,
    };

    // Test if data can be stringified properly
    const jsonString = JSON.stringify(data);

    // Test if it can be parsed back (validation)
    try {
      JSON.parse(jsonString);
    } catch (parseError) {
      console.error('❌ Generated cache data is invalid JSON, aborting save:', parseError);
      return;
    }

    localStorage.setItem(cacheKey, jsonString);

    // Update metadata
    updateCacheMetadata(channelUrl, validVideos.length);

    console.log(`💾 Saved ${validVideos.length} videos to cache for ${channelUrl} (v${CACHE_VERSION})${pageToken ? ' (with pageToken)' : ''}`);
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
};

/**
 * Get cached pageToken for a channel
 */
export const getCachedPageToken = (channelUrl: string): string | undefined => {
  try {
    const cacheKey = getCacheKey(channelUrl);
    const cached = localStorage.getItem(cacheKey);

    if (!cached) {
      return undefined;
    }

    let data: CachedChannelData;
    try {
      data = JSON.parse(cached);
    } catch (parseError) {
      console.error('❌ Failed to parse cached data (corrupted JSON). Clearing cache...', parseError);
      clearChannelCache(channelUrl);
      return undefined;
    }

    return data.pageToken;
  } catch (error) {
    console.error('Error reading cached pageToken:', error);
    return undefined;
  }
};

/**
 * Merge new videos with cached videos (avoid duplicates)
 */
export const mergeVideos = (
  cachedVideos: YouTubeVideo[],
  newVideos: YouTubeVideo[]
): YouTubeVideo[] => {
  const videoMap = new Map<string, YouTubeVideo>();

  // Add all cached videos first
  cachedVideos.forEach(video => {
    videoMap.set(video.videoId, video);
  });

  // Add/update with new videos (new videos take priority)
  newVideos.forEach(video => {
    videoMap.set(video.videoId, video);
  });

  // Convert back to array, sorted by published date (newest first)
  const mergedVideos = Array.from(videoMap.values());
  mergedVideos.sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  console.log(`🔄 Merged: ${cachedVideos.length} cached + ${newVideos.length} new = ${mergedVideos.length} total`);
  return mergedVideos;
};

/**
 * Update cache metadata
 */
const updateCacheMetadata = (channelUrl: string, videoCount: number): void => {
  try {
    const metadataStr = localStorage.getItem(CACHE_METADATA_KEY);
    let metadata: CacheMetadata = {};

    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch (parseError) {
        console.error('❌ Failed to parse cache metadata (corrupted JSON). Resetting metadata...', parseError);
        metadata = {};
      }
    }

    metadata[channelUrl] = {
      videoCount,
      lastUpdated: new Date().toISOString(),
    };

    localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('Error updating cache metadata:', error);
  }
};

/**
 * Get cache metadata
 */
export const getCacheMetadata = (): CacheMetadata => {
  try {
    const metadataStr = localStorage.getItem(CACHE_METADATA_KEY);
    if (!metadataStr) return {};

    try {
      return JSON.parse(metadataStr);
    } catch (parseError) {
      console.error('❌ Failed to parse cache metadata (corrupted JSON). Returning empty...', parseError);
      return {};
    }
  } catch (error) {
    console.error('Error reading cache metadata:', error);
    return {};
  }
};

/**
 * Clear cache for a specific channel
 */
export const clearChannelCache = (channelUrl: string): void => {
  try {
    const cacheKey = getCacheKey(channelUrl);
    localStorage.removeItem(cacheKey);

    // Remove from metadata
    const metadataStr = localStorage.getItem(CACHE_METADATA_KEY);
    if (metadataStr) {
      try {
        const metadata: CacheMetadata = JSON.parse(metadataStr);
        delete metadata[channelUrl];
        localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
      } catch (parseError) {
        console.error('❌ Failed to parse cache metadata (corrupted JSON). Clearing all metadata...', parseError);
        localStorage.removeItem(CACHE_METADATA_KEY);
      }
    }

    console.log(`🗑️ Cleared cache for ${channelUrl}`);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

/**
 * Clear all video caches
 */
export const clearAllVideoCache = (): void => {
  try {
    const keys = Object.keys(localStorage);
    let clearedCount = 0;

    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
        clearedCount++;
      }
    });

    localStorage.removeItem(CACHE_METADATA_KEY);
    console.log(`🗑️ Cleared ${clearedCount} channel caches`);
  } catch (error) {
    console.error('Error clearing all caches:', error);
  }
};

/**
 * Get total cached videos count across all channels
 */
export const getTotalCachedVideos = (): number => {
  const metadata = getCacheMetadata();
  return Object.values(metadata).reduce((total, channel) => total + channel.videoCount, 0);
};

/**
 * Check if channel is new (no cached videos)
 */
export const isNewChannel = (channelUrl: string): boolean => {
  const cached = getCachedVideos(channelUrl);
  return cached.length === 0;
};

/**
 * Export all cache data for backup
 */
export const exportAllCacheData = (): { [channelUrl: string]: CachedChannelData } => {
  try {
    const allCacheData: { [channelUrl: string]: CachedChannelData } = {};
    const keys = Object.keys(localStorage);

    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        const cached = localStorage.getItem(key);
        if (cached) {
          try {
            const data: CachedChannelData = JSON.parse(cached);
            allCacheData[data.channelUrl] = data;
          } catch (parseError) {
            console.error(`❌ Failed to parse cached data for key ${key} (corrupted JSON). Skipping...`, parseError);
          }
        }
      }
    });

    console.log(`📤 Exported cache data for ${Object.keys(allCacheData).length} channels`);
    return allCacheData;
  } catch (error) {
    console.error('Error exporting cache data:', error);
    return {};
  }
};

/**
 * Import all cache data from backup
 */
export const importAllCacheData = (cacheData: { [channelUrl: string]: CachedChannelData }): void => {
  try {
    let importedCount = 0;

    Object.values(cacheData).forEach(data => {
      // Update version to current version when importing
      const updatedData = {
        ...data,
        version: CACHE_VERSION,
      };

      const cacheKey = getCacheKey(data.channelUrl);
      localStorage.setItem(cacheKey, JSON.stringify(updatedData));
      updateCacheMetadata(data.channelUrl, data.videos.length);
      importedCount++;
    });

    // Set current cache version
    localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION.toString());

    console.log(`📥 Imported cache data for ${importedCount} channels (upgraded to v${CACHE_VERSION})`);
  } catch (error) {
    console.error('Error importing cache data:', error);
  }
};
