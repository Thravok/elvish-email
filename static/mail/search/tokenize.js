// Unicode-aware word tokenization for the local mail body index.
//
// Uses Intl.Segmenter when available (Chrome 87+, Safari 14.1+, Firefox 125+).
// Falls back to a regex-based extractor for older browsers and Web Workers in
// environments without Segmenter support.

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
  'has', 'have', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'me', 'my',
  'no', 'not', 'of', 'on', 'or', 'so', 'that', 'the', 'this', 'to',
  'was', 'we', 'were', 'will', 'with', 'you', 'your',
]);

const FALLBACK_RE = /[\p{Letter}\p{Number}]+/gu;
let segmenter = null;

function getSegmenter() {
  if (segmenter !== null) return segmenter;
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    try {
      segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
      return segmenter;
    } catch (_) {
      segmenter = false;
    }
  }
  segmenter = false;
  return null;
}

export function tokenize(text, opts = {}) {
  const stops = opts.includeStopWords ? new Set() : STOP_WORDS;
  const out = [];
  if (!text) return out;
  const seg = getSegmenter();
  if (seg) {
    let pos = 0;
    for (const part of seg.segment(text)) {
      if (!part.isWordLike) {
        pos = part.index + part.segment.length;
        continue;
      }
      const w = part.segment.toLowerCase();
      pos = part.index + part.segment.length;
      if (w.length < 2 || stops.has(w)) continue;
      out.push({ term: w, position: part.index });
    }
    return out;
  }
  let m;
  while ((m = FALLBACK_RE.exec(text)) !== null) {
    const w = m[0].toLowerCase();
    if (w.length < 2 || stops.has(w)) continue;
    out.push({ term: w, position: m.index });
  }
  return out;
}

export function uniqueTerms(tokens) {
  const map = new Map();
  for (const { term, position } of tokens) {
    let bucket = map.get(term);
    if (!bucket) {
      bucket = { term, tf: 0, positions: [] };
      map.set(term, bucket);
    }
    bucket.tf += 1;
    if (bucket.positions.length < 64) bucket.positions.push(position);
  }
  return [...map.values()];
}
