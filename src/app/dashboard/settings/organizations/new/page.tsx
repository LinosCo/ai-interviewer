'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, Plus } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const { setCurrentOrganization, refetchOrganizations } = useOrganization();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onNameChange = (value: string) => {
    setName(value);
    if (!slug) {
      setSlug(slugify(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
        }),
      });

      const data = await res.json().catch(() => ({})) as {
        error?: string;
        organization?: { id: string; name: string; slug: string; plan: string };
      };

      if (!res.ok || !data.organization) {
        throw new Error(data.error || 'Impossibile creare il team');
      }

      await refetchOrganizations();
      setCurrentOrganization({
        ...data.organization,
        role: 'OWNER',
      });
      router.push('/dashboard/settings/members');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore durante la creazione del team');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-amber-50 rounded-2xl">
          <Building2 className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Crea nuovo Team</h1>
          <p className="text-sm text-gray-500">Definisci il team e inizia subito con i tuoi progetti.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Nome Team</label>
          <input
            required
            minLength={2}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-amber-500 transition-all text-sm font-medium"
            placeholder="Es: Marketing Italia"
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Slug (opzionale)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-amber-500 transition-all text-sm font-medium"
            placeholder="marketing-italia"
          />
          <p className="mt-1 text-xs text-gray-400">Solo lettere minuscole, numeri e trattini.</p>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving || name.trim().length < 2}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creazione in corso...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Crea Team
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
