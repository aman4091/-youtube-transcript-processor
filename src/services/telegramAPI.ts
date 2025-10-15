import axios from 'axios';

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
const MAX_MESSAGE_LENGTH = 4096; // Telegram's message limit

export interface TelegramSendResult {
  success: boolean;
  error?: string;
  messageCount?: number;
}

/**
 * Split long message into chunks that fit Telegram's 4096 character limit
 */
function splitMessage(message: string, maxLength: number = MAX_MESSAGE_LENGTH): string[] {
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks: string[] = [];
  let remaining = message;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find the last newline within the limit
    let splitPoint = remaining.lastIndexOf('\n', maxLength);

    // If no newline found, find last space
    if (splitPoint === -1 || splitPoint === 0) {
      splitPoint = remaining.lastIndexOf(' ', maxLength);
    }

    // If still no good split point, just cut at max length
    if (splitPoint === -1 || splitPoint === 0) {
      splitPoint = maxLength;
    }

    chunks.push(remaining.substring(0, splitPoint));
    remaining = remaining.substring(splitPoint).trim();
  }

  return chunks;
}

/**
 * Format script for Telegram message
 */
function formatTelegramMessage(
  content: string,
  modelName: string,
  videoTitle?: string,
  videoUrl?: string,
  partNumber?: number,
  totalParts?: number
): string {
  const timestamp = new Date().toLocaleString();
  let header = `📄 *Model:* ${modelName}\n🕐 *Time:* ${timestamp}\n`;

  if (videoTitle) {
    header += `🎬 *Video:* ${videoTitle}\n`;
  }

  if (videoUrl) {
    header += `🔗 *URL:* ${videoUrl}\n`;
  }

  if (partNumber && totalParts && totalParts > 1) {
    header += `📦 *Part:* ${partNumber}/${totalParts}\n`;
  }

  header += `\n─────────────────────\n\n`;

  const footer = `\n\n─────────────────────\n✨ Sent via YouTube Processor`;

  return header + content + footer;
}

/**
 * Send a single message to Telegram
 */
async function sendSingleMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<TelegramSendResult> {
  try {
    const url = `${TELEGRAM_API_BASE}${botToken}/sendMessage`;

    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    });

    if (response.data.ok) {
      return { success: true };
    } else {
      return {
        success: false,
        error: response.data.description || 'Unknown error from Telegram',
      };
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        return { success: false, error: 'Invalid bot token. Please check your settings.' };
      } else if (error.response?.status === 400) {
        return { success: false, error: 'Invalid chat ID or message format.' };
      } else if (error.response?.data?.description) {
        return { success: false, error: error.response.data.description };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message to Telegram',
    };
  }
}

/**
 * Send a script to Telegram (handles splitting if needed)
 */
export async function sendToTelegram(
  botToken: string,
  chatId: string,
  content: string,
  modelName: string,
  videoTitle?: string,
  videoUrl?: string
): Promise<TelegramSendResult> {
  if (!botToken || !chatId) {
    return {
      success: false,
      error: 'Bot token and chat ID are required. Please configure them in Settings.',
    };
  }

  console.log(`📤 Sending to Telegram: ${modelName}`);

  // Format the complete message first
  const fullMessage = formatTelegramMessage(content, modelName, videoTitle, videoUrl);

  // Check if we need to split
  if (fullMessage.length <= MAX_MESSAGE_LENGTH) {
    // Send as single message
    const result = await sendSingleMessage(botToken, chatId, fullMessage);
    if (result.success) {
      console.log('✓ Message sent to Telegram');
    }
    return result;
  }

  // Need to split into multiple messages
  console.log(`⚠️ Message too long (${fullMessage.length} chars), splitting...`);

  // Split only the content part
  const contentChunks = splitMessage(content, MAX_MESSAGE_LENGTH - 300); // Reserve space for header/footer
  console.log(`📦 Split into ${contentChunks.length} parts`);

  // Send each chunk
  for (let i = 0; i < contentChunks.length; i++) {
    const partMessage = formatTelegramMessage(
      contentChunks[i],
      modelName,
      videoTitle,
      videoUrl,
      i + 1,
      contentChunks.length
    );

    const result = await sendSingleMessage(botToken, chatId, partMessage);

    if (!result.success) {
      return {
        success: false,
        error: `Failed to send part ${i + 1}/${contentChunks.length}: ${result.error}`,
      };
    }

    // Add small delay between messages to avoid rate limiting
    if (i < contentChunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`✓ All ${contentChunks.length} parts sent successfully`);
  return { success: true, messageCount: contentChunks.length };
}

/**
 * Verify Telegram credentials by sending a test message
 */
export async function verifyTelegramCredentials(
  botToken: string,
  chatId: string
): Promise<TelegramSendResult> {
  const testMessage = '✅ YouTube Processor connected successfully!\n\nYour scripts will be sent to this chat.';
  return sendSingleMessage(botToken, chatId, testMessage);
}
