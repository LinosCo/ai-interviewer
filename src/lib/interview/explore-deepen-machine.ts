/**
 * EXPLORE + DEEPEN Phase Machine (v2)
 * Replaces SCAN + DEEP with signal-driven elastic turns
 */

import type { TopicBlock } from '@prisma/client';
import type { InterviewState } from '@/app/api/chat/route';
import type { SupervisorInsight } from './interview-supervisor';
import type { InterviewPlan } from './plan-types';
import { computeSignalScore, computeBudgetAction, stealBonusTurn } from './signal-score';

export interface ExploreDeepResult {
    nextState: Partial<InterviewState>;
    supervisorInsight: SupervisorInsight;
    nextTopicId?: string;
}

/**
 * EXPLORE phase: Elastic turn allocation driven by signal scores
 */
export function handleExplorePhase({
    state,
    currentTopic,
    botTopics,
    lastUserMessage,
    language,
    interviewPlan,
    maxDurationMins,
    effectiveSec
}: {
    state: InterviewState;
    currentTopic: TopicBlock;
    botTopics: TopicBlock[];
    lastUserMessage: string;
    language: string;
    interviewPlan: InterviewPlan;
    maxDurationMins: number;
    effectiveSec: number;
}): ExploreDeepResult {
    const nextState: Partial<InterviewState> = { ...state };
    let supervisorInsight: SupervisorInsight = { status: 'EXPLORING' };
    let nextTopicId: string | undefined;

    // Get topic budget
    const topicBudget = state.topicBudgets[currentTopic.id];
    if (!topicBudget) {
        // Initialize budget for this topic from plan
        const planTopic = (interviewPlan.explore?.topics || []).find(t => t.topicId === currentTopic.id);
        if (planTopic) {
            nextState.topicBudgets = {
                ...state.topicBudgets,
                [currentTopic.id]: {
                    baseTurns: planTopic.baseTurns,
                    minTurns: planTopic.minTurns,
                    maxTurns: planTopic.maxTurns,
                    turnsUsed: 0,
                    bonusTurnsGranted: 0
                }
            };
        }
        return { nextState, supervisorInsight };
    }

    // Compute signal score from user message
    const signal = computeSignalScore(lastUserMessage, language);
    nextState.lastSignalScore = signal.score;
    nextState.topicEngagementScores = {
        ...state.topicEngagementScores,
        [currentTopic.id]: Math.max(
            state.topicEngagementScores[currentTopic.id] || 0,
            signal.score
        )
    };

    // Store key insight if signal is high
    if (signal.score >= 0.5 && signal.snippet) {
        nextState.topicKeyInsights = {
            ...state.topicKeyInsights,
            [currentTopic.id]: signal.snippet
        };
    }

    // Determine budget action
    let action = computeBudgetAction(signal.band, topicBudget.turnsUsed, topicBudget);

    console.log(`📊 [EXPLORE] "${currentTopic.label}" signal=${signal.band} action=${action} turns=${topicBudget.turnsUsed}/${topicBudget.baseTurns}`);

    if (action === 'continue') {
        // Stay on this topic, increment turn
        topicBudget.turnsUsed++;
        nextState.topicBudgets = {
            ...state.topicBudgets,
            [currentTopic.id]: topicBudget
        };
        nextState.turnsUsedTotal = (state.turnsUsedTotal || 0) + 1;
        supervisorInsight = { status: 'EXPLORING' };
        console.log(`  → Continue on "${currentTopic.label}"`);

    } else if (action === 'bonus') {
        // Attempt to steal bonus turn from unexplored topic
        const donorId = stealBonusTurn(currentTopic.id, state.topicBudgets);
        if (donorId) {
            topicBudget.turnsUsed++;
            topicBudget.bonusTurnsGranted++;
            nextState.topicBudgets = {
                ...state.topicBudgets,
                [currentTopic.id]: topicBudget,
                [donorId]: {
                    ...state.topicBudgets[donorId],
                    maxTurns: Math.max(1, state.topicBudgets[donorId].maxTurns - 1)
                }
            };
            nextState.turnsUsedTotal = (state.turnsUsedTotal || 0) + 1;
            supervisorInsight = { status: 'EXPLORING_DEEP' };
            console.log(`  → Bonus turn granted (stole from ${donorId})`);
        } else {
            // No donor available, treat as advance
            action = 'advance' as any;
        }
    }

    if (action === 'advance') {
        // Move to next topic or end EXPLORE
        if (state.topicIndex + 1 < botTopics.length) {
            nextState.topicIndex = state.topicIndex + 1;
            nextState.turnInTopic = 0;
            nextTopicId = botTopics[nextState.topicIndex].id;
            supervisorInsight = { status: 'TRANSITION' };
            console.log(`  → Transition to "${botTopics[nextState.topicIndex].label}"`);

        } else {
            // End of EXPLORE: decide on DEEPEN vs DEEP_OFFER
            const maxDurationSec = maxDurationMins * 60;
            const remainingSec = maxDurationSec - effectiveSec;

            // Calculate uncovered topics for DEEPEN - ensure ALL topics have budgets initialized
            const updatedBudgets = { ...state.topicBudgets };

            // Initialize budgets for any topics that don't have them yet
            for (const topic of botTopics) {
                if (!updatedBudgets[topic.id]) {
                    const planTopic = (interviewPlan.explore?.topics || []).find(t => t.topicId === topic.id);
                    if (planTopic) {
                        updatedBudgets[topic.id] = {
                            baseTurns: planTopic.baseTurns,
                            minTurns: planTopic.minTurns,
                            maxTurns: planTopic.maxTurns,
                            turnsUsed: 0,
                            bonusTurnsGranted: 0
                        };
                    }
                }
            }

            // Now calculate uncovered topics from the complete budget set
            const uncoveredTopics = botTopics
                .filter(t => {
                    const budget = updatedBudgets[t.id];
                    return budget && budget.turnsUsed < budget.baseTurns;
                })
                .map(t => t.id)
                .sort((a, b) => {
                    const scoreA = state.topicEngagementScores[a] || 0;
                    const scoreB = state.topicEngagementScores[b] || 0;
                    return scoreB - scoreA; // Descending by engagement
                });

            // Update state with the complete budgets
            nextState.topicBudgets = updatedBudgets;

            nextState.uncoveredTopics = uncoveredTopics;
            nextState.phase = remainingSec <= 0 ? 'DEEP_OFFER' : 'DEEPEN';

            // Set deepTopicOrder to reorder topics for DEEPEN phase
            // This ensures topicIndex correctly maps to the intended topic
            if (nextState.phase === 'DEEPEN') {
                nextState.deepTopicOrder = uncoveredTopics;
            }

            console.log(`  → EXPLORE complete. Uncovered: ${uncoveredTopics.length} topic(s). Remaining: ${remainingSec}s`);

            if (nextState.phase === 'DEEP_OFFER') {
                supervisorInsight = { status: 'DEEP_OFFER_ASK' };
                nextState.deepAccepted = false;
            } else {
                supervisorInsight = { status: 'DEEPENING' };
                nextState.topicIndex = 0;
                nextState.turnInTopic = 0;
                if (uncoveredTopics.length > 0) {
                    nextTopicId = uncoveredTopics[0];
                }
            }
        }
    }

    return { nextState, supervisorInsight, nextTopicId };
}

