import { describe, expect, it } from 'vitest';
import { responseMentionsCandidateField } from '@/lib/interview/data-collection-guard';

describe('responseMentionsCandidateField', () => {
    it('matches canonical field ids without relying on localized wording', () => {
        expect(responseMentionsCandidateField('Please collect the field "location" now.', 'location')).toBe(true);
        expect(responseMentionsCandidateField('Target field: email.', 'email')).toBe(true);
    });

    it('does not infer semantic matches from interview-specific wording', () => {
        expect(responseMentionsCandidateField('Where are you from?', 'location')).toBe(false);
    });
});
