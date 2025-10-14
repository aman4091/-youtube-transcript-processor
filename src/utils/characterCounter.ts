/**
 * Count characters in a string
 */
export function countCharacters(text: string): number {
  return text.length;
}

/**
 * Format character count with commas for readability
 */
export function formatCharacterCount(count: number): string {
  return count.toLocaleString();
}
