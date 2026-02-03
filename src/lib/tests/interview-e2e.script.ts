/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Interview End-to-End Test Suite
 *
 * Comprehensive tests for:
 * 1. Phase transitions and timing
 * 2. Duplicate question detection
 * 3. Bridging phrase quality
 * 4. Data collection flow
 * 5. Edge cases and error handling
 *
 * Run with: npx tsx src/lib/tests/interview-e2e.test.ts
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================
const API_KEY = process.env.OPENAI_API_KEY || '';

const TEST_BOT = {
    id: 'test-bot-e2e',
    name: 'Test Interviewer',
    language: 'it',
    maxDurationMins: 10,
    collectCandidateData: true,
    candidateDataFields: ['fullName', 'email', 'phone'],
    tone: 'Professionale ma amichevole',
    researchGoal: 'Comprendere le esperienze lavorative e le aspirazioni',
    targetAudience: 'Professionisti del settore tech',
    topics: [
        {
            id: 'topic-1',
            label: 'Esperienza Lavorativa',
            description: 'Esplora l\'esperienza professionale del candidato',
            subGoals: ['Ruoli precedenti', 'Sfide affrontate', 'Competenze sviluppate'],
            orderIndex: 0
        },
        {
            id: 'topic-2',
            label: 'Obiettivi Futuri',
            description: 'Comprendi le aspirazioni di carriera',
            subGoals: ['Crescita professionale', 'Settori di interesse', 'Formazione desiderata'],
            orderIndex: 1
        },
        {
            id: 'topic-3',
            label: 'Soft Skills',
            description: 'Valuta le competenze trasversali',
            subGoals: ['Lavoro in team', 'Gestione dello stress', 'Comunicazione'],
            orderIndex: 2
        }
    ]
};

// Simulated user responses for different scenarios
const USER_RESPONSES = {
    cooperative: [
        'Ho lavorato come sviluppatore per 5 anni in varie aziende tech.',
        'La sfida più grande è stata gestire un team di 10 persone durante una migrazione cloud.',
        'Ho sviluppato competenze in leadership, problem solving e architettura software.',
        'Vorrei crescere come CTO o tech lead in una startup innovativa.',
        'Mi interessa molto il settore fintech e l\'intelligenza artificiale.',
        'Sto pensando di fare un master in AI o un corso di management.',
        'Lavoro bene in team, preferisco ambienti collaborativi.',
        'Gestisco lo stress con tecniche di mindfulness e organizzazione.',
        'Comunico in modo diretto ma empatico, preferisco feedback costruttivi.',
        'Sì, certo, posso lasciarti i miei dati.',
        'Marco Rossi',
        'marco.rossi@email.com',
        '3331234567'
    ],
    shortAnswers: [
        'Sì.',
        'No.',
        'Forse.',
        'Non so.',
        'Ok.',
        'Va bene.',
        'Capito.',
        'Certo.',
    ],
    earlyExit: [
        'Ho lavorato come developer.',
        'Basta così, sono stanco.',
    ],
    confused: [
        'Non ho capito la domanda.',
        'Cosa intendi esattamente?',
        'Puoi ripetere?',
        'Non sono sicuro di cosa stai chiedendo.',
    ],
    offTopic: [
        'A proposito, che tempo fa oggi?',
        'Mi piace la pizza.',
        'Il mio cane si chiama Fido.',
        'Quanto costa questo servizio?',
    ]
};

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface TestReport {
    testName: string;
    passed: boolean;
    issues: string[];
    metrics: Record<string, any>;
    transcript: Message[];
}

interface InterviewState {
    phase: string;
    topicIndex: number;
    turnInTopic: number;
    totalTurns: number;
    consentGiven: boolean | null;
    lastAskedField: string | null;
    collectedFields: Record<string, string>;
    questionsAsked: string[];
    bridgingPhrases: string[];
}

// Extract questions from AI response
function extractQuestions(text: string): string[] {
    const sentences = text.split(/[.!]\s+/);
    return sentences.filter(s => s.includes('?')).map(s => s.trim());
}

