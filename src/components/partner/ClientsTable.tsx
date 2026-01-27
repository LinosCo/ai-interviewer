'use client';

/**
 * ClientsTable
 *
 * Tabella dei clienti attribuiti al partner con informazioni
 * su piano, status e data attribuzione.
 */

import { useState } from 'react';
import { Check, XCircle, Search, Users } from 'lucide-react';

interface Client {
    attributionId: string;
    organizationId: string;
    organizationName: string | null;
    ownerEmail: string;
    plan: string;
    subscriptionStatus: string | null;
    isActive: boolean;
    attributedAt: Date;
    firstProjectName: string | null;
    projectsCount: number;
}

interface ClientsTableProps {
    clients: Client[];
    summary: {
        totalAttributed: number;
        activeClients: number;
        pendingInvites: number;
    };
}

export function ClientsTable({ clients, summary }: ClientsTableProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterActive, setFilterActive] = useState<boolean | null>(null);

    const filteredClients = clients.filter(client => {
        const matchesSearch = searchTerm === '' ||
            client.organizationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter = filterActive === null || client.isActive === filterActive;

        return matchesSearch && matchesFilter;
    });

    const getPlanBadge = (plan: string) => {
        const planColors: Record<string, string> = {
            FREE: 'bg-stone-100 text-stone-700',
            TRIAL: 'bg-blue-100 text-blue-700',
            STARTER: 'bg-green-100 text-green-700',
            PRO: 'bg-purple-100 text-purple-700',
            BUSINESS: 'bg-amber-100 text-amber-700'
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${planColors[plan] || 'bg-stone-100 text-stone-700'}`}>
                {plan}
            </span>
        );
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200">
            {/* Header */}
            <div className="p-6 border-b border-stone-200">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-stone-600" />
                        <h3 className="text-lg font-semibold text-stone-900">I Tuoi Clienti</h3>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <span className="text-stone-600">
                            <strong className="text-stone-900">{summary.totalAttributed}</strong> totali
                        </span>
                        <span className="text-green-600">
                            <strong>{summary.activeClients}</strong> attivi
                        </span>
                        {summary.pendingInvites > 0 && (
                            <span className="text-amber-600">
                                <strong>{summary.pendingInvites}</strong> inviti pendenti
                            </span>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Cerca per nome o email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setFilterActive(null)}
                            className={`px-3 py-2 text-sm rounded-lg transition-colors ${filterActive === null ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                        >
                            Tutti
                        </button>
                        <button
                            onClick={() => setFilterActive(true)}
                            className={`px-3 py-2 text-sm rounded-lg transition-colors ${filterActive === true ? 'bg-green-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                        >
                            Attivi
                        </button>
                        <button
                            onClick={() => setFilterActive(false)}
                            className={`px-3 py-2 text-sm rounded-lg transition-colors ${filterActive === false ? 'bg-stone-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                        >
                            Non attivi
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            {filteredClients.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-stone-50 border-b border-stone-200">
                                <th className="text-left py-3 px-6 text-xs font-medium text-stone-600 uppercase tracking-wider">Cliente</th>
                                <th className="text-left py-3 px-6 text-xs font-medium text-stone-600 uppercase tracking-wider">Piano</th>
                                <th className="text-center py-3 px-6 text-xs font-medium text-stone-600 uppercase tracking-wider">Conta per soglie</th>
                                <th className="text-left py-3 px-6 text-xs font-medium text-stone-600 uppercase tracking-wider">Progetti</th>
                                <th className="text-left py-3 px-6 text-xs font-medium text-stone-600 uppercase tracking-wider">Attribuito il</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {filteredClients.map((client) => (
                                <tr key={client.attributionId} className="hover:bg-stone-50">
                                    <td className="py-4 px-6">
                                        <div>
                                            <p className="font-medium text-stone-900">{client.organizationName || 'Nome non disponibile'}</p>
                                            <p className="text-sm text-stone-500">{client.ownerEmail}</p>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        {getPlanBadge(client.plan)}
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        {client.isActive ? (
                                            <div className="flex items-center justify-center">
                                                <span className="inline-flex items-center gap-1 text-green-600">
                                                    <Check className="w-4 h-4" />
                                                    <span className="text-sm font-medium">Si</span>
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center">
                                                <span className="inline-flex items-center gap-1 text-stone-400">
                                                    <XCircle className="w-4 h-4" />
                                                    <span className="text-sm">No</span>
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-4 px-6">
                                        <div>
                                            <p className="text-stone-900">{client.projectsCount}</p>
                                            {client.firstProjectName && (
                                                <p className="text-xs text-stone-500 truncate max-w-32">{client.firstProjectName}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-sm text-stone-600">
                                        {formatDate(client.attributedAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="py-12 text-center">
                    <Users className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-stone-900 mb-2">Nessun cliente trovato</h4>
                    <p className="text-stone-500">
                        {searchTerm || filterActive !== null
                            ? 'Prova a modificare i filtri di ricerca'
                            : 'Invita i tuoi clienti per iniziare a costruire il tuo portafoglio'}
                    </p>
                </div>
            )}
        </div>
    );
}

export default ClientsTable;