/**
 * DEEPEN phase: Residual exploration of uncovered topics
 */
export function handleDeepenPhase({
    state,
    currentTopic,
    botTopics,
    language,
    maxDurationMins,
    effectiveSec
}: {
    state: InterviewState;
    currentTopic: TopicBlock;
    botTopics: TopicBlock[];
    language: string;
    maxDurationMins: number;
    effectiveSec: number;
}): ExploreDeepResult {
    const nextState: Partial<InterviewState> = { ...state };
    let supervisorInsight: SupervisorInsight = { status: 'DEEPENING' };
    let nextTopicId: string | undefined;

    const uncoveredTopics = state.uncoveredTopics || [];
    if (uncoveredTopics.length === 0) {
        // All topics covered, move to DATA_COLLECTION
        nextState.phase = 'DATA_COLLECTION';
        supervisorInsight = { status: 'DATA_COLLECTION' };
        return { nextState, supervisorInsight };
    }

    const currentUncoveredIndex = uncoveredTopics.indexOf(currentTopic.id);
    const budget = state.topicBudgets[currentTopic.id];
    const maxTurnsForDeepen = Math.min(
        2, // Default max turns per topic in DEEPEN
        Math.max(1, (budget?.maxTurns || 2) - (budget?.turnsUsed || 0))
    );

    if (state.turnInTopic >= maxTurnsForDeepen) {
        // Move to next uncovered topic
        if (currentUncoveredIndex + 1 < uncoveredTopics.length) {
            nextState.topicIndex = currentUncoveredIndex + 1;
            nextState.turnInTopic = 0;
            nextTopicId = uncoveredTopics[currentUncoveredIndex + 1];
            console.log(`➡️ [DEEPEN] Moving to next uncovered: "${botTopics.find(t => t.id === nextTopicId)?.label}"`);
        } else {
            // All uncovered topics deepened
            nextState.phase = 'DATA_COLLECTION';
            supervisorInsight = { status: 'DATA_COLLECTION' };
            console.log(`✅ [DEEPEN] All uncovered topics addressed.`);
            return { nextState, supervisorInsight };
        }
    } else {
        // Continue on current topic
        nextState.turnInTopic = (state.turnInTopic || 0) + 1;
        const insight = state.topicKeyInsights[currentTopic.id];
        supervisorInsight = { status: 'DEEPENING', engagingSnippet: insight };
        console.log(`📊 [DEEPEN] "${currentTopic.label}" turn ${nextState.turnInTopic}/${maxTurnsForDeepen}`);
    }

    // Check time budget
    const maxDurationSec = maxDurationMins * 60;
    const remainingSec = maxDurationSec - effectiveSec;
    if (remainingSec <= 0 && state.deepAccepted !== true) {
        nextState.phase = 'DEEP_OFFER';
        nextState.deepAccepted = false;
        supervisorInsight = { status: 'DEEP_OFFER_ASK' };
        console.log(`🎁 [DEEPEN→DEEP_OFFER] Time limit reached.`);
    }

    return { nextState, supervisorInsight, nextTopicId };
}