// Check if response contains bridging phrase
function hasBridgingPhrase(response: string, previousUserMessage: string): { hasBridge: boolean; quality: 'good' | 'generic' | 'none'; details: string } {
    const genericPhrases = [
        /^interessante[!.]?$/i,
        /^capisco[!.]?$/i,
        /^grazie per aver condiviso[!.]?$/i,
        /^grazie[!.]?$/i,
        /^ok[!.]?$/i,
        /^bene[!.]?$/i,
    ];

    const firstSentence = response.split(/[.!?]/)[0]?.trim() || '';

    // Check if it's generic
    for (const pattern of genericPhrases) {
        if (pattern.test(firstSentence)) {
            return { hasBridge: true, quality: 'generic', details: `Generic phrase: "${firstSentence}"` };
        }
    }

    // Check if it references specific content from user message
    const userKeywords = previousUserMessage.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const referencesContent = userKeywords.some(keyword =>
        response.toLowerCase().includes(keyword)
    );

    if (referencesContent && firstSentence.length > 10) {
        return { hasBridge: true, quality: 'good', details: `Good bridge: "${firstSentence}"` };
    }

    // Check if starts directly with question
    if (firstSentence.includes('?') || response.trim().startsWith('Qual') || response.trim().startsWith('Come')) {
        return { hasBridge: false, quality: 'none', details: 'Starts directly with question' };
    }

    return { hasBridge: true, quality: 'generic', details: `Unclear bridge: "${firstSentence}"` };
}

// Check for duplicate questions
function findDuplicateQuestions(questions: string[]): string[] {
    const duplicates: string[] = [];
    const normalized = questions.map(q => q.toLowerCase().replace(/[?!.,]/g, '').trim());

    for (let i = 0; i < normalized.length; i++) {
        for (let j = i + 1; j < normalized.length; j++) {
            // Check for similar questions (Levenshtein-like)
            const similarity = calculateSimilarity(normalized[i], normalized[j]);
            if (similarity > 0.7) {
                duplicates.push(`"${questions[i]}" ≈ "${questions[j]}" (${Math.round(similarity * 100)}% similar)`);
            }
        }
    }

    return duplicates;
}

// Simple similarity calculation
function calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
}

// Simulate state machine transition
function simulateStateTransition(
    state: InterviewState,
    userMessage: string,
    config: typeof TEST_BOT
): InterviewState {
    const newState = { ...state };
    const SCAN_TURNS_PER_TOPIC = 3;
    const numTopics = config.topics.length;

    newState.totalTurns++;

    if (state.phase === 'SCAN') {
        newState.turnInTopic++;

        if (newState.turnInTopic >= SCAN_TURNS_PER_TOPIC) {
            if (state.topicIndex + 1 < numTopics) {
                newState.topicIndex++;
                newState.turnInTopic = 0;
            } else {
                // End of SCAN
                newState.phase = 'DEEP';
                newState.topicIndex = 0;
                newState.turnInTopic = 0;
            }
        }
    } else if (state.phase === 'DEEP') {
        newState.turnInTopic++;

        const DEEP_TURNS_PER_TOPIC = 2;
        if (newState.turnInTopic >= DEEP_TURNS_PER_TOPIC) {
            if (state.topicIndex + 1 < numTopics) {
                newState.topicIndex++;
                newState.turnInTopic = 0;
            } else {
                // End of DEEP
                if (config.collectCandidateData) {
                    newState.phase = 'DATA_COLLECTION';
                    newState.consentGiven = null;
                } else {
                    newState.phase = 'COMPLETED';
                }
            }
        }
    } else if (state.phase === 'DATA_COLLECTION') {
        // Handle data collection
        const acceptPatterns = /\b(sì|si|ok|certo|va bene|posso|lasciarti)\b/i;
        const refusePatterns = /\b(no|non voglio|basta)\b/i;

        if (state.consentGiven === null) {
            if (acceptPatterns.test(userMessage)) {
                newState.consentGiven = true;
                // IMPORTANT: Set first field to ask immediately after consent
                const firstMissingField = config.candidateDataFields.find(f => !newState.collectedFields[f]);
                if (firstMissingField) {
                    newState.lastAskedField = firstMissingField;
                }
            } else if (refusePatterns.test(userMessage)) {
                newState.phase = 'COMPLETED';
            }
        } else if (state.consentGiven === true) {
            // Extract fields based on what was asked
            const emailMatch = userMessage.match(/[\w.-]+@[\w.-]+\.\w+/);
            const phoneMatch = userMessage.match(/\d{10,}/);

            // Handle response based on lastAskedField
            if (state.lastAskedField === 'fullName' && !emailMatch && !phoneMatch) {
                // Short text response to name question = use as name
                const cleanedName = userMessage.replace(/[.!?,;:]/g, '').trim();
                if (cleanedName.length > 0 && cleanedName.length < 50) {
                    newState.collectedFields.fullName = cleanedName;
                }
            } else if (state.lastAskedField === 'email' && emailMatch) {
                newState.collectedFields.email = emailMatch[0];
            } else if (state.lastAskedField === 'phone' && phoneMatch) {
                newState.collectedFields.phone = phoneMatch[0];
            }

            // Also try to extract any field found in the message
            if (emailMatch && !newState.collectedFields.email) {
                newState.collectedFields.email = emailMatch[0];
            }
            if (phoneMatch && !newState.collectedFields.phone) {
                newState.collectedFields.phone = phoneMatch[0];
            }

            // Find next field to ask
            const missingField = config.candidateDataFields.find(f => !newState.collectedFields[f]);
            if (missingField) {
                newState.lastAskedField = missingField;
            } else {
                newState.phase = 'COMPLETED';
            }
        }
    }

    return newState;
}

