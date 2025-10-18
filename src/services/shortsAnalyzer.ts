import axios from 'axios';
import { ShortSegment, ShortsAnalysisResponse } from '../types/shorts';

/**
 * Analyze a video transcript and identify the best 30-60 second segments for viral shorts
 */
export async function analyzeShortsFromTranscript(
  transcript: string,
  openRouterApiKey: string,
  model: string = 'meta-llama/llama-3.1-8b-instruct:free'
): Promise<ShortsAnalysisResponse> {
  try {
    console.log('🎬 Starting shorts analysis...');
    console.log(`📊 Transcript length: ${transcript.length} characters`);
    console.log(`🤖 Using model: ${model}`);

    const prompt = `You are an expert YouTube Shorts creator and viral content analyst. Analyze this video transcript and identify the BEST segments that would make highly engaging 30-60 second short-form videos.

EVALUATION CRITERIA (Consider ALL):
1. **VIRAL POTENTIAL**: Strong hooks, cliffhangers, unexpected twists, attention-grabbing moments
2. **TOPIC-BASED**: Clear themes like motivation, tips, tricks, advice, stories, humor, inspiration
3. **EMOTIONAL PEAKS**: Excitement, surprise, shock, inspiration, curiosity, relatability
4. **SELF-CONTAINED**: Complete mini-story or standalone point that makes sense without context

TARGET SEGMENT LENGTH: 30-60 seconds when spoken (approximately 75-150 words)

For EACH potential short segment, provide:
- start_time: Where the segment starts (estimate based on word position, format: "MM:SS")
- end_time: Where the segment ends (format: "MM:SS")
- title: Catchy, viral-worthy title that hooks viewers (max 60 characters)
- description: Compelling hook description (max 150 characters)
- score: Viral potential rating from 1-10 (be selective, only 7+ worthy segments)
- category: One of ["viral", "topic", "emotional", "story"]
- reason: One sentence explaining why this segment would perform well as a short
- transcript_segment: The EXACT text from the transcript for this segment

IMPORTANT:
- Find at least 10-15 good segments (score 7+)
- Segments should NOT overlap
- Each segment must be 30-60 seconds worth of content (75-150 words approximately)
- Estimate timestamps based on natural speaking pace (~2 words per second)
- Be creative but realistic about viral potential
- Prioritize segments with natural beginnings and endings

Return ONLY a valid JSON object in this EXACT format (no markdown, no code blocks):
{
  "shorts": [
    {
      "start_time": "2:35",
      "end_time": "3:15",
      "title": "This productivity hack changed everything",
      "description": "Reveals the secret technique top performers use daily",
      "score": 9,
      "category": "topic",
      "reason": "Provides actionable advice with a strong hook and clear payoff",
      "transcript_segment": "So here's the thing about productivity..."
    }
  ]
}

TRANSCRIPT TO ANALYZE:
${transcript}

Remember: Return ONLY the JSON object, nothing else. Make sure it's valid JSON.`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7, // Some creativity but not too random
        max_tokens: 4000, // Enough for 10-15 shorts descriptions
      },
      {
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://youtube-transcript-processor.app',
          'X-Title': 'YouTube Shorts Finder',
        },
      }
    );

    const content = response.data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from AI model');
    }

    console.log('🤖 Raw AI response received');

    // Clean up the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    // Parse JSON response
    const parsedResponse = JSON.parse(cleanedContent);

    if (!parsedResponse.shorts || !Array.isArray(parsedResponse.shorts)) {
      throw new Error('Invalid response format: missing shorts array');
    }

    console.log(`✓ Parsed ${parsedResponse.shorts.length} potential shorts from AI`);

    // Process and validate each short
    const processedShorts: ShortSegment[] = parsedResponse.shorts
      .map((short: any) => {
        try {
          // Calculate duration from timestamps
          const startSeconds = parseTimeToSeconds(short.start_time);
          const endSeconds = parseTimeToSeconds(short.end_time);
          const durationSeconds = endSeconds - startSeconds;

          // Validate duration (30-60 seconds)
          if (durationSeconds < 25 || durationSeconds > 65) {
            console.log(`⚠️ Skipping short "${short.title}" - duration ${durationSeconds}s not in 30-60s range`);
            return null;
          }

          // Validate score
          if (short.score < 7) {
            console.log(`⚠️ Skipping short "${short.title}" - score ${short.score} below threshold`);
            return null;
          }

          return {
            startTime: short.start_time,
            endTime: short.end_time,
            title: short.title || 'Untitled Short',
            description: short.description || '',
            score: short.score || 5,
            category: short.category || 'topic',
            reason: short.reason || 'No reason provided',
            transcript: short.transcript_segment || '',
            durationSeconds: durationSeconds,
          } as ShortSegment;
        } catch (error) {
          console.error(`Error processing short:`, error);
          return null;
        }
      })
      .filter((short: ShortSegment | null): short is ShortSegment => short !== null)
      .sort((a: ShortSegment, b: ShortSegment) => b.score - a.score); // Sort by score descending

    console.log(`✅ Successfully processed ${processedShorts.length} valid shorts (30-60s, score 7+)`);

    return {
      shorts: processedShorts,
      totalFound: processedShorts.length,
    };
  } catch (error) {
    console.error('❌ Error analyzing shorts:', error);

    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.error?.message || error.message;

      if (statusCode === 401) {
        return {
          shorts: [],
          totalFound: 0,
          error: 'Invalid OpenRouter API key. Please check your settings.',
        };
      } else if (statusCode === 429) {
        return {
          shorts: [],
          totalFound: 0,
          error: 'Rate limit exceeded. Please try again in a few moments.',
        };
      } else {
        return {
          shorts: [],
          totalFound: 0,
          error: `API Error: ${errorMessage}`,
        };
      }
    }

    return {
      shorts: [],
      totalFound: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred during analysis',
    };
  }
}

/**
 * Parse timestamp string (MM:SS or M:SS) to total seconds
 */
function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid timestamp format: ${timeStr}`);
  }

  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);

  if (isNaN(minutes) || isNaN(seconds)) {
    throw new Error(`Invalid timestamp values: ${timeStr}`);
  }

  return minutes * 60 + seconds;
}

/**
 * Format seconds to MM:SS timestamp
 */
export function formatSecondsToTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
