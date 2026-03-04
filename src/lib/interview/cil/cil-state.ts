import type { CILAnalysis, CILState } from './types'
export { EMPTY_CIL_STATE } from './types'

const MAX_THREADS = 6
const MAX_THEMES = 5

export function mergeCILState(
    existing: CILState,
    analysis: CILAnalysis,
    currentTurnIndex: number
): CILState {
    // Merge threads — deduplicate by lowercased description, prefer higher strength
    const threadMap = new Map<string, CILState['openThreads'][0]>()
    for (const t of [...existing.openThreads, ...analysis.openThreads]) {
        const key = t.description.toLowerCase().trim()
        const prev = threadMap.get(key)
        if (!prev || (t.strength === 'high' && prev.strength !== 'high')) {
            threadMap.set(key, t)
        }
    }
    // Sort: high first, then by turnIndex desc; keep max 6
    const mergedThreads = Array.from(threadMap.values())
        .sort((a, b) => (a.strength === 'high' ? -1 : 1) - (b.strength === 'high' ? -1 : 1) || b.turnIndex - a.turnIndex)
        .slice(0, MAX_THREADS)

    // Merge themes — deduplicate, preserve order, max 5
    const themeSet = new Set<string>()
    const mergedThemes: string[] = []
    for (const theme of [...existing.emergingThemes, ...analysis.emergingThemes]) {
        const key = theme.toLowerCase().trim()
        if (!themeSet.has(key) && mergedThemes.length < MAX_THEMES) {
            themeSet.add(key)
            mergedThemes.push(theme)
        }
    }

    return {
        openThreads: mergedThreads,
        emergingThemes: mergedThemes,
        lastResponseAnalysis: analysis.lastResponseAnalysis,
        lastUpdatedTurnIndex: currentTurnIndex
    }
}
