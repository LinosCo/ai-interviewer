'use client';

import { useOrganization } from '@/contexts/OrganizationContext';
import { useState, useEffect } from 'react';
import { Building2, UserPlus, Users, Shield, Trash2, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

interface Member {
    id: string;
    role: string;
    user: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
    };
}

export default function TeamManagementPage() {
    const { currentOrganization } = useOrganization();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('MEMBER');
    const [isInviting, setIsInviting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fetchMembers = async () => {
        if (!currentOrganization) return;
        try {
            const res = await fetch(`/api/organizations/${currentOrganization.id}/members`);
            if (res.ok) {
                const data = await res.json();
                setMembers(data.members);
            }
        } catch (error) {
            console.error('Fetch Members Error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, [currentOrganization]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentOrganization || !inviteEmail) return;

        setIsInviting(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/organizations/${currentOrganization.id}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, role: inviteRole })
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Membro aggiunto con successo!' });
                setInviteEmail('');
                fetchMembers();
            } else {
                const error = await res.text();
                setMessage({ type: 'error', text: error || 'Errore durante l\'invito' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Errore di connessione' });
        } finally {
            setIsInviting(false);
        }
    };

    if (!currentOrganization) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <Building2 className="w-12 h-12 text-gray-300 mb-4" />
                <h2 className="text-xl font-bold text-gray-900">Nessuna organizzazione selezionata</h2>
                <p className="text-gray-500 max-w-xs mt-2">Seleziona un&apos;organizzazione dalla barra laterale per gestire i membri.</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-50 rounded-xl">
                        <Users className="w-6 h-6 text-amber-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">Gestione Team</h1>
                </div>
                <p className="text-gray-600">
                    Gestisci i membri del team per <span className="font-bold text-gray-900">{currentOrganization.name}</span>.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Invite Section */}
                <div className="lg:col-span-1">
                    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 h-fit sticky top-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-amber-600" />
                            Aggiungi Membro
                        </h3>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1.5">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="esempio@email.it"
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-amber-500 transition-all text-sm"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1.5">Ruolo</label>
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-amber-500 transition-all text-sm appearance-none"
                                >
                                    <option value="MEMBER">Membro (Sola lettura/Modifica limitata)</option>
                                    <option value="ADMIN">Admin (Gestione completa)</option>
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={isInviting || !inviteEmail}
                                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 text-white font-bold rounded-xl transition-all shadow-md shadow-amber-200"
                            >
                                {isInviting ? 'Aggiunta...' : 'Aggiungi al Team'}
                            </button>
                        </form>

                        {message && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`mt-4 p-3 rounded-xl text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                                    }`}
                            >
                                {message.text}
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Members List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Componenti attivi ({members.length})</h3>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-600 mb-4" />
                                <p className="text-gray-400 text-sm">Caricamento membri...</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {members.map((member) => (
                                    <div key={member.id} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center font-bold text-amber-700 shadow-sm">
                                                {member.user.image ? (
                                                    <img src={member.user.image} alt="" className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    (member.user.name?.[0] || member.user.email[0]).toUpperCase()
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-900">{member.user.name || 'Senza nome'}</span>
                                                <span className="text-xs text-gray-500">{member.user.email}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight flex items-center gap-1.5 ${member.role === 'OWNER'
                                                ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                                : member.role === 'ADMIN'
                                                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                                    : 'bg-blue-50 text-blue-700 border border-blue-100'
                                                }`}>
                                                <Shield className="w-3 h-3" />
                                                {member.role}
                                            </div>
                                            {member.role !== 'OWNER' && (
                                                <button className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl border border-amber-200/50">
                        <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Gestione Ruoli
                        </h4>
                        <ul className="space-y-2 text-sm text-amber-800/80">
                            <li>• <span className="font-bold text-amber-900">Owner:</span> Proprietario dell&apos;organizzazione, gestione totale e billing.</li>
                            <li>• <span className="font-bold text-amber-900">Admin:</span> Può creare progetti, invitare membri e modificare bot.</li>
                            <li>• <span className="font-bold text-amber-900">Member:</span> Può vedere i dati e interagire con i bot esistenti.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
