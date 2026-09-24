// Generates a draft from the command line, without Telegram, to check the voice:
//   npm run draft -- "Note: customers keep asking why our serum smells different this batch"
import { generateDraft } from "../lib/gemini.js";

const note = process.argv.slice(2).join(" ").trim();
if (!note) {
  console.error('Usage: npm run draft -- "your note here"');
  process.exit(1);
}

console.log(await generateDraft(note));
