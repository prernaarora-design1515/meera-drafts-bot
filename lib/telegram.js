const MAX_MESSAGE_LENGTH = 4096; // Telegram's per-message limit

function apiUrl(method) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return `https://api.telegram.org/bot${token}/${method}`;
}

export async function callTelegram(method, payload) {
  const res = await fetch(apiUrl(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    throw new Error(`Telegram ${method} failed: ${data.description || res.status}`);
  }
  return data.result;
}

// Splits long text on paragraph/line boundaries so each piece fits in one message.
function splitMessage(text) {
  const chunks = [];
  let rest = text;
  while (rest.length > MAX_MESSAGE_LENGTH) {
    let cut = rest.lastIndexOf("\n\n", MAX_MESSAGE_LENGTH);
    if (cut <= 0) cut = rest.lastIndexOf("\n", MAX_MESSAGE_LENGTH);
    if (cut <= 0) cut = rest.lastIndexOf(" ", MAX_MESSAGE_LENGTH);
    if (cut <= 0) cut = MAX_MESSAGE_LENGTH;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

// Sent as plain text (no parse_mode) so characters in the draft can't break formatting.
export async function sendMessage(chatId, text, replyToMessageId) {
  const chunks = splitMessage(text);
  for (let i = 0; i < chunks.length; i++) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: chunks[i],
      ...(i === 0 && replyToMessageId
        ? { reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true } }
        : {}),
    });
  }
}

export async function sendTyping(chatId) {
  await callTelegram("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}
