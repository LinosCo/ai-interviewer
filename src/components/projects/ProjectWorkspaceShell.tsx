import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { ProjectLoopNav } from './ProjectLoopNav';
import type { ProjectWorkspaceMetric, ProjectWorkspaceSectionId } from './project-workspace-sections';

interface ProjectWorkspaceShellProps {
  projectId?: string | null;
  projectName?: string | null;
  activeSection: ProjectWorkspaceSectionId;
  eyebrow: string;
  title: string;
  description: string;
  metrics?: ProjectWorkspaceMetric[];
  action?: ReactNode;
  children: ReactNode;
}

function metricToneClass(tone: ProjectWorkspaceMetric['tone']) {
  if (tone === 'accent') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (tone === 'warning') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-slate-200 bg-white text-slate-700';
}

export function ProjectWorkspaceShell({
  projectId,
  projectName,
  activeSection,
  eyebrow,
  title,
  description,
  metrics = [],
  action,
  children,
}: ProjectWorkspaceShellProps) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#fff8ed_0%,#ffffff_40%,#f8fafc_100%)] shadow-sm">
        <div className="flex flex-col gap-6 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <Link href="/dashboard/projects" className="transition-colors hover:text-amber-600">
                  Progetti
                </Link>
                {projectId && projectName ? (
                  <>
                    <span>/</span>
                    <Link href={`/dashboard/projects/${projectId}`} className="transition-colors hover:text-amber-600">
                      {projectName}
                    </Link>
                  </>
                ) : null}
                <span>/</span>
                <span className="text-slate-900">{eyebrow}</span>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-black tracking-tight text-slate-900">{title}</h1>
                  {projectName ? (
                    <Badge className="border border-amber-200 bg-amber-50 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                      {projectName}
                    </Badge>
                  ) : null}
                </div>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
              </div>
            </div>

            {action ? <div className="w-full lg:w-auto lg:shrink-0">{action}</div> : null}
          </div>

          {metrics.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className={`rounded-2xl border px-4 py-3 ${metricToneClass(metric.tone)}`}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.18em]">{metric.label}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className="text-2xl font-black tracking-tight">{metric.value}</p>
                    <ArrowRight className="h-4 w-4 opacity-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {projectId ? <ProjectLoopNav projectId={projectId} activeSection={activeSection} /> : null}
        </div>
      </section>

      {children}
    </div>
  );
}
