'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showToast } from '@/components/toast';
import {
    ArrowLeft,
    RefreshCw,
    Trash2,
    Link as LinkIcon,
    Globe,
    CheckCircle2,
    AlertCircle,
    Copy,
    ArrowRightLeft
} from "lucide-react";
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";

export default function CMSSettingsPage({ params }: { params: { connectionId: string } }) {
    const [connection, setConnection] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [targetProjectId, setTargetProjectId] = useState('');
    const [transferring, setTransferring] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchConnection();
        fetchProjects();
    }, [params.connectionId]);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/user/settings');
            if (res.ok) {
                const data = await res.json();
                // Collect projects from all organizations
                const allProjects = (data.memberships || []).flatMap((m: any) =>
                    (m.organization?.projects || []).map((p: any) => ({
                        ...p,
                        orgName: m.organization?.name
                    }))
                );
                setProjects(allProjects);
            }
        } catch (error) {
            console.error('Failed to load projects', error);
        }
    };

    const fetchConnection = async () => {
        try {
            const res = await fetch(`/api/cms/${params.connectionId}`);
            if (!res.ok) throw new Error('Failed to fetch connection');
            const data = await res.json();
            setConnection(data);
        } catch (error) {
            showToast("Failed to load connection details", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerateKey = async () => {
        if (!confirm('Are you sure? The old API key will stop working immediately.')) return;

        setRegenerating(true);
        try {
            const res = await fetch(`/api/cms/${params.connectionId}/regenerate-key`, {
                method: 'POST'
            });

            if (!res.ok) throw new Error('Failed to regenerate key');

            const data = await res.json();
            setConnection({ ...connection, apiKey: data.apiKey });
            showToast("API Key regenerated successfully", "success");
        } catch (error) {
            showToast("Failed to regenerate API key", "error");
        } finally {
            setRegenerating(false);
        }
    };

    const handleTransfer = async (mode: 'MOVE' | 'ASSOCIATE' = 'ASSOCIATE') => {
        if (!targetProjectId) return;
        if (!confirm(mode === 'MOVE' ? 'Sei sicuro di voler trasferire questa connessione?' : 'Sei sicuro di voler associare questa connessione anche a questo progetto?')) return;

        setTransferring(true);
        try {
            const res = await fetch(`/api/cms/${params.connectionId}/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetProjectId, mode })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to transfer connection');
            }

            showToast("Operazione completata con successo", "success");
            fetchConnection(); // Refresh data
            setTargetProjectId('');
        } catch (error: any) {
            showToast(error.message || "Errore durante l'operazione", "error");
        } finally {
            setTransferring(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure? This will disconnect the CMS and remove all associated suggestions.')) return;

        setDeleting(true);
        try {
            const res = await fetch(`/api/cms/${params.connectionId}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('Failed to delete connection');

            showToast("Connection removed successfully", "success");
            router.push('/dashboard');
        } catch (error) {
            showToast("Failed to delete connection", "error");
            setDeleting(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast("Copied to clipboard", "success");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
            </div>
        );
    }

    if (!connection) return <div>Connection not found</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/dashboard">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        CMS Connection Settings
                        <Badge variant={connection.status === 'ACTIVE' ? 'default' : 'secondary'}>
                            {connection.status}
                        </Badge>
                    </h1>
                    <p className="text-gray-500">Manage your connection to {connection.name}</p>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Connection Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="w-5 h-5 text-indigo-500" />
                            Connection Details
                        </CardTitle>
                        <CardDescription>Basic information about your CMS connection</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>CMS URL</Label>
                            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <LinkIcon className="w-4 h-4 text-gray-400" />
                                <span className="flex-1 font-mono text-sm">{connection.cmsApiUrl}</span>
                                <Button size="sm" variant="ghost" onClick={() => window.open(connection.cmsApiUrl, '_blank')}>
                                    Open
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Project Associations</Label>
                            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                {(() => {
                                    const allAssoc = [
                                        ...(connection.project ? [connection.project] : []),
                                        ...(connection.projects || [])
                                    ];
                                    if (allAssoc.length > 0) {
                                        return allAssoc.map((p: any) => (
                                            <Badge key={p.id} variant="secondary" className="px-2 py-1">
                                                {p.name}
                                            </Badge>
                                        ));
                                    }
                                    return <span className="text-gray-500 italic text-sm">No projects associated</span>;
                                })()}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* API Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Key className="w-5 h-5 text-amber-500" />
                            API Configuration
                        </CardTitle>
                        <CardDescription>Manage keys and secrets for secure communication</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <Input value={connection.apiKey || '****************'} readOnly className="font-mono bg-gray-50" type="password" />
                                </div>
                                <Button variant="outline" onClick={() => copyToClipboard(connection.apiKey)}>
                                    <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleRegenerateKey}
                                    disabled={regenerating}
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                >
                                    <RefreshCw className={`w-4 h-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                                    Regenerate
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500">
                                Use this key to authenticate requests from your CMS to our API.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Transfer Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                            Associa a un altro Progetto
                        </CardTitle>
                        <CardDescription>Collega questa connessione CMS a un altro progetto della stessa organizzazione.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Seleziona Progetto di Destinazione</Label>
                            <div className="flex gap-2">
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    onChange={(e) => setTargetProjectId(e.target.value)}
                                    value={targetProjectId}
                                >
                                    <option value="">Seleziona un progetto...</option>
                                    {projects
                                        .filter(p => p.organizationId === connection.organizationId) // Must be same org
                                        .filter(p => {
                                            const isSingular = connection.project?.id === p.id;
                                            const inPlural = connection.projects?.some((cp: any) => cp.id === p.id);
                                            return !isSingular && !inPlural;
                                        }) // Filter out already associated
                                        .map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                </select>
                                <Button
                                    onClick={() => handleTransfer('ASSOCIATE')}
                                    disabled={!targetProjectId || transferring}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {transferring ? 'Associazione...' : 'Associa'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="border-red-200 bg-red-50/10">
                    <CardHeader>
                        <CardTitle className="text-red-600 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Danger Zone
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-white">
                            <div>
                                <h4 className="font-medium text-gray-900">Delete Connection</h4>
                                <p className="text-sm text-gray-500">Permanently remove this connection and all its data.</p>
                            </div>
                            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Deleting...' : 'Delete Connection'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function Key({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="m21 2-9.6 9.6" />
            <path d="m15.5 7.5 3 3L22 7l-3-3" />
        </svg>
    )
}
