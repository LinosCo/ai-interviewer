'use client';

import { useEffect, useState } from 'react';
import { Loader2, LogOut, Mail, Shield, UserMinus, UserPlus, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { showToast } from '@/components/toast';

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: string;
}

interface AccessData {
  members: Member[];
  currentUserRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  organizationId: string;
}

interface ProjectAccessManagerProps {
  projectId: string;
  variant?: 'full' | 'compact';
  onClose?: () => void;
}

const DEFAULT_ROLE: Member['role'] = 'MEMBER';

export function ProjectAccessManager({ projectId, variant = 'full' }: ProjectAccessManagerProps) {
  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Member['role']>(DEFAULT_ROLE);

  const isCompact = variant === 'compact';
  const canManageMembers = data?.currentUserRole === 'OWNER' || data?.currentUserRole === 'ADMIN';

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/access`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        showToast(payload.error || 'Errore caricamento membri', 'error');
        return;
      }
      const payload = await response.json();
      setData(payload);
    } catch (error) {
      console.error('Failed to fetch project members:', error);
      showToast('Errore di rete', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    try {
      setInviting(true);
      const response = await fetch(`/api/projects/${projectId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          role: inviteRole
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        showToast(payload.error || 'Errore durante l\'invito', 'error');
        return;
      }

      showToast('Membro aggiunto all\'organizzazione', 'success');
      setEmail('');
      setInviteRole(DEFAULT_ROLE);
      await fetchMembers();
    } catch (error) {
      console.error('Invite member error:', error);
      showToast('Errore di rete', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      setRemovingId(userId);
      const response = await fetch(`/api/projects/${projectId}/access?userId=${userId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        showToast(payload.error || 'Errore durante la rimozione', 'error');
        return;
      }

      showToast('Membro rimosso dall\'organizzazione');
      await fetchMembers();
    } catch (error) {
      console.error('Remove member error:', error);
      showToast('Errore di rete', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const handleLeave = async () => {
    try {
      setLeaving(true);
      const response = await fetch(`/api/projects/${projectId}/access?userId=self`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        showToast(payload.error || 'Impossibile abbandonare l\'organizzazione', 'error');
        return;
      }

      showToast('Hai lasciato l\'organizzazione');
      window.location.href = '/dashboard/projects';
    } catch (error) {
      console.error('Leave organization error:', error);
      showToast('Errore di rete', 'error');
    } finally {
      setLeaving(false);
    }
  };

  const content = (
    <div className="space-y-6">
      {canManageMembers && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Invita membro organizzazione</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@email.com"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-400"
              />
            </div>
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as Member['role'])}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <Button
              onClick={handleInvite}
              disabled={inviting || !email.trim()}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {!canManageMembers && (
        <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <Shield className="h-4 w-4 shrink-0 text-slate-400" />
          Solo OWNER e ADMIN possono invitare o rimuovere membri.
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Membri con accesso al progetto</p>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-2">
            {data?.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold uppercase text-slate-700">
                    {(member.name?.[0] || member.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{member.name || member.email}</p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wide">
                    {member.role}
                  </Badge>
                  {canManageMembers && member.role !== 'OWNER' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(member.userId)}
                      disabled={removingId === member.userId}
                      className="text-slate-500 hover:bg-red-50 hover:text-red-600"
                    >
                      {removingId === member.userId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserMinus className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!canManageMembers && (
        <Button
          variant="outline"
          onClick={handleLeave}
          disabled={leaving}
          className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          {leaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
          Abbandona organizzazione
        </Button>
      )}
    </div>
  );

  if (isCompact) {
    return content;
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-amber-600" />
          <CardTitle>Membri Organizzazione</CardTitle>
        </div>
        <CardDescription>
          L&apos;accesso ai progetti deriva dai ruoli dell&apos;organizzazione. Nessuna condivisione progetto utente-specifica.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