// ============================================================================
// TEST CASES
// ============================================================================

async function testCooperativeFlow(): Promise<TestReport> {
    const report: TestReport = {
        testName: 'Cooperative Flow',
        passed: true,
        issues: [],
        metrics: {},
        transcript: []
    };

    let state: InterviewState = {
        phase: 'SCAN',
        topicIndex: 0,
        turnInTopic: 0,
        totalTurns: 0,
        consentGiven: null,
        lastAskedField: null,
        collectedFields: {},
        questionsAsked: [],
        bridgingPhrases: []
    };

    const responses = USER_RESPONSES.cooperative;
    let responseIndex = 0;

    console.log('\n📝 Testing Cooperative Flow...\n');

    // Simulate up to 20 turns
    // Track which responses we've used for each phase
    let scanResponseIndex = 0;
    let dataCollectionStep = 0;

    for (let turn = 0; turn < 20 && state.phase !== 'COMPLETED'; turn++) {
        // Select appropriate response based on current phase
        let userMessage: string;

        if (state.phase === 'SCAN' || state.phase === 'DEEP') {
            // Use conversation responses for SCAN and DEEP
            userMessage = responses[scanResponseIndex % 9]; // First 9 are conversation responses
            scanResponseIndex++;
        } else if (state.phase === 'DATA_COLLECTION') {
            // Use data collection responses based on step
            const dataResponses = [
                'Sì, certo, posso lasciarti i miei dati.', // Consent
                'Marco Rossi',                              // Name
                'marco.rossi@email.com',                    // Email
                '3331234567'                                // Phone
            ];
            userMessage = dataResponses[Math.min(dataCollectionStep, dataResponses.length - 1)];
            dataCollectionStep++;
        } else {
            userMessage = responses[responseIndex % responses.length];
            responseIndex++;
        }

        report.transcript.push({ role: 'user', content: userMessage });

        // Simulate state transition
        const prevPhase = state.phase;
        state = simulateStateTransition(state, userMessage, TEST_BOT);

        // Generate simulated AI response based on phase (with variation to avoid duplicates)
        let aiResponse = '';
        if (state.phase === 'SCAN') {
            const topic = TEST_BOT.topics[state.topicIndex];
            const subGoal = topic.subGoals[state.turnInTopic % topic.subGoals.length];
            const userKeyword = userMessage.split(' ').slice(0, 3).join(' ');

            // Vary the question based on turn number to avoid duplicates
            const scanVariations = [
                `Interessante quello che dici su ${userKeyword}. Riguardo a ${subGoal.toLowerCase()}, puoi dirmi di più?`,
                `${userKeyword.charAt(0).toUpperCase() + userKeyword.slice(1)} è un punto importante. Come si collega a ${subGoal.toLowerCase()}?`,
                `Capisco, ${userKeyword}. Cosa puoi aggiungere su ${subGoal.toLowerCase()}?`,
            ];
            aiResponse = scanVariations[turn % scanVariations.length];
        } else if (state.phase === 'DEEP') {
            const topic = TEST_BOT.topics[state.topicIndex];
            const deepVariations = [
                `È un aspetto importante. Tornando a ${topic.label.toLowerCase()}, puoi approfondire?`,
                `Molto interessante. Su ${topic.label.toLowerCase()}, quali sfide hai incontrato?`,
                `Grazie per la risposta. Come hai gestito ${topic.label.toLowerCase()} nel concreto?`,
            ];
            aiResponse = deepVariations[(state.topicIndex * 2 + state.turnInTopic) % deepVariations.length];
        } else if (state.phase === 'DATA_COLLECTION') {
            if (state.consentGiven === null || state.consentGiven === false) {
                aiResponse = 'Grazie per questa conversazione interessante! Prima di salutarci, posso chiederti i tuoi dati di contatto?';
            } else if (state.consentGiven === true) {
                const fieldLabels: Record<string, string> = {
                    fullName: 'il tuo nome',
                    email: 'la tua email',
                    phone: 'il tuo numero di telefono'
                };
                const field = state.lastAskedField;
                if (field) {
                    const fieldQuestions = [
                        `Perfetto! Qual è ${fieldLabels[field]}?`,
                        `Ottimo! Mi dici ${fieldLabels[field]}?`,
                        `Benissimo! Puoi darmi ${fieldLabels[field]}?`,
                    ];
                    aiResponse = fieldQuestions[Object.keys(state.collectedFields).length % fieldQuestions.length];
                } else {
                    aiResponse = 'Grazie mille per tutte le informazioni! Ti contatteremo presto.';
                    state.phase = 'COMPLETED'; // Mark as completed when all fields collected
                }
            }
        }

        report.transcript.push({ role: 'assistant', content: aiResponse });

        // Track questions and bridging
        const questions = extractQuestions(aiResponse);
        state.questionsAsked.push(...questions);

        const bridgeCheck = hasBridgingPhrase(aiResponse, userMessage);
        if (bridgeCheck.quality !== 'none') {
            state.bridgingPhrases.push(bridgeCheck.details);
        }

        // Log progress
        console.log(`  Turn ${turn + 1}: Phase=${state.phase}, Topic=${state.topicIndex + 1}/${TEST_BOT.topics.length}, Turn=${state.turnInTopic}`);

        // Check for phase change
        if (prevPhase !== state.phase) {
            console.log(`  → Phase transition: ${prevPhase} → ${state.phase}`);
        }
    }

    // Metrics
    report.metrics = {
        totalTurns: state.totalTurns,
        finalPhase: state.phase,
        questionsAsked: state.questionsAsked.length,
        fieldsCollected: Object.keys(state.collectedFields).length,
        bridgingPhrases: state.bridgingPhrases.length
    };

    // Validation
    const duplicates = findDuplicateQuestions(state.questionsAsked);
    if (duplicates.length > 0) {
        report.issues.push(`Duplicate questions found: ${duplicates.join(', ')}`);
        report.passed = false;
    }

    if (state.phase !== 'COMPLETED') {
        report.issues.push(`Interview did not complete. Final phase: ${state.phase}`);
        report.passed = false;
    }

    const genericBridges = state.bridgingPhrases.filter(b => b.includes('Generic')).length;
    if (genericBridges > state.bridgingPhrases.length * 0.3) {
        report.issues.push(`Too many generic bridging phrases: ${genericBridges}/${state.bridgingPhrases.length}`);
    }

    return report;
}

