import { getVoiceInstructions } from "./voice.js";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Sends one note to Gemini with the voice profile as the system instruction
// and returns the draft post text.
export async function generateDraft(note) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const body = {
    systemInstruction: {
      parts: [{ text: getVoiceInstructions() }],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Turn the note below into a draft post written in Meera's voice, " +
              "following the voice profile exactly. Write a LinkedIn post unless the " +
              "note asks for a newsletter or email. Return only the post text, with no " +
              "preamble, commentary or markdown formatting.\n\n" +
              `NOTE:\n${note}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
    },
  };

  const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${data?.error?.message || "unknown error"}`);
  }

  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();

  if (!text) {
    const reason = candidate?.finishReason || data.promptFeedback?.blockReason || "no content";
    throw new Error(`Gemini returned no draft (${reason})`);
  }
  return text;
}
