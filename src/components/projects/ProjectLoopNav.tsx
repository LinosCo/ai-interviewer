import Link from 'next/link';

import { buildProjectWorkspaceSections, type ProjectWorkspaceSectionId } from './project-workspace-sections';

interface ProjectLoopNavProps {
  projectId: string;
  activeSection: ProjectWorkspaceSectionId;
}

export function ProjectLoopNav({ projectId, activeSection }: ProjectLoopNavProps) {
  const sections = buildProjectWorkspaceSections(projectId);

  return (
    <nav aria-label="Loop operativo progetto" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = section.id === activeSection;

        return (
          <Link
            key={section.id}
            href={section.href}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'group h-full overflow-hidden rounded-2xl border px-4 py-3 transition-all',
              isActive
                ? 'border-amber-300 bg-amber-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/40',
            ].join(' ')}
          >
            <div className="flex h-full flex-col gap-3">
              <div
                className={[
                  'w-fit rounded-xl p-2 transition-colors',
                  isActive ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-amber-100 group-hover:text-amber-700',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="break-words text-[11px] font-black uppercase tracking-[0.12em] leading-tight text-slate-700">
                  {section.label}
                </p>
                <p className="break-words text-sm leading-5 text-slate-500">
                  {section.description}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