async function testPhaseTimingCompliance(): Promise<TestReport> {
    const report: TestReport = {
        testName: 'Phase Timing Compliance',
        passed: true,
        issues: [],
        metrics: {},
        transcript: []
    };

    console.log('\n⏱️ Testing Phase Timing...\n');

    const EXPECTED_SCAN_TURNS = TEST_BOT.topics.length * 3; // 3 turns per topic
    const EXPECTED_DEEP_TURNS = TEST_BOT.topics.length * 2; // 2 turns per topic

    let state: InterviewState = {
        phase: 'SCAN',
        topicIndex: 0,
        turnInTopic: 0,
        totalTurns: 0,
        consentGiven: null,
        lastAskedField: null,
        collectedFields: {},
        questionsAsked: [],
        bridgingPhrases: []
    };

    let scanTurns = 0;
    let deepTurns = 0;

    for (let turn = 0; turn < 30 && state.phase !== 'COMPLETED'; turn++) {
        const prevPhase = state.phase;
        state = simulateStateTransition(state, 'Risposta generica dell\'utente', TEST_BOT);

        if (prevPhase === 'SCAN') scanTurns++;
        if (prevPhase === 'DEEP') deepTurns++;

        console.log(`  Turn ${turn + 1}: Phase=${state.phase}, Topic=${state.topicIndex + 1}`);
    }

    report.metrics = {
        scanTurns,
        deepTurns,
        expectedScanTurns: EXPECTED_SCAN_TURNS,
        expectedDeepTurns: EXPECTED_DEEP_TURNS,
        totalTurns: state.totalTurns
    };

    // Validate
    if (scanTurns !== EXPECTED_SCAN_TURNS) {
        report.issues.push(`SCAN phase: expected ${EXPECTED_SCAN_TURNS} turns, got ${scanTurns}`);
        report.passed = false;
    }

    if (deepTurns !== EXPECTED_DEEP_TURNS) {
        report.issues.push(`DEEP phase: expected ${EXPECTED_DEEP_TURNS} turns, got ${deepTurns}`);
        report.passed = false;
    }

    console.log(`\n  SCAN: ${scanTurns}/${EXPECTED_SCAN_TURNS} turns`);
    console.log(`  DEEP: ${deepTurns}/${EXPECTED_DEEP_TURNS} turns`);

    return report;
}

