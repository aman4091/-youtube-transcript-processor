/**
 * Interface for a single short segment identified from a video transcript
 */
export interface ShortSegment {
  startTime: string;      // Timestamp in MM:SS format (e.g., "2:35")
  endTime: string;        // Timestamp in MM:SS format (e.g., "3:15")
  title: string;          // Catchy viral title for the short (max 60 chars)
  description: string;    // Hook description (max 150 chars)
  score: number;          // Viral potential rating (1-10)
  category: 'viral' | 'topic' | 'emotional' | 'story'; // Segment category
  reason: string;         // Explanation of why this segment is great
  transcript: string;     // Exact text of the segment
  durationSeconds: number; // Calculated duration in seconds
}

/**
 * Response from the shorts analyzer AI service
 */
export interface ShortsAnalysisResponse {
  shorts: ShortSegment[];
  totalFound: number;
  error?: string;
}
