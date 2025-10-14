import axios from 'axios';

export interface AIResponse {
  content: string;
  model: string;
  error?: string;
}

/**
 * Process text with DeepSeek API
 */
export async function processWithDeepSeek(
  prompt: string,
  text: string,
  apiKey: string
): Promise<AIResponse> {
  console.log('[DeepSeek] Starting API request...');
  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\n${text}`,
          },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[DeepSeek] ✓ Response received successfully');
    return {
      content: response.data.choices[0]?.message?.content || '',
      model: 'DeepSeek',
    };
  } catch (error) {
    console.error('[DeepSeek] ✗ Error occurred:', error);
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        return {
          content: '',
          model: 'DeepSeek',
          error: 'Rate limit exceeded. Please wait and try again, or check your API quota.',
        };
      }
      if (error.response?.status === 401) {
        return {
          content: '',
          model: 'DeepSeek',
          error: 'Invalid API key. Please check your DeepSeek API key in settings.',
        };
      }
      return {
        content: '',
        model: 'DeepSeek',
        error: `Error: ${error.response?.data?.error?.message || error.message}`,
      };
    }
    throw error;
  }
}

/**
 * Process text with Gemini 2.5 Flash
 */
export async function processWithGeminiFlash(
  prompt: string,
  text: string,
  apiKey: string
): Promise<AIResponse> {
  console.log('[Gemini Flash] Starting API request...');
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: `${prompt}\n\n${text}`,
              },
            ],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[Gemini Flash] ✓ Response received successfully');
    return {
      content: response.data.candidates[0]?.content?.parts[0]?.text || '',
      model: 'Gemini 2.5 Flash',
    };
  } catch (error) {
    console.error('[Gemini Flash] ✗ Error occurred:', error);
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        return {
          content: '',
          model: 'Gemini 2.5 Flash',
          error: 'Rate limit exceeded. Please wait and try again, or check your API quota.',
        };
      }
      if (error.response?.status === 400) {
        return {
          content: '',
          model: 'Gemini 2.5 Flash',
          error: 'Invalid API key. Please check your Gemini API key in settings.',
        };
      }
      return {
        content: '',
        model: 'Gemini 2.5 Flash',
        error: `Error: ${error.response?.data?.error?.message || error.message}`,
      };
    }
    throw error;
  }
}

/**
 * Process text with Gemini 2.5 Pro
 */
export async function processWithGeminiPro(
  prompt: string,
  text: string,
  apiKey: string
): Promise<AIResponse> {
  console.log('[Gemini Pro] Starting API request...');
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: `${prompt}\n\n${text}`,
              },
            ],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[Gemini Pro] ✓ Response received successfully');
    return {
      content: response.data.candidates[0]?.content?.parts[0]?.text || '',
      model: 'Gemini 2.5 Pro',
    };
  } catch (error) {
    console.error('[Gemini Pro] ✗ Error occurred:', error);
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        return {
          content: '',
          model: 'Gemini 2.5 Pro',
          error: 'Rate limit exceeded. Please wait and try again, or check your API quota.',
        };
      }
      if (error.response?.status === 400) {
        return {
          content: '',
          model: 'Gemini 2.5 Pro',
          error: 'Invalid API key. Please check your Gemini API key in settings.',
        };
      }
      return {
        content: '',
        model: 'Gemini 2.5 Pro',
        error: `Error: ${error.response?.data?.error?.message || error.message}`,
      };
    }
    throw error;
  }
}

/**
 * Process text with OpenRouter API
 */
export async function processWithOpenRouter(
  prompt: string,
  text: string,
  apiKey: string,
  model: string
): Promise<AIResponse> {
  console.log(`[OpenRouter - ${model}] Starting API request...`);
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\n${text}`,
          },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'YouTube Transcript Processor',
        },
      }
    );

    console.log(`[OpenRouter - ${model}] ✓ Response received successfully`);
    return {
      content: response.data.choices[0]?.message?.content || '',
      model: `OpenRouter (${model})`,
    };
  } catch (error) {
    console.error(`[OpenRouter - ${model}] ✗ Error occurred:`, error);
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        return {
          content: '',
          model: `OpenRouter (${model})`,
          error: 'Rate limit exceeded. Please wait and try again, or check your API credits.',
        };
      }
      if (error.response?.status === 401 || error.response?.status === 403) {
        return {
          content: '',
          model: `OpenRouter (${model})`,
          error: 'Invalid API key or insufficient credits. Please check your OpenRouter API key in settings.',
        };
      }
      return {
        content: '',
        model: `OpenRouter (${model})`,
        error: `Error: ${error.response?.data?.error?.message || error.message}`,
      };
    }
    throw error;
  }
}

/**
 * Fetch available OpenRouter models
 */
export async function fetchOpenRouterModels(): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await axios.get('https://openrouter.ai/api/v1/models');
    return response.data.data.map((model: any) => ({
      id: model.id,
      name: model.name || model.id,
    }));
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error);
    // Return some default models if fetch fails
    return [
      { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)' },
      { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    ];
  }
}