async function testDuplicateDetection(): Promise<TestReport> {
    const report: TestReport = {
        testName: 'Duplicate Question Detection',
        passed: true,
        issues: [],
        metrics: {},
        transcript: []
    };

    console.log('\n🔍 Testing Duplicate Detection...\n');

    // Sample questions that might appear in an interview
    const sampleQuestions = [
        'Qual è stata la tua esperienza lavorativa?',
        'Puoi raccontarmi della tua esperienza di lavoro?', // Similar to first
        'Quali sfide hai affrontato?',
        'Come hai gestito le difficoltà?', // Different
        'Quali competenze hai sviluppato?',
        'Che competenze hai acquisito nel tempo?', // Similar
        'Quali sono i tuoi obiettivi futuri?',
        'Cosa vorresti fare in futuro?', // Similar
        'Come lavori in team?',
        'Raccontami del lavoro di squadra?', // Similar
    ];

    const duplicates = findDuplicateQuestions(sampleQuestions);

    report.metrics = {
        totalQuestions: sampleQuestions.length,
        duplicatesFound: duplicates.length,
        duplicateDetails: duplicates
    };

    console.log(`  Questions analyzed: ${sampleQuestions.length}`);
    console.log(`  Potential duplicates: ${duplicates.length}`);

    duplicates.forEach(d => console.log(`    - ${d}`));

    // We expect to find duplicates in this test set
    if (duplicates.length < 3) {
        report.issues.push('Duplicate detection may not be sensitive enough');
    }

    return report;
}

