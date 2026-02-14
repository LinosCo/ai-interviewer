export type DuplicateReason = 'none' | 'exact' | 'high_similarity' | 'same_prefix';

export interface DuplicateQuestionMatch {
    isDuplicate: boolean;
    matchedQuestion: string | null;
    similarity: number;
    reason: DuplicateReason;
}

const STOPWORDS_IT = new Set([
    'che', 'chi', 'come', 'con', 'del', 'della', 'delle', 'degli', 'dei', 'dello',
    'dopo', 'fare', 'fatto', 'fra', 'gli', 'hai', 'hanno', 'ho', 'il', 'in', 'la',
    'le', 'lo', 'ma', 'mi', 'nei', 'nel', 'nella', 'nelle', 'non', 'per', 'piu',
    'puoi', 'quale', 'quali', 'quello', 'questa', 'questo', 'se', 'si', 'sono',
    'su', 'sul', 'sulla', 'tra', 'tu', 'un', 'una', 'uno'
]);

const STOPWORDS_EN = new Set([
    'about', 'an', 'and', 'are', 'as', 'at', 'can', 'could', 'did', 'do', 'does',
    'for', 'from', 'how', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'this', 'that',
    'to', 'was', 'were', 'what', 'when', 'where', 'which', 'why', 'with', 'would', 'you'
]);

function normalizeText(input: string): string {
    return String(input || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractQuestions(text: string): string[] {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    if (!compact || !compact.includes('?')) return [];
    return compact
        .split('?')
        .map((piece) => {
            const trimmed = piece.trim();
            if (!trimmed) return '';
            const sentenceParts = trimmed.split(/[.!]/).map((part) => part.trim()).filter(Boolean);
            return sentenceParts[sentenceParts.length - 1] || trimmed;
        })
        .filter(Boolean)
        .map((piece) => `${piece}?`);
}

function getPrimaryQuestion(text: string): string {
    const questions = extractQuestions(text);
    if (questions.length === 0) return '';
    return questions[questions.length - 1];
}

function toTokens(input: string, language: string): string[] {
    const stopwords = language.toLowerCase().startsWith('it') ? STOPWORDS_IT : STOPWORDS_EN;
    return normalizeText(input)
        .split(' ')
        .filter((token) => token.length >= 3 && !stopwords.has(token));
}

function tokenJaccard(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const aSet = new Set(a);
    const bSet = new Set(b);
    let intersection = 0;
    for (const token of aSet) {
        if (bSet.has(token)) intersection++;
    }
    const union = aSet.size + bSet.size - intersection;
    return union > 0 ? intersection / union : 0;
}

function buildNgrams(input: string, n: number): string[] {
    const clean = normalizeText(input).replace(/\s+/g, '');
    if (!clean) return [];
    if (clean.length <= n) return [clean];
    const out: string[] = [];
    for (let idx = 0; idx <= clean.length - n; idx++) {
        out.push(clean.slice(idx, idx + n));
    }
    return out;
}

function diceCoefficient(a: string, b: string): number {
    const n = 3;
    const aNgrams = buildNgrams(a, n);
    const bNgrams = buildNgrams(b, n);
    if (aNgrams.length === 0 || bNgrams.length === 0) return 0;
    const aMap = new Map<string, number>();
    for (const gram of aNgrams) {
        aMap.set(gram, (aMap.get(gram) || 0) + 1);
    }
    let intersection = 0;
    for (const gram of bNgrams) {
        const count = aMap.get(gram) || 0;
        if (count > 0) {
            intersection++;
            aMap.set(gram, count - 1);
        }
    }
    return (2 * intersection) / (aNgrams.length + bNgrams.length);
}

function samePrefix(a: string[], b: string[], minPrefixTokens: number): boolean {
    if (a.length < minPrefixTokens || b.length < minPrefixTokens) return false;
    for (let idx = 0; idx < minPrefixTokens; idx++) {
        if (a[idx] !== b[idx]) return false;
    }
    return true;
}

export function findDuplicateQuestionMatch(params: {
    candidateResponse: string;
    historyAssistantMessages: string[];
    language?: string;
}): DuplicateQuestionMatch {
    const language = (params.language || 'en').toLowerCase();
    const candidateQuestion = getPrimaryQuestion(params.candidateResponse);
    if (!candidateQuestion) {
        return { isDuplicate: false, matchedQuestion: null, similarity: 0, reason: 'none' };
    }

    const candidateNorm = normalizeText(candidateQuestion);
    const candidateTokens = toTokens(candidateQuestion, language);
    if (!candidateNorm) {
        return { isDuplicate: false, matchedQuestion: null, similarity: 0, reason: 'none' };
    }

    let bestMatch: DuplicateQuestionMatch = {
        isDuplicate: false,
        matchedQuestion: null,
        similarity: 0,
        reason: 'none'
    };

    const history = (params.historyAssistantMessages || []).slice(-80);
    for (let msgIndex = history.length - 1; msgIndex >= 0; msgIndex--) {
        const historicalQuestions = extractQuestions(history[msgIndex]);
        for (const historicalQuestion of historicalQuestions) {
            const historicalNorm = normalizeText(historicalQuestion);
            if (!historicalNorm) continue;
            if (historicalNorm === candidateNorm) {
                return {
                    isDuplicate: true,
                    matchedQuestion: historicalQuestion,
                    similarity: 1,
                    reason: 'exact'
                };
            }

            const historicalTokens = toTokens(historicalQuestion, language);
            const jaccard = tokenJaccard(candidateTokens, historicalTokens);
            const dice = diceCoefficient(candidateNorm, historicalNorm);
            const prefixMatch = samePrefix(candidateTokens, historicalTokens, 4);
            const minInformativeLen = Math.min(candidateTokens.length, historicalTokens.length);

            const isHighSimilarity = minInformativeLen >= 5 && (jaccard >= 0.72 || dice >= 0.87);
            const isPrefixDuplicate = minInformativeLen >= 5 && prefixMatch && jaccard >= 0.45;

            if (isHighSimilarity || isPrefixDuplicate) {
                const score = Math.max(jaccard, dice);
                if (!bestMatch.isDuplicate || score > bestMatch.similarity) {
                    bestMatch = {
                        isDuplicate: true,
                        matchedQuestion: historicalQuestion,
                        similarity: score,
                        reason: isPrefixDuplicate ? 'same_prefix' : 'high_similarity'
                    };
                }
            }
        }
    }

    return bestMatch;
}
