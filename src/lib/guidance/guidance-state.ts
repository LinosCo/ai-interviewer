export const GUIDANCE_STORAGE_KEY = 'bt_phase6_guidance_state_v1';

export const GUIDANCE_STEP_IDS = [
  'project_without_tools',
  'first_interview_creation',
  'first_chatbot_creation',
  'first_visibility_setup',
  'first_integration_connection',
  'first_tip_review_or_routing',
] as const;

export type GuidanceStepId = (typeof GUIDANCE_STEP_IDS)[number];

export interface GuidanceState {
  enabled: boolean;
  dismissedSteps: GuidanceStepId[];
  completedCheckpoints: GuidanceStepId[];
  updatedAt: string;
}

type ReadableStorage = Pick<Storage, 'getItem'> | null | undefined;
type WritableStorage = Pick<Storage, 'setItem'> | null | undefined;

function isGuidanceStepId(value: string): value is GuidanceStepId {
  return (GUIDANCE_STEP_IDS as readonly string[]).includes(value);
}

function normalizeStepList(value: unknown): GuidanceStepId[] {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<GuidanceStepId>();
  for (const item of value) {
    if (typeof item === 'string' && isGuidanceStepId(item)) {
      deduped.add(item);
    }
  }
  return Array.from(deduped);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createDefaultGuidanceState(): GuidanceState {
  return {
    enabled: true,
    dismissedSteps: [],
    completedCheckpoints: [],
    updatedAt: nowIso(),
  };
}

export function sanitizeGuidanceState(raw: unknown): GuidanceState {
  const fallback = createDefaultGuidanceState();
  if (!raw || typeof raw !== 'object') return fallback;

  const parsed = raw as Partial<GuidanceState>;
  return {
    enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : fallback.enabled,
    dismissedSteps: normalizeStepList(parsed.dismissedSteps),
    completedCheckpoints: normalizeStepList(parsed.completedCheckpoints),
    updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt.length > 0
      ? parsed.updatedAt
      : fallback.updatedAt,
  };
}

export function parseGuidanceState(raw: string | null | undefined): GuidanceState {
  if (!raw) return createDefaultGuidanceState();
  try {
    return sanitizeGuidanceState(JSON.parse(raw));
  } catch {
    return createDefaultGuidanceState();
  }
}

export function readGuidanceState(storage: ReadableStorage): GuidanceState {
  if (!storage) return createDefaultGuidanceState();
  return parseGuidanceState(storage.getItem(GUIDANCE_STORAGE_KEY));
}

export function writeGuidanceState(state: GuidanceState, storage: WritableStorage): void {
  if (!storage) return;
  storage.setItem(GUIDANCE_STORAGE_KEY, JSON.stringify(state));
}

function withUpdatedAt(state: GuidanceState): GuidanceState {
  return {
    ...state,
    updatedAt: nowIso(),
  };
}

function addUniqueStep(list: GuidanceStepId[], stepId: GuidanceStepId): GuidanceStepId[] {
  return list.includes(stepId) ? list : [...list, stepId];
}

export function setGuidanceEnabled(state: GuidanceState, enabled: boolean): GuidanceState {
  if (state.enabled === enabled) return state;
  return withUpdatedAt({
    ...state,
    enabled,
  });
}

export function dismissGuidanceStep(state: GuidanceState, stepId: GuidanceStepId): GuidanceState {
  const dismissedSteps = addUniqueStep(state.dismissedSteps, stepId);
  if (dismissedSteps === state.dismissedSteps) return state;
  return withUpdatedAt({
    ...state,
    dismissedSteps,
  });
}

export function completeGuidanceStep(state: GuidanceState, stepId: GuidanceStepId): GuidanceState {
  const completedCheckpoints = addUniqueStep(state.completedCheckpoints, stepId);
  if (completedCheckpoints === state.completedCheckpoints) return state;
  return withUpdatedAt({
    ...state,
    completedCheckpoints,
  });
}

export function mergeAutoCompletedSteps(state: GuidanceState, stepIds: GuidanceStepId[]): GuidanceState {
  if (stepIds.length === 0) return state;
  const completedSet = new Set(state.completedCheckpoints);
  let changed = false;

  for (const stepId of stepIds) {
    if (!completedSet.has(stepId)) {
      completedSet.add(stepId);
      changed = true;
    }
  }

  if (!changed) return state;
  return withUpdatedAt({
    ...state,
    completedCheckpoints: Array.from(completedSet),
  });
}

export function reopenGuidance(state: GuidanceState): GuidanceState {
  const shouldReset = !state.enabled || state.dismissedSteps.length > 0;
  if (!shouldReset) return state;
  return withUpdatedAt({
    ...state,
    enabled: true,
    dismissedSteps: [],
  });
}
