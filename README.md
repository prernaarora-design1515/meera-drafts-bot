# Meera drafts bot

Meera sends a note to a Telegram bot. The bot sends the note to Gemini along with her voice profile, and replies in the same chat with a draft post.

```
Telegram message ──► Vercel function (api/telegram.js) ──► Gemini
                                   ▲                          │
                                   └──── draft sent back ◄────┘
```

## Files

| File | What it does |
| --- | --- |
| `api/telegram.js` | Webhook Telegram calls for every message. Checks the secret, generates the draft, replies. |
| `lib/gemini.js` | Calls the Gemini API with the voice profile as the system instruction. |
| `lib/voice.js` | Loads the voice profile from `voice/meera-pillai-voice.txt`. |
| `lib/telegram.js` | Sends messages (splitting drafts over Telegram's 4096-character limit). |
| `voice/meera-pillai-voice.txt` | Meera's voice profile. Sent to Gemini on every draft. |
| `scripts/set-webhook.js` | Registers your Vercel URL with Telegram. |
| `scripts/test-draft.js` | Generates a draft from the command line, without Telegram. |
| `vercel.json` | Bundles the `voice/` folder with the function and allows up to 60s per request. |

No npm packages are needed. It uses Node 20+'s built-in `fetch`.

## Setup

1. **Create the bot.** In Telegram, message [@BotFather](https://t.me/BotFather), send `/newbot`, and copy the token.
2. **Get a Gemini key** at https://aistudio.google.com/apikey.
3. **Deploy to Vercel.** Push this folder to a GitHub repo and import it in Vercel (no framework preset or build command needed), or run `npx vercel --prod` from this folder.
4. **Add environment variables** in Vercel → Project → Settings → Environment Variables (see `.env.example`):
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET`: any random string you make up
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (optional, default `gemini-3.8-flash`)
   - `ALLOWED_CHAT_IDS` (optional, see step 7)

   Redeploy after adding them.
5. **Connect Telegram to Vercel.** Copy `.env.example` to `.env`, fill in the same values plus `VERCEL_URL_FOR_WEBHOOK`, then run:
   ```bash
   npm run set-webhook
   ```
6. **Test it.** Send the bot a note. A draft should come back within about 10–20 seconds.
7. **Lock it to Meera (recommended).** Have Meera send `/id` to the bot, put that number in `ALLOWED_CHAT_IDS`, and redeploy. Anyone else who messages the bot will get "Sorry, this bot is private."

## Using it

- Any text message is treated as a note and turned into a LinkedIn post.
- If the note mentions "newsletter" or "email", Gemini writes that format instead.
- `/start` or `/help` shows instructions. `/id` shows the chat ID.

## Changing the voice

Edit `voice/meera-pillai-voice.txt` and redeploy. The whole file is sent to Gemini as its system instruction on every draft.

To try the voice without Telegram:

```bash
npm run draft -- "Note: we delayed the sunscreen launch because stability testing failed at 40C"
```

## Troubleshooting

- **No reply:** check Vercel → Project → Logs, and confirm the webhook with `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.
- **401 in the logs:** `TELEGRAM_WEBHOOK_SECRET` in Vercel doesn't match the one used when you ran `set-webhook`. Fix it and run the script again.
- **"Something went wrong" reply:** usually a missing or invalid `GEMINI_API_KEY` or model name. The exact error is in the Vercel logs.
