// Telegram Bot Module
// Exports for the BagsWorld AI Telegram bot

export * from './bot-handler';

import { TelegramBotHandler, getTelegramBot, type TelegramConfig } from './bot-handler';

// Re-export for convenience
export {
  TelegramBotHandler,
  getTelegramBot,
  type TelegramConfig,
};

// Webhook handler for serverless deployment
export async function handleTelegramWebhook(
  request: Request,
  config?: Partial<TelegramConfig>
): Promise<Response> {
  try {
    const bot = getTelegramBot(config);

    // Parse the incoming update
    const update = await request.json();

    // Process the update
    await bot.handleUpdate(update);

    // Return success
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Telegram Webhook] Error processing update:', error);

    // Return 200 to prevent Telegram from retrying
    // Log the error but don't expose it
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Setup webhook with Telegram
export async function setupTelegramWebhook(
  webhookUrl: string,
  botToken?: string
): Promise<boolean> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    }),
  });

  const result = await response.json();

  if (!result.ok) {
    console.error('[Telegram] Failed to set webhook:', result.description);
    return false;
  }

  console.log('[Telegram] Webhook set successfully:', webhookUrl);
  return true;
}

// Delete webhook (for switching to polling)
export async function deleteTelegramWebhook(botToken?: string): Promise<boolean> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
    method: 'POST',
  });

  const result = await response.json();
  return result.ok;
}

// Get webhook info
export async function getTelegramWebhookInfo(botToken?: string): Promise<{
  url: string;
  hasCustomCertificate: boolean;
  pendingUpdateCount: number;
  lastErrorDate?: number;
  lastErrorMessage?: string;
} | null> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const result = await response.json();

  if (!result.ok) {
    return null;
  }

  return {
    url: result.result.url,
    hasCustomCertificate: result.result.has_custom_certificate,
    pendingUpdateCount: result.result.pending_update_count,
    lastErrorDate: result.result.last_error_date,
    lastErrorMessage: result.result.last_error_message,
  };
}

export default TelegramBotHandler;
