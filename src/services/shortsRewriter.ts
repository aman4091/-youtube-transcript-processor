import axios from 'axios';
import { ShortSegment } from '../types/shorts';

export interface RewriteResult {
  index: number;
  originalShort: ShortSegment;
  rewrittenScript: string;
  error?: string;
}

/**
 * Generate a viral short-form video script from a transcript using DeepSeek AI
 */
export async function rewriteShortToViral(
  short: ShortSegment,
  deepSeekApiKey: string
): Promise<string> {
  try {
    console.log(`🎬 Rewriting short: "${short.title}" (${short.durationSeconds}s)`);

    const prompt = `You are an expert viral YouTube Shorts scriptwriter who creates highly engaging, scroll-stopping content.

Transform this transcript into a punchy, viral short-form video script that will maximize watch time and engagement.

ORIGINAL SHORT DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title: ${short.title}
Description: ${short.description}
Category: ${short.category.toUpperCase()}
Duration: ${short.durationSeconds} seconds
Timestamp: ${short.startTime} - ${short.endTime}
Why It's Great: ${short.reason}

ORIGINAL TRANSCRIPT:
${short.transcript}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE A VIRAL SCRIPT FOLLOWING THIS STRUCTURE:

1. HOOK (First 3 seconds - CRITICAL):
   - Start with a shocking question, bold statement, or pattern interrupt
   - Make viewers immediately STOP scrolling
   - Create curiosity gap or fear of missing out
   - Example: "Wait... you've been doing this WRONG your entire life"
   - Example: "If you skip this, you'll regret it tomorrow"

2. BODY (Main content - Build momentum):
   - Keep sentences SHORT and punchy
   - Use conversational, first-person tone (as if YOU are speaking)
   - Build suspense and anticipation
   - Include pattern interrupts ("But here's where it gets crazy...")
   - Maintain high energy and pace
   - Use power words and emotional triggers

3. PAYOFF & CTA (Final 5 seconds):
   - Deliver on the hook's promise
   - End with impact and value
   - Strong call-to-action (follow for more, comment below, etc.)
   - Leave them wanting more

STRICT REQUIREMENTS:
- Length: 30-60 seconds when spoken aloud (~75-150 words)
- First-person perspective ("I", "you", "we")
- Ready for voiceover - natural, conversational tone
- NO markdown, NO formatting, NO explanations
- NO filler words ("um", "like", "you know")
- NO intro/outro phrases ("hey guys", "thanks for watching")
- Use ellipses (...) for dramatic pauses
- Use line breaks for natural speaking rhythm

EMOTIONAL TONE:
- Match the category: ${getCategoryTone(short.category)}

Return ONLY the script text, nothing else. Make it VIRAL.`;

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8, // Higher creativity for viral content
        max_tokens: 500, // ~150 words is enough for 60s script
      },
      {
        headers: {
          Authorization: `Bearer ${deepSeekApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const rewrittenScript = response.data.choices[0]?.message?.content?.trim();

    if (!rewrittenScript) {
      throw new Error('Empty response from DeepSeek API');
    }

    console.log(`✅ Rewritten: "${short.title}" → ${rewrittenScript.split(' ').length} words`);

    return rewrittenScript;
  } catch (error) {
    console.error(`❌ Error rewriting short "${short.title}":`, error);

    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.error?.message || error.message;

      if (statusCode === 401) {
        throw new Error('Invalid DeepSeek API key');
      } else if (statusCode === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment');
      } else {
        throw new Error(`DeepSeek API error: ${errorMessage}`);
      }
    }

    throw error;
  }
}

/**
 * Get emotional tone guidance based on category
 */
function getCategoryTone(category: string): string {
  switch (category) {
    case 'viral':
      return 'Shocking, unexpected, shareable - make it EXPLODE';
    case 'emotional':
      return 'Heartfelt, inspiring, relatable - pull at heartstrings';
    case 'topic':
      return 'Informative but engaging, teach with entertainment';
    case 'story':
      return 'Narrative-driven, suspenseful, character-focused';
    default:
      return 'Engaging and entertaining';
  }
}

/**
 * Batch process multiple shorts with progress tracking
 */
export async function rewriteAllShorts(
  shorts: ShortSegment[],
  deepSeekApiKey: string,
  onProgress?: (current: number, total: number) => void
): Promise<RewriteResult[]> {
  console.log(`🎬 Starting batch rewrite of ${shorts.length} shorts...`);

  const results: RewriteResult[] = [];

  // Process all shorts in parallel for speed
  const promises = shorts.map(async (short, index) => {
    try {
      const rewrittenScript = await rewriteShortToViral(short, deepSeekApiKey);

      const result: RewriteResult = {
        index,
        originalShort: short,
        rewrittenScript,
      };

      // Report progress
      if (onProgress) {
        onProgress(index + 1, shorts.length);
      }

      return result;
    } catch (error) {
      console.error(`❌ Failed to rewrite short #${index + 1}:`, error);

      const result: RewriteResult = {
        index,
        originalShort: short,
        rewrittenScript: short.transcript, // Fallback to original
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      // Still report progress even on error
      if (onProgress) {
        onProgress(index + 1, shorts.length);
      }

      return result;
    }
  });

  // Wait for all to complete
  const allResults = await Promise.all(promises);

  // Sort by index to maintain order
  results.push(...allResults.sort((a, b) => a.index - b.index));

  const successCount = results.filter((r) => !r.error).length;
  const failCount = results.filter((r) => r.error).length;

  console.log(`✅ Batch rewrite complete: ${successCount} success, ${failCount} failed`);

  return results;
}

/**
 * Extract shorts from queue item content (parse the formatted text)
 */
export function extractShortsFromQueueContent(content: string): Array<{
  title: string;
  description: string;
  timestamp: string;
  score: number;
  category: string;
  reason: string;
  transcript: string;
  durationSeconds: number;
}> {
  const shorts: Array<any> = [];

  // Split by "SHORT #X" markers
  const shortBlocks = content.split(/SHORT #\d+\n━+/).filter((block) => block.trim());

  shortBlocks.forEach((block) => {
    try {
      // Extract fields using regex
      const timestampMatch = block.match(/⏱️ TIMESTAMP:\s*(.+?)\s*\((\d+)s\)/);
      const scoreMatch = block.match(/🏆 SCORE:\s*(\d+)\/10/);
      const categoryMatch = block.match(/📂 CATEGORY:\s*(\w+)/);
      const titleMatch = block.match(/📌 TITLE:\s*\n(.+?)(?=\n\n)/s);
      const descriptionMatch = block.match(/📝 DESCRIPTION:\s*\n(.+?)(?=\n\n)/s);
      const reasonMatch = block.match(/💡 WHY THIS WORKS:\s*\n(.+?)(?=\n\n)/s);
      const transcriptMatch = block.match(/📄 TRANSCRIPT:\s*\n(.+?)(?=\n━|$)/s);

      if (timestampMatch && scoreMatch && categoryMatch && titleMatch && transcriptMatch) {
        shorts.push({
          timestamp: timestampMatch[1].trim(),
          durationSeconds: parseInt(timestampMatch[2]),
          score: parseInt(scoreMatch[1]),
          category: categoryMatch[1].toLowerCase(),
          title: titleMatch[1].trim(),
          description: descriptionMatch ? descriptionMatch[1].trim() : '',
          reason: reasonMatch ? reasonMatch[1].trim() : '',
          transcript: transcriptMatch[1].trim(),
        });
      }
    } catch (error) {
      console.error('Error parsing short block:', error);
    }
  });

  console.log(`📄 Extracted ${shorts.length} shorts from queue content`);
  return shorts;
}
