import { Button } from '@/components/ui/button';

import { ProjectTipRoutingEditor } from './ProjectTipRoutingEditor';
import type { TipRoutingDraft } from './project-tip-ui';

export interface ProjectTipEditDraft {
  title: string;
  summary: string;
  reasoning: string;
  strategicAlignment: string;
  status: string;
  starred: boolean;
  routing: TipRoutingDraft;
}

interface ProjectTipEditorProps {
  projectId: string;
  draft: ProjectTipEditDraft;
  onChange: (draft: ProjectTipEditDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  hasRoutingConnection: boolean;
  hasRoutingPremium: boolean;
}

export function ProjectTipEditor({
  projectId,
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
  hasRoutingConnection,
  hasRoutingPremium,
}: ProjectTipEditorProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3">
        <input
          className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          placeholder="Titolo tip"
        />
        <textarea
          className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          value={draft.summary}
          onChange={(event) => onChange({ ...draft, summary: event.target.value })}
          placeholder="Cosa dovrebbe succedere e per quale obiettivo"
        />
        <textarea
          className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          value={draft.reasoning}
          onChange={(event) => onChange({ ...draft, reasoning: event.target.value })}
          placeholder="Perche questo tip esiste"
        />
        <textarea
          className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          value={draft.strategicAlignment}
          onChange={(event) => onChange({ ...draft, strategicAlignment: event.target.value })}
          placeholder="Come si collega a priorita, positioning o metodo"
        />
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            value={draft.status}
            onChange={(event) => onChange({ ...draft, status: event.target.value })}
          >
            {['NEW', 'REVIEWED', 'APPROVED', 'DRAFTED', 'ROUTED', 'AUTOMATED', 'COMPLETED', 'ARCHIVED'].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={draft.starred}
              onChange={(event) => onChange({ ...draft, starred: event.target.checked })}
            />
            Prioritario
          </label>
        </div>
      </div>

      <ProjectTipRoutingEditor
        projectId={projectId}
        value={draft.routing}
        onChange={(routing) => onChange({ ...draft, routing })}
        hasRoutingConnection={hasRoutingConnection}
        hasRoutingPremium={hasRoutingPremium}
      />

      <div className="flex items-center gap-2">
        <Button size="sm" className="rounded-full px-4 text-xs" onClick={onSave} disabled={saving}>
          {saving ? 'Salvataggio...' : 'Salva tip'}
        </Button>
        <Button variant="outline" size="sm" className="rounded-full px-4 text-xs" onClick={onCancel}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
