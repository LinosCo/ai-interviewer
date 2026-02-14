import { describe, expect, it } from 'vitest';
import { buildInterviewQualityAlerts, summarizeInterviewQualityTurns } from '@/lib/interview/quality-dashboard';

describe('interview quality dashboard aggregation', () => {
    it('aggregates telemetry counters and rates correctly', () => {
        const summary = summarizeInterviewQualityTurns([
            {
                botId: 'bot-1',
                botName: 'Bot 1',
                organizationId: 'org-1',
                organizationName: 'Org 1',
                metadata: {
                    quality: {
                        eligible: true,
                        evaluated: true,
                        score: 96,
                        passed: true,
                        gateTriggered: false,
                        regenerated: false,
                        fallbackUsed: false
                    },
                    flowFlags: {
                        topicClosureIntercepted: false,
                        deepOfferClosureIntercepted: false,
                        completionGuardIntercepted: false,
                        completionBlockedForConsent: false,
                        completionBlockedForMissingField: false
                    }
                }
            },
            {
                botId: 'bot-1',
                botName: 'Bot 1',
                organizationId: 'org-1',
                organizationName: 'Org 1',
                metadata: {
                    quality: {
                        eligible: true,
                        evaluated: true,
                        score: 70,
                        passed: false,
                        gateTriggered: true,
                        regenerated: true,
                        fallbackUsed: false
                    },
                    flowFlags: {
                        topicClosureIntercepted: true,
                        deepOfferClosureIntercepted: false,
                        completionGuardIntercepted: false,
                        completionBlockedForConsent: false,
                        completionBlockedForMissingField: false
                    }
                }
            },
            {
                botId: 'bot-2',
                botName: 'Bot 2',
                organizationId: 'org-2',
                organizationName: 'Org 2',
                metadata: {
                    quality: {
                        eligible: true,
                        evaluated: true,
                        score: 62,
                        passed: false,
                        gateTriggered: true,
                        regenerated: true,
                        fallbackUsed: true
                    },
                    flowFlags: {
                        topicClosureIntercepted: false,
                        deepOfferClosureIntercepted: true,
                        completionGuardIntercepted: true,
                        completionBlockedForConsent: true,
                        completionBlockedForMissingField: false
                    }
                }
            },
            {
                botId: 'bot-2',
                botName: 'Bot 2',
                organizationId: 'org-2',
                organizationName: 'Org 2',
                metadata: {}
            }
        ]);

        expect(summary.assistantTurns).toBe(4);
        expect(summary.telemetryTurns).toBe(3);
        expect(summary.evaluatedTurns).toBe(3);
        expect(summary.passTurns).toBe(1);
        expect(summary.failTurns).toBe(2);
        expect(summary.passRate).toBeCloseTo(1 / 3, 5);
        expect(summary.gateTriggeredTurns).toBe(2);
        expect(summary.gateTriggerRate).toBeCloseTo(2 / 3, 5);
        expect(summary.fallbackTurns).toBe(1);
        expect(summary.fallbackRate).toBeCloseTo(1 / 3, 5);
        expect(summary.topicClosureIntercepts).toBe(1);
        expect(summary.deepOfferClosureIntercepts).toBe(1);
        expect(summary.completionGuardIntercepts).toBe(1);
        expect(summary.completionBlockedForConsent).toBe(1);
        expect(summary.byBot).toHaveLength(2);
    });

    it('builds critical and warning alerts when quality degrades', () => {
        const current = summarizeInterviewQualityTurns([
            {
                botId: 'bot-a',
                botName: 'Bot A',
                organizationId: 'org-a',
                organizationName: 'Org A',
                metadata: {
                    quality: {
                        eligible: true,
                        evaluated: true,
                        score: 60,
                        passed: false,
                        gateTriggered: true,
                        regenerated: true,
                        fallbackUsed: true
                    },
                    flowFlags: {
                        topicClosureIntercepted: false,
                        deepOfferClosureIntercepted: false,
                        completionGuardIntercepted: true,
                        completionBlockedForConsent: false,
                        completionBlockedForMissingField: true
                    }
                }
            },
            {
                botId: 'bot-a',
                botName: 'Bot A',
                organizationId: 'org-a',
                organizationName: 'Org A',
                metadata: {
                    quality: {
                        eligible: true,
                        evaluated: true,
                        score: 62,
                        passed: false,
                        gateTriggered: true,
                        regenerated: true,
                        fallbackUsed: true
                    },
                    flowFlags: {
                        topicClosureIntercepted: false,
                        deepOfferClosureIntercepted: false,
                        completionGuardIntercepted: false,
                        completionBlockedForConsent: false,
                        completionBlockedForMissingField: false
                    }
                }
            },
            {
                botId: 'bot-a',
                botName: 'Bot A',
                organizationId: 'org-a',
                organizationName: 'Org A',
                metadata: {}
            }
        ]);

        const previous = summarizeInterviewQualityTurns([
            {
                botId: 'bot-a',
                botName: 'Bot A',
                organizationId: 'org-a',
                organizationName: 'Org A',
                metadata: {
                    quality: {
                        eligible: true,
                        evaluated: true,
                        score: 98,
                        passed: true,
                        gateTriggered: false,
                        regenerated: false,
                        fallbackUsed: false
                    },
                    flowFlags: {
                        topicClosureIntercepted: false,
                        deepOfferClosureIntercepted: false,
                        completionGuardIntercepted: false,
                        completionBlockedForConsent: false,
                        completionBlockedForMissingField: false
                    }
                }
            },
            {
                botId: 'bot-a',
                botName: 'Bot A',
                organizationId: 'org-a',
                organizationName: 'Org A',
                metadata: {
                    quality: {
                        eligible: true,
                        evaluated: true,
                        score: 95,
                        passed: true,
                        gateTriggered: false,
                        regenerated: false,
                        fallbackUsed: false
                    },
                    flowFlags: {
                        topicClosureIntercepted: false,
                        deepOfferClosureIntercepted: false,
                        completionGuardIntercepted: false,
                        completionBlockedForConsent: false,
                        completionBlockedForMissingField: false
                    }
                }
            }
        ]);

        const alerts = buildInterviewQualityAlerts({
            current,
            previous,
            thresholds: {
                minEvaluatedTurns: 2,
                minAssistantTurnsForCoverage: 1,
                telemetryCoverageWarn: 0.95,
                passRateWarn: 0.8,
                passRateCritical: 0.6,
                gateTriggerWarn: 0.2,
                gateTriggerCritical: 0.4,
                fallbackWarn: 0.1,
                fallbackCritical: 0.2,
                completionGuardWarn: 0.2,
                passRateDropWarn: 0.1
            }
        });

        const alertIds = alerts.map(a => a.id);
        expect(alertIds).toContain('pass-rate-critical');
        expect(alertIds).toContain('gate-trigger-critical');
        expect(alertIds).toContain('fallback-critical');
        expect(alertIds).toContain('pass-rate-drop');
    });
});
