// Points the Telegram bot at your Vercel deployment. Run once after deploying:
//   npm run set-webhook
import { callTelegram } from "../lib/telegram.js";

const base = process.env.VERCEL_URL_FOR_WEBHOOK?.replace(/\/+$/, "");
if (!base || base.includes("your-project")) {
  console.error("Set VERCEL_URL_FOR_WEBHOOK in .env to your deployed URL, e.g. https://meera-drafts-bot.vercel.app");
  process.exit(1);
}

const url = `${base}/api/telegram`;
await callTelegram("setWebhook", {
  url,
  secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
  allowed_updates: ["message"],
  drop_pending_updates: true,
});

const info = await callTelegram("getWebhookInfo", {});
console.log(`Webhook set to ${info.url}`);
if (info.last_error_message) console.log(`Last error reported by Telegram: ${info.last_error_message}`);