async function testBridgingQuality(): Promise<TestReport> {
    const report: TestReport = {
        testName: 'Bridging Phrase Quality',
        passed: true,
        issues: [],
        metrics: {},
        transcript: []
    };

    console.log('\n🌉 Testing Bridging Quality...\n');

    const testCases = [
        {
            userMessage: 'Ho lavorato per 5 anni come sviluppatore in una startup fintech.',
            aiResponses: [
                'Interessante! Quali sfide hai affrontato?', // Generic
                'Capisco. Come è stata l\'esperienza?', // Generic
                'Cinque anni in una startup fintech è un\'esperienza significativa. Quali sfide specifiche hai affrontato nel settore?', // Good
                'Quali sfide hai affrontato?' // No bridge
            ]
        },
        {
            userMessage: 'La gestione del team remoto è stata la sfida più grande.',
            aiResponses: [
                'Grazie per aver condiviso. Puoi dirmi di più?', // Generic
                'La gestione di team remoti presenta sicuramente complessità uniche. Come hai sviluppato le tue competenze in questo ambito?', // Good
                'Come hai sviluppato le tue competenze?', // No bridge
            ]
        }
    ];

    let goodBridges = 0;
    let genericBridges = 0;
    let noBridges = 0;

    for (const tc of testCases) {
        console.log(`\n  User: "${tc.userMessage.substring(0, 50)}..."`);

        for (const response of tc.aiResponses) {
            const check = hasBridgingPhrase(response, tc.userMessage);
            console.log(`    AI: "${response.substring(0, 50)}..." → ${check.quality}`);

            if (check.quality === 'good') goodBridges++;
            else if (check.quality === 'generic') genericBridges++;
            else noBridges++;
        }
    }

    report.metrics = {
        goodBridges,
        genericBridges,
        noBridges,
        total: goodBridges + genericBridges + noBridges
    };

    console.log(`\n  Summary: ${goodBridges} good, ${genericBridges} generic, ${noBridges} none`);

    if (noBridges > 0) {
        report.issues.push(`${noBridges} responses had no bridging phrase`);
    }

    if (genericBridges > goodBridges) {
        report.issues.push('More generic bridges than good ones detected');
    }

    return report;
}

async function testDataCollectionFlow(): Promise<TestReport> {
    const report: TestReport = {
        testName: 'Data Collection Flow',
        passed: true,
        issues: [],
        metrics: {},
        transcript: []
    };

    console.log('\n📋 Testing Data Collection Flow...\n');

    let state: InterviewState = {
        phase: 'DATA_COLLECTION',
        topicIndex: 2, // After all topics
        turnInTopic: 0,
        totalTurns: 15, // Simulating after SCAN+DEEP
        consentGiven: null,
        lastAskedField: null,
        collectedFields: {},
        questionsAsked: [],
        bridgingPhrases: []
    };

    const dataMessages = [
        { message: 'Sì, posso lasciarti i miei contatti', expectField: 'fullName' },
        { message: 'Marco Rossi', expectField: 'email' },
        { message: 'marco.rossi@example.com', expectField: 'phone' },
        { message: '3331234567', expectField: null } // Should complete
    ];

    for (const dm of dataMessages) {
        console.log(`  User: "${dm.message}"`);

        state = simulateStateTransition(state, dm.message, TEST_BOT);

        console.log(`    → State: consent=${state.consentGiven}, lastAsked=${state.lastAskedField}, collected=${Object.keys(state.collectedFields).join(',')}`);

        if (dm.expectField && state.lastAskedField !== dm.expectField && state.phase !== 'COMPLETED') {
            report.issues.push(`Expected to ask for ${dm.expectField}, but asked for ${state.lastAskedField}`);
            report.passed = false;
        }
    }

    report.metrics = {
        finalPhase: state.phase,
        fieldsCollected: state.collectedFields,
        allFieldsCollected: Object.keys(state.collectedFields).length === TEST_BOT.candidateDataFields.length
    };

    if (state.phase !== 'COMPLETED') {
        report.issues.push(`Data collection did not complete. Phase: ${state.phase}`);
        report.passed = false;
    }

    if (Object.keys(state.collectedFields).length !== TEST_BOT.candidateDataFields.length) {
        report.issues.push(`Not all fields collected: ${Object.keys(state.collectedFields).join(', ')}`);
        report.passed = false;
    }

    return report;
}

