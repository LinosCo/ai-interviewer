import type { TopicBlock } from '@prisma/client';

const TOKEN_REGEX = /[\p{L}\p{N}]+/gu;

const STOPWORDS_IT = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
  'di', 'a', 'da', 'in', 'su', 'per', 'con', 'tra', 'fra',
  'del', 'dello', 'della', 'dei', 'degli', 'delle',
  'al', 'allo', 'alla', 'ai', 'agli', 'alle',
  'che', 'e', 'o', 'ma', 'non', 'piu', 'meno', 'come',
  'quale', 'quali', 'questa', 'questo', 'questi', 'queste',
  'cosa', 'chi', 'dove', 'quando', 'perche', 'cioe'
]);

const STOPWORDS_EN = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'without',
  'by', 'at', 'from', 'is', 'are', 'be', 'this', 'that', 'these', 'those',
  'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how'
]);

function extractTokens(text: string): string[] {
  if (!text) return [];
  const matches = text.match(TOKEN_REGEX);
  return matches ? matches.map(t => t.trim()).filter(Boolean) : [];
}

export function buildTopicAnchors(topic: TopicBlock | null, language: string) {
  if (!topic) return { anchors: [], anchorRoots: [] };

  const sourceText = [topic.label, ...(topic.subGoals || [])].join(' ');
  const tokens = extractTokens(sourceText);
  const stopwords = (language || '').toLowerCase().startsWith('it') ? STOPWORDS_IT : STOPWORDS_EN;

  const anchors: string[] = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    // Keep short but meaningful tokens (acronyms, brand names)
    if (lower.length < 4) {
      // Allow 2-3 char tokens only if they look like acronyms (all caps in original)
      if (token.length >= 2 && token === token.toUpperCase() && /^[A-Z]+$/.test(token)) {
        anchors.push(lower);
      }
      continue;
    }
    if (stopwords.has(lower)) continue;
    anchors.push(lower);
  }

  const unique = Array.from(new Set(anchors));
  const limited = unique.slice(0, 6);
  const anchorRoots = limited.map(a => (a.length >= 6 ? a.slice(0, 6) : a));

  return { anchors: limited, anchorRoots };
}

export function responseMentionsAnchors(responseText: string, anchorRoots: string[]) {
  if (!responseText || anchorRoots.length === 0) return false;
  const lower = responseText.toLowerCase();
  return anchorRoots.some(root => root && lower.includes(root));
}

export function buildMessageAnchors(text: string, language: string) {
  if (!text) return { anchors: [], anchorRoots: [] };
  const tokens = extractTokens(text);
  const stopwords = (language || '').toLowerCase().startsWith('it') ? STOPWORDS_IT : STOPWORDS_EN;

  const anchors: string[] = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower.length < 4) continue;
    if (stopwords.has(lower)) continue;
    anchors.push(lower);
  }

  const unique = Array.from(new Set(anchors));
  const limited = unique.slice(0, 4);
  const anchorRoots = limited.map(a => (a.length >= 6 ? a.slice(0, 6) : a));
  return { anchors: limited, anchorRoots };
}
