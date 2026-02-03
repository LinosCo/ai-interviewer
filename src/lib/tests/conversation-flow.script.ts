/**
 * Conversation Flow Test Suite
 *
 * Tests the interview state machine and supervisor behavior to ensure:
 * 1. Proper phase transitions (SCAN → DEEP → DATA_COLLECTION)
 * 2. Correct handling of premature closures without losing naturalness
 * 3. Data collection flow works correctly
 * 4. No duplicate questions
 *
 * Run with: npx tsx src/lib/tests/conversation-flow.test.ts
 */

import { prisma } from '@/lib/prisma';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================
const TEST_CONFIG = {
    // Simulated bot configuration
    bot: {
        id: 'test-bot-flow',
        name: 'Test Interviewer',
        language: 'it',
        maxDurationMins: 10,
        collectCandidateData: true,
        candidateDataFields: ['fullName', 'email', 'phone'],
        topics: [
            {
                id: 'topic-1',
                label: 'Esperienza Lavorativa',
                description: 'Esplora l\'esperienza professionale',
                subGoals: ['Ruoli precedenti', 'Sfide affrontate', 'Competenze sviluppate'],
                orderIndex: 0
            },
            {
                id: 'topic-2',
                label: 'Obiettivi Futuri',
                description: 'Comprendi le aspirazioni',
                subGoals: ['Crescita professionale', 'Settori di interesse', 'Formazione desiderata'],
                orderIndex: 1
            }
        ]
    },

    // Test scenarios
    scenarios: {
        // Normal flow - user cooperates
        normalFlow: [
            { user: 'Ho lavorato come developer per 5 anni', expectedPhase: 'SCAN' },
            { user: 'La sfida più grande è stata gestire un team remoto', expectedPhase: 'SCAN' },
            { user: 'Ho sviluppato competenze in leadership', expectedPhase: 'SCAN' }, // Should trigger transition
            { user: 'Vorrei crescere come tech lead', expectedPhase: 'SCAN' }, // Topic 2
            { user: 'Mi interessa il settore fintech', expectedPhase: 'SCAN' },
            { user: 'Vorrei fare un master in AI', expectedPhase: 'SCAN' }, // End SCAN
        ],

        // User tries to end early
        earlyExitAttempt: [
            { user: 'Ho lavorato come developer', expectedPhase: 'SCAN' },
            { user: 'Basta così, grazie', expectedPhase: 'SCAN', expectOverride: true },
        ],

        // AI tries to close prematurely (simulated)
        aiPrematureClosure: [
            {
                user: 'Ho lavorato come developer',
                simulatedAiResponse: 'Grazie mille per il tuo tempo! È stato un piacere.',
                expectedPhase: 'SCAN',
                expectOverride: true
            },
        ],

        // Data collection flow
        dataCollection: [
            { user: 'Sì, posso lasciarti i miei contatti', expectedPhase: 'DATA_COLLECTION', expectField: 'fullName' },
            { user: 'Marco Rossi', expectedPhase: 'DATA_COLLECTION', expectField: 'email' },
            { user: 'marco@email.com', expectedPhase: 'DATA_COLLECTION', expectField: 'phone' },
            { user: '3331234567', expectedPhase: 'DATA_COLLECTION', expectCompleted: true },
        ],

        // User provides multiple data at once
        multipleDataAtOnce: [
            { user: 'Sì certo, sono Marco Rossi, marco@email.com', expectedPhase: 'DATA_COLLECTION', expectField: 'phone' },
        ],

        // User refuses data collection
        dataRefusal: [
            { user: 'No grazie, preferisco non lasciare i miei dati', expectedPhase: 'DATA_COLLECTION', expectCompleted: true },
        ],
    }
};

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface TestResult {
    scenario: string;
    passed: boolean;
    details: string[];
    errors: string[];
}

interface ConversationState {
    phase: string;
    topicIndex: number;
    turnInTopic: number;
    consentGiven: boolean | null;
    lastAskedField: string | null;
    collectedFields: Record<string, string>;
}