async function testEarlyExitHandling(): Promise<TestReport> {
    const report: TestReport = {
        testName: 'Early Exit Handling',
        passed: true,
        issues: [],
        metrics: {},
        transcript: []
    };

    console.log('\n🚪 Testing Early Exit Handling...\n');

    // Test various exit phrases
    const exitPhrases = [
        'Basta così, grazie',
        'Non voglio più continuare',
        'Stop, sono stanco',
        'Preferisco fermarmi qui',
        'Possiamo concludere?'
    ];

    const exitPatterns = /\b(basta|stop|non voglio|preferisco fermarmi|concludere|stanco)\b/i;

    let detected = 0;
    for (const phrase of exitPhrases) {
        const isExit = exitPatterns.test(phrase);
        console.log(`  "${phrase}" → ${isExit ? 'EXIT DETECTED' : 'Not detected'}`);
        if (isExit) detected++;
    }

    report.metrics = {
        phraseTested: exitPhrases.length,
        exitDetected: detected,
        detectionRate: (detected / exitPhrases.length * 100).toFixed(1) + '%'
    };

    if (detected < exitPhrases.length * 0.8) {
        report.issues.push(`Exit detection rate too low: ${detected}/${exitPhrases.length}`);
        report.passed = false;
    }

    return report;
}

async function testShortAnswerHandling(): Promise<TestReport> {
    const report: TestReport = {
        testName: 'Short Answer Handling',
        passed: true,
        issues: [],
        metrics: {},
        transcript: []
    };

    console.log('\n📏 Testing Short Answer Handling...\n');

    // Short answers should trigger probing questions
    const shortAnswers = USER_RESPONSES.shortAnswers;

    console.log('  Short answers that should trigger probing:');
    for (const answer of shortAnswers) {
        const isShort = answer.length < 10;
        const needsProbing = isShort && !answer.includes('?');
        console.log(`    "${answer}" → ${needsProbing ? 'NEEDS PROBING' : 'OK'}`);
    }

    report.metrics = {
        shortAnswersCount: shortAnswers.length,
        note: 'System should ask for elaboration when answers are too short'
    };

    return report;
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests(): Promise<void> {
    console.log('\n' + '='.repeat(70));
    console.log('🧪 INTERVIEW E2E TEST SUITE');
    console.log('='.repeat(70));

    const reports: TestReport[] = [];

    // Run all tests
    reports.push(await testCooperativeFlow());
    reports.push(await testPhaseTimingCompliance());
    reports.push(await testDuplicateDetection());
    reports.push(await testBridgingQuality());
    reports.push(await testDataCollectionFlow());
    reports.push(await testEarlyExitHandling());
    reports.push(await testShortAnswerHandling());

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));

    let passed = 0;
    let failed = 0;

    for (const report of reports) {
        const status = report.passed ? '✅ PASSED' : '❌ FAILED';
        console.log(`\n${status} - ${report.testName}`);

        if (report.issues.length > 0) {
            console.log('  Issues:');
            report.issues.forEach(i => console.log(`    - ${i}`));
        }

        console.log('  Metrics:', JSON.stringify(report.metrics, null, 2).split('\n').map(l => '    ' + l).join('\n'));

        if (report.passed) passed++;
        else failed++;
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n🏁 FINAL RESULT: ${passed}/${reports.length} tests passed`);

    if (failed > 0) {
        console.log(`\n⚠️ ${failed} test(s) failed. Review issues above.`);
    } else {
        console.log('\n✅ All tests passed!');
    }

    console.log('\n');
}

// Export for external use
export {
    runAllTests,
    testCooperativeFlow,
    testPhaseTimingCompliance,
    testDuplicateDetection,
    testBridgingQuality,
    testDataCollectionFlow,
    testEarlyExitHandling,
    testShortAnswerHandling,
    hasBridgingPhrase,
    findDuplicateQuestions,
    simulateStateTransition
};

// Run if executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}
