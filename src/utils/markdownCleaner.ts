/**
 * Remove markdown formatting from text
 * Converts markdown to plain text by removing formatting characters
 */
export function cleanMarkdown(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // Remove bold/italic markers (**, *, __, _)
  cleaned = cleaned.replace(/\*\*([^\*]+)\*\*/g, '$1'); // **bold** -> bold
  cleaned = cleaned.replace(/\*([^\*]+)\*/g, '$1');     // *italic* -> italic
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');      // __bold__ -> bold
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');        // _italic_ -> italic

  // Remove headers (# ## ### etc)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

  // Remove code blocks (``` or `)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // Remove links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // Remove strikethrough ~~text~~ -> text
  cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1');

  // Remove blockquotes (> )
  cleaned = cleaned.replace(/^>\s+/gm, '');

  // Remove horizontal rules (---, ***, ___)
  cleaned = cleaned.replace(/^[\*\-_]{3,}$/gm, '');

  // Remove list markers (-, *, +, 1., etc)
  cleaned = cleaned.replace(/^[\*\-\+]\s+/gm, '');
  cleaned = cleaned.replace(/^\d+\.\s+/gm, '');

  return cleaned;
}
