import { describe, expect, it } from 'vitest';
import { getFieldLabel, getNextMissingCandidateField, isConsentPendingForDataCollection } from '@/lib/interview/flow-guards';

describe('flow-guards', () => {
    describe('getNextMissingCandidateField', () => {
        it('returns the first field still missing', () => {
            const next = getNextMissingCandidateField(
                ['fullName', 'email', 'phone'],
                { fullName: 'Mario Rossi', email: '__SKIPPED__' },
                { fullName: 1, email: 1, phone: 0 },
                3
            );
            expect(next).toBe('phone');
        });

        it('treats empty values as missing and skips exceeded attempts', () => {
            const next = getNextMissingCandidateField(
                ['fullName', 'email', 'phone'],
                { fullName: '   ', email: '', phone: null },
                { fullName: 3, email: 2, phone: 3 },
                3
            );
            expect(next).toBe('email');
        });

        it('returns null when all fields are done', () => {
            const next = getNextMissingCandidateField(
                ['fullName', 'email'],
                { fullName: 'Jane Doe', email: '__SKIPPED__' },
                { fullName: 0, email: 0 },
                3
            );
            expect(next).toBeNull();
        });
    });

    describe('isConsentPendingForDataCollection', () => {
        it('is pending when collection is enabled and consent is not yet granted', () => {
            const pending = isConsentPendingForDataCollection({
                shouldCollectData: true,
                candidateFieldIds: ['email'],
                consentGiven: false,
                dataCollectionRefused: false
            });
            expect(pending).toBe(true);
        });

        it('is not pending when consent is already granted', () => {
            const pending = isConsentPendingForDataCollection({
                shouldCollectData: true,
                candidateFieldIds: ['email'],
                consentGiven: true,
                dataCollectionRefused: false
            });
            expect(pending).toBe(false);
        });

        it('is not pending when data collection is refused or no fields are configured', () => {
            expect(isConsentPendingForDataCollection({
                shouldCollectData: true,
                candidateFieldIds: ['email'],
                consentGiven: false,
                dataCollectionRefused: true
            })).toBe(false);

            expect(isConsentPendingForDataCollection({
                shouldCollectData: true,
                candidateFieldIds: [],
                consentGiven: false,
                dataCollectionRefused: false
            })).toBe(false);
        });
    });

    describe('getFieldLabel', () => {
        it('returns localized labels and falls back to the raw field id', () => {
            expect(getFieldLabel('email', 'it')).toBe('il tuo indirizzo email');
            expect(getFieldLabel('unknownField', 'it')).toBe('unknownField');
        });
    });
});
