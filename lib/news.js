const RSS_BASE = "https://news.google.com/rss/search";

// Decodes the handful of entities that show up in Google News RSS.
function decodeEntities(str) {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripTags(str) {
  return decodeEntities(str.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  return match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

// Searches Google News RSS for the given terms and returns the top result as
// { title, source, date, summary, link, query }, or null if nothing was found.
// Parsed with regex rather than a full XML parser — good enough for Google
// News' consistent RSS format and keeps this dependency-free.
export async function getTopNewsResult(terms) {
  const query = (terms || []).filter(Boolean).join(" ").trim();
  if (!query) return null;

  const url = `${RSS_BASE}?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Google News RSS request failed: ${res.status}`);
  const xml = await res.text();

  const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/i);
  if (!itemMatch) return null;
  const block = itemMatch[1];

  const title = decodeEntities(extractTag(block, "title"));
  const link = decodeEntities(extractTag(block, "link"));
  const date = decodeEntities(extractTag(block, "pubDate"));
  const source = decodeEntities(extractTag(block, "source")) || title.split(" - ").pop() || "";
  const summary = stripTags(extractTag(block, "description")) || title;

  if (!title || !link) return null;
  return { title, source, date, summary, link, query };
}
