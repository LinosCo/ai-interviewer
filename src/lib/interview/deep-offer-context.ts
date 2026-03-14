import {
    buildExtensionPreviewHints,
    buildExtensionUserSnippets,
    type InterestingTopic,
} from '@/lib/chat/context-helpers';
import type { CILAnalysis } from '@/lib/interview/cil/types';
import {
    createDeepOfferInsight,
    type SupervisorInsight,
} from '@/lib/interview/interview-supervisor';
import type { ValidationResponse } from '@/lib/interview/validation-response';

interface DeepOfferTopicLike {
    id: string;
    label: string;
    subGoals?: string[];
}

interface DeepOfferStateLike {
    topicIndex: number;
    deepTopicOrder?: string[];
    topicSubGoalHistory?: Record<string, string[]>;
    interestingTopics?: InterestingTopic[];
    topicKeyInsights?: Record<string, string>;
}

interface BuildContextualDeepOfferInsightParams {
    state: DeepOfferStateLike;
    botTopics: DeepOfferTopicLike[];
    interviewPlan?: import('@/lib/interview/plan-types').InterviewPlan;
    interviewObjective?: string;
    language: string;
    validationFeedback?: ValidationResponse;
    includeCilThreads?: boolean;
    cilAnalysis?: CILAnalysis | null;
}

function mergeInterestingTopicsWithCilThreads(params: {
    interestingTopics?: InterestingTopic[];
    botTopics: DeepOfferTopicLike[];
    cilAnalysis?: CILAnalysis | null;
    includeCilThreads?: boolean;
}): InterestingTopic[] | undefined {
    const { interestingTopics = [], botTopics, cilAnalysis, includeCilThreads } = params;
    if (!includeCilThreads || !cilAnalysis?.openThreads?.length) {
        return interestingTopics;
    }

    const highThreadTopics: InterestingTopic[] = cilAnalysis.openThreads
        .filter((thread) => thread.strength === 'high')
        .map((thread) => ({
            topicId: thread.sourceTopicId,
            topicLabel: botTopics.find((topic) => topic.id === thread.sourceTopicId)?.label || '',
            engagementScore: 0.9,
            bestSnippet: thread.anchoredHypothesis || thread.description,
        }))
        .filter((topic) => topic.topicId && topic.bestSnippet);

    if (highThreadTopics.length === 0) {
        return interestingTopics;
    }

    const existingTopics = interestingTopics.filter(
        (topic) => !highThreadTopics.some((cilTopic) => cilTopic.topicId === topic.topicId)
    );

    return [...highThreadTopics, ...existingTopics];
}

export function buildContextualDeepOfferInsight(
    params: BuildContextualDeepOfferInsightParams
): SupervisorInsight {
    const {
        state,
        botTopics,
        interviewPlan,
        interviewObjective,
        language,
        validationFeedback,
        includeCilThreads = false,
        cilAnalysis = null,
    } = params;

    const effectiveInterestingTopics = mergeInterestingTopicsWithCilThreads({
        interestingTopics: state.interestingTopics,
        botTopics,
        cilAnalysis,
        includeCilThreads,
    });

    const extensionPreview = buildExtensionPreviewHints({
        botTopics,
        plan: interviewPlan,
        deepOrder: state.deepTopicOrder,
        history: state.topicSubGoalHistory,
        interestingTopics: effectiveInterestingTopics,
        interviewObjective,
        language,
        startIndex: state.topicIndex,
        maxItems: 2,
    });

    const extensionUserSnippets = buildExtensionUserSnippets({
        botTopics,
        interestingTopics: effectiveInterestingTopics,
        topicKeyInsights: state.topicKeyInsights,
        maxItems: 2,
    });

    return createDeepOfferInsight(extensionPreview, validationFeedback, extensionUserSnippets);
}