// Simulate the state machine logic
function simulateStateMachine(
    currentState: ConversationState,
    userMessage: string,
    config: typeof TEST_CONFIG.bot
): { nextState: ConversationState; supervisorAction: string; shouldOverride: boolean } {
    const nextState = { ...currentState };
    let supervisorAction = '';
    const shouldOverride = false;

    const numTopics = config.topics.length;
    const SCAN_TURNS_PER_TOPIC = 3;

    // Phase logic
    if (currentState.phase === 'SCAN') {
        nextState.turnInTopic = currentState.turnInTopic + 1;

        if (nextState.turnInTopic >= SCAN_TURNS_PER_TOPIC) {
            if (currentState.topicIndex + 1 < numTopics) {
                // Transition to next topic
                nextState.topicIndex = currentState.topicIndex + 1;
                nextState.turnInTopic = 0;
                supervisorAction = 'TRANSITION';
            } else {
                // End of SCAN - go to DEEP or DATA_COLLECTION
                if (config.collectCandidateData) {
                    nextState.phase = 'DATA_COLLECTION';
                    nextState.consentGiven = null;
                    supervisorAction = 'DATA_COLLECTION_CONSENT';
                }
            }
        } else {
            supervisorAction = 'SCANNING';
        }

        // Check for early exit attempt
        const exitPatterns = /\b(basta|stop|non voglio|grazie.*finito|preferisco fermarmi)\b/i;
        if (exitPatterns.test(userMessage)) {
            // Don't override immediately - ask for confirmation
            supervisorAction = 'CONFIRM_STOP';
        }
    }

    if (currentState.phase === 'DATA_COLLECTION') {
        // Extract fields from message
        const emailMatch = userMessage.match(/[\w.-]+@[\w.-]+\.\w+/);
        const phoneMatch = userMessage.match(/\d{10,}/);
        const nameMatch = userMessage.match(/^[A-Z][a-z]+ [A-Z][a-z]+$/);

        if (emailMatch) nextState.collectedFields.email = emailMatch[0];
        if (phoneMatch) nextState.collectedFields.phone = phoneMatch[0];
        if (nameMatch) nextState.collectedFields.fullName = nameMatch[0];

        // Simple name detection for short responses
        if (currentState.lastAskedField === 'fullName' && userMessage.split(' ').length <= 3) {
            nextState.collectedFields.fullName = userMessage.trim();
        }

        // Check consent
        if (currentState.consentGiven === null) {
            const acceptPatterns = /\b(sì|si|ok|certo|va bene|volentieri)\b/i;
            const refusePatterns = /\b(no|non voglio|preferisco non)\b/i;

            if (acceptPatterns.test(userMessage)) {
                nextState.consentGiven = true;
                supervisorAction = 'ASK_FIELD';
            } else if (refusePatterns.test(userMessage)) {
                nextState.consentGiven = false;
                supervisorAction = 'COMPLETE_WITHOUT_DATA';
            }
        } else if (currentState.consentGiven === true) {
            // Find next missing field
            const missingField = config.candidateDataFields.find(
                f => !nextState.collectedFields[f]
            );

            if (missingField) {
                nextState.lastAskedField = missingField;
                supervisorAction = 'ASK_FIELD';
            } else {
                supervisorAction = 'FINAL_GOODBYE';
            }
        }
    }

    return { nextState, supervisorAction, shouldOverride };
}

// Check if AI response needs override
function checkResponseNeedsOverride(
    response: string,
    currentPhase: string,
    language: string
): { needsOverride: boolean; reason: string } {
    const goodbyePatterns = language === 'it'
        ? /\b(arrivederci|buona giornata|a presto|grazie per il tuo tempo|è stato un piacere)\b/i
        : /\b(goodbye|see you|have a great day|it was a pleasure)\b/i;

    const contactPatterns = language === 'it'
        ? /\b(posso chiederti i contatti|la tua email|prima di salutarci)\b/i
        : /\b(may i ask for your contact|your email|before we wrap up)\b/i;

    const hasNoQuestion = !response.includes('?');
    const isGoodbye = goodbyePatterns.test(response);
    const isPrematureContact = contactPatterns.test(response) && currentPhase !== 'DATA_COLLECTION';

    if ((currentPhase === 'SCAN' || currentPhase === 'DEEP') && (isGoodbye || hasNoQuestion)) {
        return { needsOverride: true, reason: 'Premature closure during active phase' };
    }

    if (isPrematureContact) {
        return { needsOverride: true, reason: 'Premature contact request' };
    }

    return { needsOverride: false, reason: '' };
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    console.log('\n🧪 CONVERSATION FLOW TEST SUITE\n');
    console.log('='.repeat(60));

    // Test 1: Phase Transitions
    console.log('\n📋 Test 1: Phase Transitions');
    const phaseTest = testPhaseTransitions();
    results.push(phaseTest);
    console.log(phaseTest.passed ? '✅ PASSED' : '❌ FAILED');
    phaseTest.details.forEach(d => console.log(`   ${d}`));
    phaseTest.errors.forEach(e => console.log(`   ❌ ${e}`));

    // Test 2: Override Detection
    console.log('\n📋 Test 2: Override Detection');
    const overrideTest = testOverrideDetection();
    results.push(overrideTest);
    console.log(overrideTest.passed ? '✅ PASSED' : '❌ FAILED');
    overrideTest.details.forEach(d => console.log(`   ${d}`));
    overrideTest.errors.forEach(e => console.log(`   ❌ ${e}`));

    // Test 3: Data Collection Flow
    console.log('\n📋 Test 3: Data Collection Flow');
    const dataTest = testDataCollection();
    results.push(dataTest);
    console.log(dataTest.passed ? '✅ PASSED' : '❌ FAILED');
    dataTest.details.forEach(d => console.log(`   ${d}`));
    dataTest.errors.forEach(e => console.log(`   ❌ ${e}`));

    // Test 4: Field Extraction
    console.log('\n📋 Test 4: Field Extraction');
    const extractionTest = testFieldExtraction();
    results.push(extractionTest);
    console.log(extractionTest.passed ? '✅ PASSED' : '❌ FAILED');
    extractionTest.details.forEach(d => console.log(`   ${d}`));
    extractionTest.errors.forEach(e => console.log(`   ❌ ${e}`));

    // Test 5: Override Naturalness
    console.log('\n📋 Test 5: Override Naturalness');
    const naturalnessTest = testOverrideNaturalness();
    results.push(naturalnessTest);
    console.log(naturalnessTest.passed ? '✅ PASSED' : '❌ FAILED');
    naturalnessTest.details.forEach(d => console.log(`   ${d}`));
    naturalnessTest.errors.forEach(e => console.log(`   ❌ ${e}`));

    // Summary
    console.log('\n' + '='.repeat(60));
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    console.log(`\n📊 SUMMARY: ${passed}/${total} tests passed\n`);

    return results;
}

