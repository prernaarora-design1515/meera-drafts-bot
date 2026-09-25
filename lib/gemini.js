import { getVoiceInstructions } from "./voice.js";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const SCORE_PROMPT =
  "You are triaging notes sent by a founder to decide if they have enough substance " +
  "to become a meaningful LinkedIn post. Score the note from 0 to 10:\n\n" +
  "0-2 = a task, reminder, logistics note, or otherwise meaningless as content\n" +
  "3-5 = vague, incomplete, generic, or lacking substance\n" +
  "6-7 = a clear idea, observation, experience, insight, or story\n" +
  "8-10 = a strong, specific, substantive idea with clear post potential\n\n" +
  "Do not judge grammar or polish. A short note can still score highly if the idea itself " +
  "is strong. Respond with only a JSON object, no other text, in this exact shape:\n" +
  '{"score": 7, "reason": "Clear idea with enough substance to develop into a post."}\n\n' +
  "The reason should be one short sentence, written directly to the person who sent the note.";

// Scores a note 0-10 on whether it has enough substance for a post.
// Returns { score, reason }. On any parsing failure, scores it 10 so the note
// passes through to drafting rather than being silently dropped.
export async function scoreNote(note) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const body = {
    systemInstruction: {
      parts: [{ text: SCORE_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: `NOTE:\n${note}` }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
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
    throw new Error(`Gemini returned no score (${reason})`);
  }

  try {
    const parsed = JSON.parse(text);
    const score = Number(parsed.score);
    if (!Number.isFinite(score)) throw new Error("score is not a number");
    return { score, reason: String(parsed.reason || "").trim() };
  } catch (err) {
    console.error("Failed to parse score response, letting note through:", text, err);
    return { score: 10, reason: "" };
  }
}

const TERMS_PROMPT =
  "Extract 3 to 5 short search terms or phrases from the note below, suitable for " +
  "searching a news site to find a relevant, timely news article related to the note's " +
  "subject matter. Focus on the topic itself (ingredients, industry, practice, company " +
  "type) rather than on the founder's personal details. Respond with only a JSON object, " +
  "no other text, in this exact shape:\n" +
  '{"terms": ["term one", "term two", "term three"]}';

// Extracts 3-5 news-search terms from an approved note.
// Returns an array of terms, or [] if Gemini's response can't be parsed
// (the caller treats that as "no news search possible" rather than an error).
export async function extractSearchTerms(note) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const body = {
    systemInstruction: {
      parts: [{ text: TERMS_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: `NOTE:\n${note}` }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
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

  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    const terms = Array.isArray(parsed.terms) ? parsed.terms : [];
    return terms.map((t) => String(t).trim()).filter(Boolean).slice(0, 5);
  } catch (err) {
    console.error("Failed to parse search-terms response:", text, err);
    return [];
  }
}

// Sends one note to Gemini with the voice profile as the system instruction
// and returns the draft post text. `newsItem` is optional ({ title, source,
// date, summary, link } from lib/news.js); when omitted, the prompt is
// identical to the original note-only draft.
export async function generateDraft(note, newsItem) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const newsBlock = newsItem
    ? "\n\nA POSSIBLY RELEVANT NEWS ITEM:\n" +
      `Headline: ${newsItem.title}\n` +
      `Source: ${newsItem.source}\n` +
      `Date: ${newsItem.date}\n` +
      `Summary: ${newsItem.summary}\n` +
      `Link: ${newsItem.link}\n\n` +
      "If this news item is genuinely relevant, use it to make the post timely. " +
      "If it doesn't fit naturally, ignore it completely — do not force it in. " +
      "If, and only if, you actually used it in the post, add one short line at the very " +
      `end in this exact format: Source: ${newsItem.title} — ${newsItem.link}`
    : "";

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
              "preamble, commentary or markdown formatting." +
              newsBlock +
              `\n\nNOTE:\n${note}`,
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
