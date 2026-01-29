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
    Copy
} from "lucide-react";
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";

export default function CMSSettingsPage({ params }: { params: { connectionId: string } }) {
    const [connection, setConnection] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchConnection();
    }, [params.connectionId]);

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
                            <Label>Project Association</Label>
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <span className="font-medium">{connection.project?.name || 'Unknown Project'}</span>
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
                            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
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