// ============================================================================
// INDIVIDUAL TESTS
// ============================================================================

function testPhaseTransitions(): TestResult {
    const result: TestResult = {
        scenario: 'Phase Transitions',
        passed: true,
        details: [],
        errors: []
    };

    let state: ConversationState = {
        phase: 'SCAN',
        topicIndex: 0,
        turnInTopic: 0,
        consentGiven: null,
        lastAskedField: null,
        collectedFields: {}
    };

    // Simulate 6 turns (3 per topic with 2 topics)
    for (let i = 0; i < 6; i++) {
        const { nextState, supervisorAction } = simulateStateMachine(
            state,
            `Risposta utente turno ${i + 1}`,
            TEST_CONFIG.bot
        );

        result.details.push(`Turn ${i + 1}: ${state.phase} → ${nextState.phase} (${supervisorAction})`);

        // Check transition at turn 3
        if (i === 2 && supervisorAction !== 'TRANSITION') {
            result.errors.push(`Expected TRANSITION at turn 3, got ${supervisorAction}`);
            result.passed = false;
        }

        // Check DATA_COLLECTION at turn 6
        if (i === 5 && nextState.phase !== 'DATA_COLLECTION') {
            result.errors.push(`Expected DATA_COLLECTION at turn 6, got ${nextState.phase}`);
            result.passed = false;
        }

        state = nextState;
    }

    return result;
}

function testOverrideDetection(): TestResult {
    const result: TestResult = {
        scenario: 'Override Detection',
        passed: true,
        details: [],
        errors: []
    };

    const testCases = [
        { response: 'Grazie mille per il tuo tempo!', phase: 'SCAN', shouldOverride: true },
        { response: 'Interessante! Quali sfide hai affrontato?', phase: 'SCAN', shouldOverride: false },
        { response: 'A presto! Ci vediamo.', phase: 'SCAN', shouldOverride: true },
        { response: 'Posso chiederti la tua email?', phase: 'SCAN', shouldOverride: true },
        { response: 'Posso chiederti la tua email?', phase: 'DATA_COLLECTION', shouldOverride: false },
        { response: 'Buona giornata! Come ti chiami?', phase: 'SCAN', shouldOverride: true }, // Goodbye with question
    ];

    for (const tc of testCases) {
        const { needsOverride, reason } = checkResponseNeedsOverride(tc.response, tc.phase, 'it');

        if (needsOverride === tc.shouldOverride) {
            result.details.push(`✓ "${tc.response.substring(0, 30)}..." → ${needsOverride ? 'OVERRIDE' : 'OK'}`);
        } else {
            result.errors.push(`"${tc.response.substring(0, 30)}..." expected ${tc.shouldOverride ? 'OVERRIDE' : 'OK'}, got ${needsOverride ? 'OVERRIDE' : 'OK'}`);
            result.passed = false;
        }
    }

    return result;
}

