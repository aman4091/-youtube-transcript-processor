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
 * Escape Markdown special characters for Telegram
 */
function escapeMarkdown(text: string): string {
  // Escape special Markdown characters
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
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
  let header = `📄 *Model:* ${escapeMarkdown(modelName)}\n🕐 *Time:* ${escapeMarkdown(timestamp)}\n`;

  if (videoTitle) {
    header += `🎬 *Video:* ${escapeMarkdown(videoTitle)}\n`;
  }

  if (videoUrl) {
    header += `🔗 *URL:* ${escapeMarkdown(videoUrl)}\n`;
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

    console.log(`📤 Sending to Telegram API...`);
    console.log(`   Chat ID: ${chatId}`);
    console.log(`   Message length: ${message.length} chars`);

    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    });

    if (response.data.ok) {
      console.log('✓ Telegram API response: OK');
      return { success: true };
    } else {
      console.error('✗ Telegram API response not OK:', response.data);
      return {
        success: false,
        error: response.data.description || 'Unknown error from Telegram',
      };
    }
  } catch (error) {
    console.error('✗ Telegram API error:', error);

    if (axios.isAxiosError(error)) {
      console.error('   Status:', error.response?.status);
      console.error('   Response data:', error.response?.data);

      if (error.response?.status === 401) {
        return { success: false, error: 'Invalid bot token. Please check your settings.' };
      } else if (error.response?.status === 400) {
        const telegramError = error.response?.data?.description || 'Invalid chat ID or message format.';
        return { success: false, error: `Telegram Error: ${telegramError}` };
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
 * Get bot info to verify token is valid
 */
async function getBotInfo(botToken: string): Promise<{ success: boolean; botUsername?: string; error?: string }> {
  try {
    const url = `${TELEGRAM_API_BASE}${botToken}/getMe`;
    const response = await axios.get(url);

    if (response.data.ok) {
      return {
        success: true,
        botUsername: response.data.result.username
      };
    } else {
      return {
        success: false,
        error: 'Invalid bot token'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to verify bot token'
    };
  }
}

/**
 * Check if chat ID is a channel (starts with -100)
 */
function isChannel(chatId: string): boolean {
  return chatId.startsWith('-100');
}

/**
 * Verify Telegram credentials by sending a test message
 */
export async function verifyTelegramCredentials(
  botToken: string,
  chatId: string
): Promise<TelegramSendResult> {
  console.log('🔍 Verifying Telegram credentials...');
  console.log('   Bot Token:', botToken.substring(0, 20) + '...');
  console.log('   Chat ID:', chatId);
  console.log('   Chat ID type:', typeof chatId);
  console.log('   Chat ID length:', chatId.length);
  console.log('   First 5 chars:', chatId.substring(0, 5));

  // First verify bot token
  const botInfo = await getBotInfo(botToken);
  if (!botInfo.success) {
    console.error('✗ Bot token is invalid');
    return {
      success: false,
      error: '❌ Invalid Bot Token. Please check your token from @BotFather.'
    };
  }

  console.log(`✓ Bot token valid: @${botInfo.botUsername}`);

  // Try to get chat info to verify access
  console.log('🔍 Checking chat access...');
  try {
    const getChatUrl = `${TELEGRAM_API_BASE}${botToken}/getChat`;
    const chatInfoResponse = await axios.post(getChatUrl, { chat_id: chatId });

    if (chatInfoResponse.data.ok) {
      const chat = chatInfoResponse.data.result;
      console.log('✓ Chat access verified!');
      console.log('   Chat type:', chat.type);
      console.log('   Chat title:', chat.title || chat.username || 'N/A');
      console.log('   Chat ID (from API):', chat.id);
    } else {
      console.error('✗ Cannot access chat:', chatInfoResponse.data.description);
      return {
        success: false,
        error: `Cannot access chat: ${chatInfoResponse.data.description}`
      };
    }
  } catch (error) {
    console.error('✗ Chat access error:', error);
    if (axios.isAxiosError(error) && error.response?.data?.description) {
      console.error('   Telegram says:', error.response.data.description);

      // If chat not found, provide helpful error
      if (error.response.data.description.includes('chat not found')) {
        return {
          success: false,
          error: `❌ Chat not found! Bot may not be admin yet. Make sure:\n1. Bot is added as admin in channel\n2. "Post Messages" permission is enabled\n3. You've started personal chat with bot`
        };
      }

      return {
        success: false,
        error: `❌ ${error.response.data.description}`
      };
    }
  }

  // Check if this is a channel
  if (isChannel(chatId)) {
    console.log('📢 Detected CHANNEL ID (starts with -100)');
    console.log('');
    console.log('⚠️ FOR CHANNELS, YOU MUST:');
    console.log(`   1. Add @${botInfo.botUsername} as ADMINISTRATOR to your channel`);
    console.log('   2. Give permissions: "Post Messages" (minimum)');
    console.log('   3. Also start a personal chat with the bot (search bot → START)');
    console.log('');
    console.log('📱 Steps to add bot as admin:');
    console.log('   1. Open your channel');
    console.log('   2. Channel info → Administrators');
    console.log('   3. Add Administrator → Search your bot');
    console.log(`   4. Select @${botInfo.botUsername}`);
    console.log('   5. Enable "Post Messages" permission');
    console.log('   6. Save');
    console.log('');
  } else {
    console.log('👤 Detected PERSONAL CHAT ID');
    console.log(`📱 Make sure you have started a chat with @${botInfo.botUsername}!`);
    console.log(`   1. Search for @${botInfo.botUsername} on Telegram`);
    console.log(`   2. Click START or send /start`);
    console.log(`   3. Then try this test again`);
    console.log('');
  }

  const testMessage = `✅ YouTube Processor connected successfully!\n\nYour scripts will be sent to this chat.\n\nBot: @${botInfo.botUsername}`;
  return sendSingleMessage(botToken, chatId, testMessage);
}
