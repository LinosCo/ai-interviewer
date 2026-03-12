'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { usePathname, useSearchParams } from 'next/navigation';

import { ALL_PROJECTS_OPTION, useProject } from '@/contexts/ProjectContext';
import {
  completeGuidanceStep,
  dismissGuidanceStep,
  mergeAutoCompletedSteps,
  readGuidanceState,
  reopenGuidance,
  setGuidanceEnabled,
  type GuidanceStepId,
  writeGuidanceState,
} from '@/lib/guidance/guidance-state';
import {
  getAutoCompletedGuidanceSteps,
  resolveContextualGuidanceStep,
  resolveGuidanceProjectId,
  type ProjectActivationSnapshot,
} from '@/lib/guidance/guidance-rules';

import { GuideToggle } from './GuideToggle';
import { GuidancePopup } from './GuidancePopup';

export function GuidanceLayer() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const { selectedProject } = useProject();

  const [guidanceState, setGuidanceState] = useState(() =>
    readGuidanceState(typeof window !== 'undefined' ? window.localStorage : null)
  );
  const [activationProjectId, setActivationProjectId] = useState<string | null>(null);
  const [activationSnapshot, setActivationSnapshot] = useState<ProjectActivationSnapshot | null>(null);

  const selectedProjectId = selectedProject?.id === ALL_PROJECTS_OPTION.id
    ? null
    : selectedProject?.id || null;

  const projectId = useMemo(
    () => resolveGuidanceProjectId(pathname, new URLSearchParams(searchParams.toString()), selectedProjectId),
    [pathname, searchParams, selectedProjectId]
  );

  useEffect(() => {
    writeGuidanceState(guidanceState, typeof window !== 'undefined' ? window.localStorage : null);
  }, [guidanceState]);

  useEffect(() => {
    if (!projectId) return;

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/activation-status`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) {
          setActivationProjectId(null);
          setActivationSnapshot(null);
          return;
        }

        const payload = (await res.json()) as ProjectActivationSnapshot;
        setActivationProjectId(projectId);
        setActivationSnapshot(payload);
        setGuidanceState((prev) =>
          mergeAutoCompletedSteps(
            prev,
            getAutoCompletedGuidanceSteps({
              pathname: '',
              projectId,
              activation: payload,
            })
          )
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to load guidance activation snapshot:', error);
        setActivationProjectId(null);
        setActivationSnapshot(null);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [projectId]);

  const context = useMemo(
    () => ({
      pathname,
      projectId,
      activation: activationProjectId === projectId ? activationSnapshot : null,
    }),
    [pathname, projectId, activationProjectId, activationSnapshot]
  );

  const autoCompletedSteps = useMemo(() => getAutoCompletedGuidanceSteps(context), [context]);

  const completedStepSet = useMemo(
    () => new Set([...guidanceState.completedCheckpoints, ...autoCompletedSteps]),
    [guidanceState.completedCheckpoints, autoCompletedSteps]
  );

  const contextualStep = useMemo(
    () =>
      resolveContextualGuidanceStep(context, {
        dismissedSteps: new Set(guidanceState.dismissedSteps),
        completedSteps: completedStepSet,
      }),
    [context, guidanceState.dismissedSteps, completedStepSet]
  );

  const contextualStepIgnoringDismiss = useMemo(
    () =>
      resolveContextualGuidanceStep(context, {
        completedSteps: completedStepSet,
        ignoreDismissed: true,
      }),
    [context, completedStepSet]
  );

  const handleEnabledChange = useCallback((enabled: boolean) => {
    setGuidanceState((prev) => setGuidanceEnabled(prev, enabled));
  }, []);

  const handleReopen = useCallback(() => {
    setGuidanceState((prev) => reopenGuidance(prev));
  }, []);

  const handleDismiss = useCallback((stepId: GuidanceStepId) => {
    setGuidanceState((prev) => dismissGuidanceStep(prev, stepId));
  }, []);

  const handleComplete = useCallback((stepId: GuidanceStepId) => {
    setGuidanceState((prev) => completeGuidanceStep(prev, stepId));
  }, []);

  return (
    <>
      <GuideToggle
        enabled={guidanceState.enabled}
        hasContextualStep={Boolean(contextualStepIgnoringDismiss)}
        onEnabledChange={handleEnabledChange}
        onReopen={handleReopen}
      />

      <AnimatePresence>
        {guidanceState.enabled && contextualStep ? (
          <GuidancePopup
            step={contextualStep}
            actionHref={contextualStep.actionHref(context)}
            onDismiss={() => handleDismiss(contextualStep.id)}
            onComplete={() => handleComplete(contextualStep.id)}
            onAction={() => handleComplete(contextualStep.id)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