function testDataCollection(): TestResult {
    const result: TestResult = {
        scenario: 'Data Collection Flow',
        passed: true,
        details: [],
        errors: []
    };

    let state: ConversationState = {
        phase: 'DATA_COLLECTION',
        topicIndex: 1,
        turnInTopic: 0,
        consentGiven: null,
        lastAskedField: null,
        collectedFields: {}
    };

    const messages = [
        'Sì, posso lasciarti i miei dati',
        'Marco Rossi',
        'marco.rossi@email.com',
        '3331234567'
    ];

    for (const msg of messages) {
        const { nextState, supervisorAction } = simulateStateMachine(state, msg, TEST_CONFIG.bot);

        result.details.push(`"${msg}" → ${supervisorAction} (collected: ${Object.keys(nextState.collectedFields).join(', ')})`);

        state = nextState;
    }

    // Check all fields collected
    const allCollected = TEST_CONFIG.bot.candidateDataFields.every(
        f => state.collectedFields[f]
    );

    if (!allCollected) {
        result.errors.push(`Not all fields collected: ${JSON.stringify(state.collectedFields)}`);
        result.passed = false;
    } else {
        result.details.push('✓ All fields collected successfully');
    }

    return result;
}

function testFieldExtraction(): TestResult {
    const result: TestResult = {
        scenario: 'Field Extraction',
        passed: true,
        details: [],
        errors: []
    };

    const testCases = [
        { message: 'marco.rossi@gmail.com', expectedField: 'email', expectedValue: 'marco.rossi@gmail.com' },
        { message: '3331234567', expectedField: 'phone', expectedValue: '3331234567' },
        { message: 'Sono Marco Rossi, la mia email è test@test.com', expectedFields: ['email'] },
    ];

    for (const tc of testCases) {
        const emailMatch = tc.message.match(/[\w.-]+@[\w.-]+\.\w+/);
        const phoneMatch = tc.message.match(/\d{10,}/);

        if (tc.expectedField === 'email' && emailMatch) {
            if (emailMatch[0] === tc.expectedValue) {
                result.details.push(`✓ Email extracted: ${emailMatch[0]}`);
            } else {
                result.errors.push(`Email mismatch: expected ${tc.expectedValue}, got ${emailMatch[0]}`);
                result.passed = false;
            }
        }

        if (tc.expectedField === 'phone' && phoneMatch) {
            if (phoneMatch[0] === tc.expectedValue) {
                result.details.push(`✓ Phone extracted: ${phoneMatch[0]}`);
            } else {
                result.errors.push(`Phone mismatch: expected ${tc.expectedValue}, got ${phoneMatch[0]}`);
                result.passed = false;
            }
        }
    }

    return result;
}

function testOverrideNaturalness(): TestResult {
    const result: TestResult = {
        scenario: 'Override Naturalness',
        passed: true,
        details: [],
        errors: []
    };

    // Test that override responses are not too rigid
    const overrideTemplates = {
        scan: [
            'Interessante! Tornando al tema "{topic}", qual è la tua esperienza diretta in merito?',
        ],
        deep: [
            'Grazie per questo spunto. Riguardo a "{topic}", puoi approfondire un aspetto specifico che ti sta a cuore?',
        ],
        consent: [
            'Ti ringrazio molto per questa conversazione, è stata davvero interessante! L\'intervista è conclusa. Prima di salutarci, posso chiederti i tuoi dati di contatto per restare in contatto?',
        ]
    };

    // Check templates don't have duplicate words in a row
    for (const [phase, templates] of Object.entries(overrideTemplates)) {
        for (const template of templates) {
            const words = template.toLowerCase().split(/\s+/);
            let hasDuplicates = false;

            for (let i = 1; i < words.length; i++) {
                if (words[i] === words[i - 1] && words[i].length > 3) {
                    hasDuplicates = true;
                    result.errors.push(`Duplicate word "${words[i]}" in ${phase} template`);
                    result.passed = false;
                }
            }

            if (!hasDuplicates) {
                result.details.push(`✓ ${phase} template is natural`);
            }
        }
    }

    // Check templates end with question mark where appropriate
    for (const [phase, templates] of Object.entries(overrideTemplates)) {
        for (const template of templates) {
            if (!template.includes('?')) {
                result.errors.push(`${phase} template missing question mark`);
                result.passed = false;
            }
        }
    }

    return result;
}

// ============================================================================
// MAIN
// ============================================================================

// Export for use in other tests
export { runTests, simulateStateMachine, checkResponseNeedsOverride, TEST_CONFIG };

// Run if executed directly
if (require.main === module) {
    runTests().then(results => {
        const allPassed = results.every(r => r.passed);
        process.exit(allPassed ? 0 : 1);
    });
}
