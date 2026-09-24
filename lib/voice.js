import { readFileSync } from "node:fs";
import path from "node:path";

// The voice profile is bundled with the function via `includeFiles` in vercel.json.
const VOICE_FILE = path.join(process.cwd(), "voice", "meera-pillai-voice.txt");

let cached;

// Returns the full text of Meera's voice profile. Read once per warm instance;
// the file only changes when you redeploy.
export function getVoiceInstructions() {
  if (cached === undefined) {
    cached = readFileSync(VOICE_FILE, "utf8").trim();
    if (!cached) throw new Error(`Voice file is empty: ${VOICE_FILE}`);
  }
  return cached;
}
