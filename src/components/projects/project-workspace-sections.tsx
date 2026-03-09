import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Compass,
  LayoutGrid,
  Lightbulb,
  PlayCircle,
  Radio,
  PlugZap,
} from 'lucide-react';

export type ProjectWorkspaceSectionId =
  | 'overview'
  | 'listen'
  | 'tips'
  | 'execute'
  | 'measure'
  | 'strategy'
  | 'connections';

export interface ProjectWorkspaceSection {
  id: ProjectWorkspaceSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

export interface ProjectWorkspaceMetric {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'success' | 'warning';
}

export function buildProjectWorkspaceSections(projectId: string): ProjectWorkspaceSection[] {
  return [
    {
      id: 'overview',
      label: 'Overview',
      description: 'Quadro operativo',
      icon: LayoutGrid,
      href: `/dashboard/projects/${projectId}`,
    },
    {
      id: 'listen',
      label: 'Listen',
      description: 'Segnali e fonti',
      icon: Radio,
      href: `/dashboard/insights?projectId=${projectId}&view=listen`,
    },
    {
      id: 'tips',
      label: 'Tips',
      description: 'Decisioni canoniche',
      icon: Lightbulb,
      href: `/dashboard/insights?projectId=${projectId}&view=tips`,
    },
    {
      id: 'execute',
      label: 'Execute',
      description: 'Routing ed esecuzione',
      icon: PlayCircle,
      href: `/dashboard/projects/${projectId}/integrations?tab=routing`,
    },
    {
      id: 'measure',
      label: 'Measure',
      description: 'Lettura dei risultati',
      icon: BarChart3,
      href: `/dashboard/projects/${projectId}/analytics`,
    },
    {
      id: 'strategy',
      label: 'Strategy',
      description: 'Priorita e metodo',
      icon: Compass,
      href: `/dashboard/insights?projectId=${projectId}&view=strategy`,
    },
    {
      id: 'connections',
      label: 'Connections',
      description: 'Tool e setup esterno',
      icon: PlugZap,
      href: `/dashboard/projects/${projectId}/integrations?tab=connections`,
    },
  ];
}
