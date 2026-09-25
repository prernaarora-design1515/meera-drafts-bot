import { extractSearchTerms, generateDraft, scoreNote } from "../lib/gemini.js";
import { getTopNewsResult } from "../lib/news.js";
import { sendMessage, sendTyping } from "../lib/telegram.js";

const MIN_SCORE = 6;

const HELP_TEXT =
  "Send me a note as a text message and I'll reply with a draft post in your voice.\n\n" +
  "Review the draft, edit it if needed, then post it on LinkedIn yourself.\n\n" +
  "Mention \"newsletter\" or \"email\" in the note if you want that format instead of a LinkedIn post.";

function isAllowed(chatId) {
  const allowed = (process.env.ALLOWED_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(String(chatId));
}

// Flow: Meera's typed note -> Gemini scores it -> if it has enough substance,
// draft in her voice (Gemini) -> back to Meera to review and post. Otherwise
// she gets the reason and nothing else happens.
// Telegram webhook endpoint: POST /api/telegram
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Meera drafts bot is running.");
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    return res.status(401).send("Unauthorized");
  }

  const message = req.body?.message;
  const chatId = message?.chat?.id;

  // Always answer 200 below so Telegram doesn't retry and send duplicate drafts.
  if (!chatId) return res.status(200).json({ ok: true });

  try {
    const text = (message.text || "").trim();

    if (text === "/id") {
      await sendMessage(chatId, `This chat's ID is ${chatId}`);
    } else if (!isAllowed(chatId)) {
      await sendMessage(chatId, "Sorry, this bot is private.");
    } else if (!text) {
      await sendMessage(chatId, "I can only work with text notes. Please type or paste your note.");
    } else if (text === "/start" || text === "/help") {
      await sendMessage(chatId, HELP_TEXT);
    } else {
      await sendTyping(chatId);
      const { score, reason } = await scoreNote(text);
      const scoreLine = `Score: ${score}/10${reason ? ` — ${reason}` : ""}`;

      if (score < MIN_SCORE) {
        await sendMessage(chatId, scoreLine, message.message_id);
      } else {
        // Score sent separately so the draft message below stays clean to copy into LinkedIn.
        await sendMessage(chatId, scoreLine, message.message_id);
        await sendTyping(chatId);

        // News angle is best-effort: any failure here (Gemini, RSS, parsing)
        // just falls back to drafting from the note alone.
        let newsItem = null;
        try {
          const terms = await extractSearchTerms(text);
          newsItem = await getTopNewsResult(terms);
        } catch (err) {
          console.error("News lookup failed, drafting without it:", err);
        }

        const draft = await generateDraft(text, newsItem);
        await sendMessage(chatId, draft);
      }
    }
  } catch (err) {
    console.error("Failed to handle update:", err);
    await sendMessage(
      chatId,
      "Something went wrong while writing the draft. Please try sending the note again."
    ).catch(() => {});
  }

  return res.status(200).json({ ok: true });
}
