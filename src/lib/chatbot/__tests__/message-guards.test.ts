import { describe, expect, it } from 'vitest';
import {
    hasConfiguredScope,
    isClearlyOutOfScope,
    isExitIntentMessage,
    shouldAttemptLeadExtraction,
    shouldCollectOnExit
} from '@/lib/chatbot/message-guards';

describe('chatbot message guards', () => {
    it('triggers lead collection for on_exit only when exit intent is explicit', () => {
        expect(shouldCollectOnExit({
            triggerStrategy: 'on_exit',
            hasNextMissingField: true,
            hasExitIntent: true,
            totalUserMessages: 3,
            recentlyAsked: false
        })).toBe(true);

        expect(shouldCollectOnExit({
            triggerStrategy: 'on_exit',
            hasNextMissingField: true,
            hasExitIntent: false,
            totalUserMessages: 3,
            recentlyAsked: false
        })).toBe(false);

        expect(isExitIntentMessage('Grazie, per ora basta cosi')).toBe(true);
    });

    it('keeps extraction enabled while waiting for a lead-field reply even during cooldown', () => {
        expect(shouldAttemptLeadExtraction({
            hasNextMissingField: true,
            shouldCollect: true,
            awaitingLeadReply: true
        })).toBe(true);

        expect(shouldAttemptLeadExtraction({
            hasNextMissingField: true,
            shouldCollect: false,
            awaitingLeadReply: true
        })).toBe(false);
    });

    it('flags out-of-scope and uses configured scope context', () => {
        const scopeLexicon = new Set(['prodotto', 'pricing', 'demo']);
        const scopeConfigured = hasConfiguredScope({
            researchGoal: 'Presentare il prodotto SaaS',
            topics: [{ label: 'Product demo' }]
        });

        expect(scopeConfigured).toBe(true);
        expect(isClearlyOutOfScope('Mi consigli una ricetta per la pizza?', scopeLexicon, scopeConfigured)).toBe(true);
        expect(isClearlyOutOfScope('Qual e il pricing del prodotto?', scopeLexicon, scopeConfigured)).toBe(false);
    });
});
