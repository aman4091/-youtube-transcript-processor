/**
 * Splits text into chunks of approximately maxChars length,
 * breaking at the nearest full stop (.)
 */
export function chunkText(text: string, maxChars: number = 7000): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    // Calculate the end position for this chunk
    let endIndex = currentIndex + maxChars;

    // If this is the last chunk, take everything remaining
    if (endIndex >= text.length) {
      chunks.push(text.substring(currentIndex).trim());
      break;
    }

    // Look for the nearest full stop after the target position
    let fullStopIndex = text.indexOf('.', endIndex);

    // If no full stop found after the target, look backwards
    if (fullStopIndex === -1 || fullStopIndex > currentIndex + maxChars + 500) {
      // Look backwards for a full stop within reasonable range
      for (let i = endIndex; i > currentIndex; i--) {
        if (text[i] === '.') {
          fullStopIndex = i;
          break;
        }
      }
    }

    // If we found a full stop, use it; otherwise just break at maxChars
    if (fullStopIndex !== -1 && fullStopIndex > currentIndex) {
      endIndex = fullStopIndex + 1; // Include the full stop
    }

    chunks.push(text.substring(currentIndex, endIndex).trim());
    currentIndex = endIndex;
  }

  return chunks;
}
