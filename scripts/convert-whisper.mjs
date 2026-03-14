import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SPECIAL_TOKEN_RE = /^\[_[^\]]*\]$/;
const PUNCT_ONLY_RE = /^[.,!?:;…]+$|^\.\.\.$|^…$/;

function isPunctOnly(text) {
  return PUNCT_ONLY_RE.test(text.trim());
}

function isSpecial(text) {
  return SPECIAL_TOKEN_RE.test(text.trim());
}

function stripInlineSpecials(text) {
  return text.replace(/\[_[^\]]*_\]/g, '');
}

function convertWhisper(inputPath, outputJsonPath, outputTxtPath, totalDurationMs) {
  const raw = JSON.parse(readFileSync(inputPath, 'utf-8'));
  const segments = raw.transcription;

  const words = [];

  for (const segment of segments) {
    if (!segment.tokens || segment.tokens.length === 0) continue;

    let current = null; // { text, startMs, endMs, confidence, count }

    const flushCurrent = () => {
      if (current !== null) {
        const cleanText = stripInlineSpecials(current.text).trimStart();
        if (cleanText.length > 0) {
          words.push({
            text: cleanText,
            startMs: current.startMs,
            endMs: current.endMs,
            confidence: Math.round((current.confidence / current.count) * 1000) / 1000,
          });
        }
        current = null;
      }
    };

    for (const token of segment.tokens) {
      const text = token.text;

      // Skip special tokens like [_BEG_]
      if (isSpecial(text)) continue;

      const startMs = token.offsets.from;
      const endMs = token.offsets.to;
      const p = token.p ?? 1.0;
      const startsWithSpace = text.startsWith(' ');

      if (isPunctOnly(text.trim())) {
        // Absorb timing into previous word
        if (current !== null) {
          current.endMs = Math.max(current.endMs, endMs);
        }
        continue;
      }

      if (startsWithSpace) {
        // New word boundary: flush previous, start new
        flushCurrent();
        current = {
          text: text,
          startMs,
          endMs,
          confidence: p,
          count: 1,
        };
      } else {
        // Sub-word token: merge with current
        if (current !== null) {
          current.text += text;
          current.endMs = Math.max(current.endMs, endMs);
          current.confidence += p;
          current.count += 1;
        } else {
          // No current word yet (e.g. first token in segment has no space)
          current = {
            text: text,
            startMs,
            endMs,
            confidence: p,
            count: 1,
          };
        }
      }
    }

    flushCurrent();
  }

  // Ensure chronological order
  words.sort((a, b) => a.startMs - b.startMs);

  const transcriptionJson = { words, durationMs: totalDurationMs };
  writeFileSync(outputJsonPath, JSON.stringify(transcriptionJson, null, 2), 'utf-8');

  // Build full text from segment texts
  const fullText = segments
    .map(s => s.text.trim())
    .filter(Boolean)
    .join(' ');
  writeFileSync(outputTxtPath, fullText, 'utf-8');

  return { words, fullText };
}

const projectDir = resolve(__dirname, '../projects/cljs');
const inputPath = resolve(projectDir, 'whisper-output.json');
const outputJsonPath = resolve(projectDir, 'transcription.json');
const outputTxtPath = resolve(projectDir, 'full-text.txt');
const TOTAL_DURATION_MS = 2420466;

const { words, fullText } = convertWhisper(inputPath, outputJsonPath, outputTxtPath, TOTAL_DURATION_MS);

console.log(`Total word count: ${words.length}`);
console.log('\nFirst 5 words:');
words.slice(0, 5).forEach(w => console.log(`  [${w.startMs}-${w.endMs}ms] "${w.text}" (${w.confidence})`));
console.log('\nLast 5 words:');
words.slice(-5).forEach(w => console.log(`  [${w.startMs}-${w.endMs}ms] "${w.text}" (${w.confidence})`));
console.log('\nFirst 500 chars of full-text.txt:');
console.log(fullText.slice(0, 500));
