type MatchMode = 'exact' | 'compact' | 'fuzzy' | 'none';

const LEGAL_SUFFIXES = new Set([
  'inc', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'company', 'co',
  'spa', 'srl', 'srls', 'sa', 'saa', 'gmbh', 'bv', 'ag', 'plc'
]);

const NAME_STOPWORDS = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le',
  'di', 'de', 'del', 'della', 'dello', 'dei', 'degli', 'delle',
  'da', 'dal', 'dalla', 'dalle', 'a', 'al', 'alla', 'alle',
  'e', 'ed', 'o', 'the', 'of', 'and',
  'detta', 'detto', 'detti', 'dette', 'called', 'known', 'as', 'aka'
]);

function normalizeBase(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCompact(input: string): string {
  return normalizeBase(input).replace(/\s+/g, '');
}

function toTokens(input: string): string[] {
  return normalizeBase(input).split(' ').filter(Boolean);
}

function stripLegalSuffixes(tokens: string[]): string[] {
  const trimmed = [...tokens];
  while (trimmed.length > 0 && LEGAL_SUFFIXES.has(trimmed[trimmed.length - 1])) {
    trimmed.pop();
  }
  return trimmed;
}

function coreTokens(tokens: string[]): string[] {
  return tokens.filter((t) => !NAME_STOPWORDS.has(t));
}

function containsOrderedSubsequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0) return false;
  let pos = 0;
  for (const token of haystack) {
    if (token === needle[pos]) {
      pos += 1;
      if (pos === needle.length) return true;
    }
  }
  return false;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + cost
      );
      prev = temp;
    }
  }
  return dp[b.length];
}

function fuzzyThreshold(length: number): number {
  if (length <= 4) return 1;
  if (length <= 9) return 2;
  return 3;
}

export function findNameMentionPosition(text: string, name: string): { mentioned: boolean; position: number | null; mode: MatchMode } {
  const normalizedText = normalizeBase(text);
  const compactText = normalizedText.replace(/\s+/g, '');
  const fragments = normalizedText.split(/[,;.\n]/).map((v) => v.trim()).filter(Boolean);
  const textTokens = normalizedText.split(' ').filter(Boolean);

  const rawTokens = toTokens(name);
  if (rawTokens.length === 0) return { mentioned: false, position: null, mode: 'none' };

  const canonicalTokens = stripLegalSuffixes(rawTokens);
  const canonicalName = canonicalTokens.join(' ');
  const compactCanonicalName = canonicalName.replace(/\s+/g, '');

  if (canonicalName && normalizedText.includes(canonicalName)) {
    for (let i = 0; i < fragments.length; i++) {
      if (fragments[i].includes(canonicalName)) return { mentioned: true, position: i + 1, mode: 'exact' };
    }
    return { mentioned: true, position: 1, mode: 'exact' };
  }

  if (compactCanonicalName && compactText.includes(compactCanonicalName)) {
    for (let i = 0; i < fragments.length; i++) {
      if (fragments[i].replace(/\s+/g, '').includes(compactCanonicalName)) {
        return { mentioned: true, position: i + 1, mode: 'compact' };
      }
    }
    return { mentioned: true, position: 1, mode: 'compact' };
  }

  const phraseWindow = canonicalTokens.length;
  if (phraseWindow > 0 && textTokens.length >= phraseWindow) {
    for (let i = 0; i <= textTokens.length - phraseWindow; i++) {
      const chunk = textTokens.slice(i, i + phraseWindow).join(' ');
      const distance = levenshtein(chunk, canonicalName);
      if (distance <= fuzzyThreshold(canonicalName.length)) {
        const phrase = chunk;
        for (let f = 0; f < fragments.length; f++) {
          if (fragments[f].includes(phrase)) return { mentioned: true, position: f + 1, mode: 'fuzzy' };
        }
        return { mentioned: true, position: 1, mode: 'fuzzy' };
      }
    }
  }

  // Relaxed match: core name tokens present in order within the same fragment.
  // Captures forms like "Villa Capra detta La Rotonda" for brand "Villa La Rotonda".
  const canonicalCoreTokens = coreTokens(canonicalTokens);
  if (canonicalCoreTokens.length >= 2) {
    for (let i = 0; i < fragments.length; i++) {
      const fragmentTokens = coreTokens(toTokens(fragments[i]));
      if (containsOrderedSubsequence(fragmentTokens, canonicalCoreTokens)) {
        return { mentioned: true, position: i + 1, mode: 'fuzzy' };
      }
    }
  }

  return { mentioned: false, position: null, mode: 'none' };
}

export function findAnyNameMentionPosition(text: string, names: string[]): { mentioned: boolean; position: number | null; mode: MatchMode; matchedName: string | null } {
  let best: { mentioned: boolean; position: number | null; mode: MatchMode; matchedName: string | null } = {
    mentioned: false,
    position: null,
    mode: 'none',
    matchedName: null
  };

  const modeRank: Record<MatchMode, number> = { exact: 3, compact: 2, fuzzy: 1, none: 0 };

  for (const name of names) {
    const match = findNameMentionPosition(text, name);
    if (!match.mentioned) continue;

    if (!best.mentioned) {
      best = { ...match, matchedName: name };
      continue;
    }

    const betterPosition = (match.position ?? Number.MAX_SAFE_INTEGER) < (best.position ?? Number.MAX_SAFE_INTEGER);
    const betterMode = modeRank[match.mode] > modeRank[best.mode];

    if (betterPosition || betterMode) {
      best = { ...match, matchedName: name };
    }
  }

  return best;
}

export function namesLikelySame(a: string, b: string): boolean {
  const na = toCompact(a);
  const nb = toCompact(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const distance = levenshtein(na, nb);
  return distance <= fuzzyThreshold(Math.max(na.length, nb.length));
}
