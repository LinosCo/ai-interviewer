'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Sparkles,
    RefreshCw,
    Mic,
    MessageSquare,
    Eye,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    TrendingUp,
    TrendingDown,
    Globe,
    Zap,
    Search,
    Lightbulb,
    Save,
    Folder,
    Target,
    Code,
    FileText,
    AlertCircle,
    Download,
    Star,
    Lock
} from "lucide-react";
import { showToast } from "@/components/toast";
import { useProject } from '@/contexts/ProjectContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { updateInsightStatus } from './actions';
import { CONTENT_KIND_LABELS, type ContentKind } from '@/lib/cms/content-kinds';
import { ROUTING_TIP_CATEGORY_LABELS } from '@/lib/cms/tip-routing-taxonomy';

interface Action {
    type: string;
    target: string;
    title?: string;
    body: string;
    reasoning: string;
    status: 'pending' | 'approved' | 'rejected';
    autoApply?: boolean;
    contentKind?: string | null;
    category?: string | null;
    executionClass?: 'routing_ready' | 'digital_manual' | 'non_digital' | string | null;
    businessCategory?: string | null;
    workflowStatus?: string;
    strategicAlignment?: string;
    coordination?: string;
    evidence?: Array<{
        sourceType: string;
        sourceRef: string;
        detail: string;
    }>;
    lifecycleHistory?: {
        draftReady: number;
        sent: number;
        discarded: number;
        total: number;
    } | null;
}

interface Insight {
    id: string;
    topicName: string;
    priorityScore: number;
    crossChannelScore: number;
    suggestedActions: Action[];
    interviewData?: any;
    chatbotData?: any;
    visibilityData?: any;
    status: string;
    projectId?: string | null;
    createdAt?: string;
    updatedAt?: string;
    source?: string;
    isVirtual?: boolean;
}

interface TipHistoryItem {
    contentKind: string;
    category: string | null;
    draftReady: number;
    sent: number;
    discarded: number;
    total: number;
    latestAt: string | null;
}

interface RoutingConnectionState {
    hasConnection: boolean;
    loading: boolean;
}

// Helper: determine if action can be auto-applied (only if explicitly flagged)
const canBeAutoApplied = (action: Action): boolean => {
    return action.autoApply === true;
};

// Helper: get human-readable action type label in Italian
const getActionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        'add_faq': 'Aggiungi FAQ',
        'add_interview_topic': 'Nuovo tema intervista',
        'add_visibility_prompt': 'Monitor nuova query',
        'create_content': 'Crea contenuto',
        'modify_content': 'Modifica contenuto',
        'respond_to_press': 'Risposta PR',
        'monitor_competitor': 'Monitor competitor',
        'strategic_recommendation': 'Suggerimento strategico',
        'pricing_change': 'Revisione prezzi',
        'product_improvement': 'Miglioramento prodotto',
        'marketing_campaign': 'Campagna marketing'
    };
    return labels[type] || type.replace(/_/g, ' ');
};

// Helper: get human-readable target label in Italian
const getTargetLabel = (target: string): string => {
    const labels: Record<string, string> = {
        'chatbot': 'Assistente',
        'interview': 'Interviste',
        'visibility': 'Visibilità',
        'website': 'Sito Web',
        'pr': 'PR & Media',
        'serp': 'Google',
        'strategy': 'Strategia',
        'product': 'Prodotto',
        'marketing': 'Marketing'
    };
    return labels[target] || target;
};

const getExecutionClassLabel = (executionClass?: string | null): string => {
    if (executionClass === 'routing_ready') return 'Routing pronto';
    if (executionClass === 'digital_manual') return 'Digitale manuale';
    if (executionClass === 'non_digital') return 'Non digitale';
    return 'Da classificare';
};

export default function InsightHubPage() {
    const router = useRouter();
    const { selectedProject, isAllProjectsSelected } = useProject();
    const { currentOrganization } = useOrganization();
    const [insights, setInsights] = useState<Insight[]>([]);
    const [healthReport, setHealthReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [strategicVision, setStrategicVision] = useState('');
    const [valueProposition, setValueProposition] = useState('');
    const [isSavingStrategy, setIsSavingStrategy] = useState(false);
    const [showStrategyEdit, setShowStrategyEdit] = useState(false);
    const [websiteAnalytics, setWebsiteAnalytics] = useState<any>(null);
    const [websiteAnalysis, setWebsiteAnalysis] = useState<any>(null);
    const [websiteAnalysisLoading, setWebsiteAnalysisLoading] = useState(false);
    const [expandedWebsiteRec, setExpandedWebsiteRec] = useState<number | null>(null);
    const [statusFilter, setStatusFilter] = useState<'active' | 'starred' | 'completed' | 'archived' | 'all'>('active');
    const [tipTypeFilter, setTipTypeFilter] = useState<string>('all');
    const [updatingInsightId, setUpdatingInsightId] = useState<string | null>(null);
    const [openingSuggestionKey, setOpeningSuggestionKey] = useState<string | null>(null);
    const [topSources, setTopSources] = useState<any[]>([]);
    const [tipHistoryByContentKind, setTipHistoryByContentKind] = useState<TipHistoryItem[]>([]);
    const [routingConnectionsByProject, setRoutingConnectionsByProject] = useState<Record<string, RoutingConnectionState>>({});

    const toArraySize = (value: any): number => (Array.isArray(value) ? value.length : 0);

    const escapeCsv = (value: unknown): string => {
        const raw = value == null ? '' : String(value);
        const escaped = raw.replace(/"/g, '""');
        return `"${escaped}"`;
    };

    const handleExportCsv = () => {
        if (!insights.length) {
            showToast('Nessun dato disponibile da esportare', 'error');
            return;
        }

        const headers = [
            'insight_id',
            'insight_topic',
            'insight_status',
            'insight_priority_score',
            'insight_cross_channel_score',
            'insight_created_at',
            'insight_updated_at',
            'tool_interview_records',
            'tool_chatbot_records',
            'tool_visibility_records',
            'tool_active_channels',
            'ai_tip_index',
            'ai_tip_type',
            'ai_tip_target',
            'ai_tip_status',
            'ai_tip_title',
            'ai_tip_body',
            'ai_tip_reasoning'
        ];

        const rows: string[] = [headers.join(',')];

        insights.forEach((insight) => {
            const interviewCount = toArraySize(insight.interviewData);
            const chatbotCount = toArraySize(insight.chatbotData);
            const visibilityCount = toArraySize(insight.visibilityData?.visibilitySummary);
            const activeChannels = Array.isArray(insight.visibilityData?.activeChannels)
                ? insight.visibilityData.activeChannels.join('|')
                : '';
            const actions = Array.isArray(insight.suggestedActions) ? insight.suggestedActions : [];

            if (actions.length === 0) {
                rows.push([
                    escapeCsv(insight.id),
                    escapeCsv(insight.topicName),
                    escapeCsv(insight.status),
                    escapeCsv(insight.priorityScore),
                    escapeCsv(insight.crossChannelScore),
                    escapeCsv(insight.createdAt || ''),
                    escapeCsv(insight.updatedAt || ''),
                    escapeCsv(interviewCount),
                    escapeCsv(chatbotCount),
                    escapeCsv(visibilityCount),
                    escapeCsv(activeChannels),
                    escapeCsv(''),
                    escapeCsv(''),
                    escapeCsv(''),
                    escapeCsv(''),
                    escapeCsv(''),
                    escapeCsv(''),
                    escapeCsv('')
                ].join(','));
                return;
            }

            actions.forEach((action, index) => {
                rows.push([
                    escapeCsv(insight.id),
                    escapeCsv(insight.topicName),
                    escapeCsv(insight.status),
                    escapeCsv(insight.priorityScore),
                    escapeCsv(insight.crossChannelScore),
                    escapeCsv(insight.createdAt || ''),
                    escapeCsv(insight.updatedAt || ''),
                    escapeCsv(interviewCount),
                    escapeCsv(chatbotCount),
                    escapeCsv(visibilityCount),
                    escapeCsv(activeChannels),
                    escapeCsv(index + 1),
                    escapeCsv(action.type),
                    escapeCsv(action.target),
                    escapeCsv(action.status),
                    escapeCsv(action.title || ''),
                    escapeCsv(action.body),
                    escapeCsv(action.reasoning)
                ].join(','));
            });
        });

        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `ai_tips_tools_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        showToast('Export CSV completato');
    };

    // Get the project ID for API calls (null if "All Projects" is selected)
    const projectId = selectedProject && !isAllProjectsSelected ? selectedProject.id : null;
    const organizationId = currentOrganization?.id || null;
    const organizationPlan = (currentOrganization?.plan || 'FREE').toUpperCase();
    const hasRoutingPremium = ['BUSINESS', 'PARTNER', 'ENTERPRISE', 'ADMIN'].includes(organizationPlan);

    const checkProjectHasRoutingConnection = useCallback(async (targetProjectId: string): Promise<boolean> => {
        try {
            const [cmsRes, mcpRes, n8nRes] = await Promise.all([
                fetch(`/api/cms/connection?projectId=${targetProjectId}`),
                fetch(`/api/integrations/mcp/connections?projectId=${targetProjectId}`),
                fetch(`/api/integrations/n8n/connections?projectId=${targetProjectId}`)
            ]);

            const [cmsData, mcpData, n8nData] = await Promise.all([
                cmsRes.ok ? cmsRes.json().catch(() => null) : null,
                mcpRes.ok ? mcpRes.json().catch(() => null) : null,
                n8nRes.ok ? n8nRes.json().catch(() => null) : null
            ]);

            const hasCms = Boolean(cmsData?.enabled && cmsData?.connection);
            const mcpConnections = Array.isArray(mcpData?.connections) ? mcpData.connections : [];
            const hasMcp = mcpConnections.some((connection: { status?: string | null }) =>
                Boolean(connection?.status && connection.status !== 'DISABLED')
            );
            const hasN8n = Boolean(
                n8nData?.connection
                && typeof n8nData.connection.status === 'string'
                && n8nData.connection.status !== 'DISABLED'
            );

            return hasCms || hasMcp || hasN8n;
        } catch (err) {
            console.error('Routing connection check error:', err);
            return false;
        }
    }, []);

    const openRoutingConnections = (targetProjectId?: string | null) => {
        if (!targetProjectId) {
            showToast('Seleziona un progetto per configurare AI Routing', 'error');
            router.push('/dashboard/projects');
            return;
        }
        router.push(`/dashboard/projects/${targetProjectId}/integrations`);
    };

    const openRoutingUpgrade = () => {
        router.push('/dashboard/billing/plans');
    };

    const fetchInsights = async () => {
        try {
            const url = projectId
                ? `/api/insights/sync?projectId=${projectId}${organizationId ? `&organizationId=${organizationId}` : ''}`
                : `/api/insights/sync${organizationId ? `?organizationId=${organizationId}` : ''}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setInsights(data.insights);
                setTipHistoryByContentKind(Array.isArray(data.tipHistoryByContentKind) ? data.tipHistoryByContentKind : []);

                // Find health report record
                const hr = data.insights.find((i: any) => i.topicName === "Health Report: Brand & Sito");
                if (hr && hr.visibilityData?.report) {
                    setHealthReport(hr.visibilityData.report);
                } else {
                    setHealthReport(null);
                }
            }

            // Fetch website analytics if CMS is connected
            try {
                const analyticsRes = await fetch('/api/cms/analytics?range=7d');
                if (analyticsRes.ok) {
                    const analyticsData = await analyticsRes.json();
                    if (analyticsData.summary) {
                        setWebsiteAnalytics({
                            avgPageviews: analyticsData.summary.pageviews / 7,
                            avgBounceRate: analyticsData.summary.bounceRate,
                            searchQueries: analyticsData.topSearchQueries?.length || 0,
                            lowPerformingPages: analyticsData.topPages?.filter((p: any) => p.bounceRate > 0.7).length || 0
                        });
                    }
                }
            } catch {
                // CMS not connected, ignore
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStrategy = async () => {
        try {
            // Fetch project-level strategy if a project is selected, otherwise org-level
            const url = projectId
                ? `/api/projects/${projectId}/settings`
                : '/api/organization/settings';
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setStrategicVision(data.strategicVision || '');
                setValueProposition(data.valueProposition || '');
            }
        } catch (err) {
            console.error('Fetch strategy error:', err);
        }
    };

    const fetchWebsiteAnalysis = async () => {
        try {
            // Get the visibility config for the project/org
            const configUrl = projectId
                ? `/api/visibility/create?projectId=${projectId}${organizationId ? `&organizationId=${organizationId}` : ''}`
                : `/api/visibility/create${organizationId ? `?organizationId=${organizationId}` : ''}`;
            const configRes = await fetch(configUrl);
            if (configRes.ok) {
                const configData = await configRes.json();
                if (configData.config?.id && configData.config?.websiteUrl) {
                    // Fetch website analysis for this config
                    const analysisRes = await fetch(`/api/visibility/website-analysis?configId=${configData.config.id}`);
                    if (analysisRes.ok) {
                        const analysisData = await analysisRes.json();
                        setWebsiteAnalysis({
                            ...analysisData.analysis,
                            configId: configData.config.id,
                            websiteUrl: configData.config.websiteUrl,
                            brandName: configData.config.brandName
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching website analysis:', err);
        }
    };

    const fetchTopSources = async () => {
        try {
            // Get the visibility config for the project/org
            const configUrl = projectId
                ? `/api/visibility/create?projectId=${projectId}${organizationId ? `&organizationId=${organizationId}` : ''}`
                : `/api/visibility/create${organizationId ? `?organizationId=${organizationId}` : ''}`;
            const configRes = await fetch(configUrl);
            if (configRes.ok) {
                const configData = await configRes.json();
                if (configData.config?.id) {
                    // Fetch top sources for this config
                    const sourcesRes = await fetch(`/api/visibility/top-sources?configId=${configData.config.id}`);
                    if (sourcesRes.ok) {
                        const sourcesData = await sourcesRes.json();
                        setTopSources(sourcesData.sources || []);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching top sources:', err);
        }
    };

    const runWebsiteAnalysis = async (configId: string) => {
        setWebsiteAnalysisLoading(true);
        try {
            const res = await fetch('/api/visibility/website-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configId })
            });
            if (res.ok) {
                showToast("Analisi sito avviata. Attendere...");
                // Poll for completion
                const pollInterval = setInterval(async () => {
                    const pollRes = await fetch(`/api/visibility/website-analysis?configId=${configId}`);
                    if (pollRes.ok) {
                        const data = await pollRes.json();
                        if (!data.isRunning && data.analysis) {
                            clearInterval(pollInterval);
                            setWebsiteAnalysis((prev: any) => ({ ...prev, ...data.analysis }));
                            setWebsiteAnalysisLoading(false);
                            showToast("Analisi sito completata!");
                        }
                    }
                }, 3000);
                setTimeout(() => {
                    clearInterval(pollInterval);
                    setWebsiteAnalysisLoading(false);
                }, 120000);
            }
        } catch (err) {
            console.error(err);
            setWebsiteAnalysisLoading(false);
            showToast("Errore durante l'analisi", "error");
        }
    };

    // Refetch when selected project changes
    useEffect(() => {
        setLoading(true);
        setHealthReport(null);
        setWebsiteAnalysis(null);
        setTopSources([]);
        setTipHistoryByContentKind([]);
        fetchInsights();
        fetchStrategy();
        fetchWebsiteAnalysis();
        fetchTopSources();
    }, [projectId, organizationId]);

    useEffect(() => {
        setRoutingConnectionsByProject({});
    }, [organizationId]);

    useEffect(() => {
        if (!hasRoutingPremium) {
            setRoutingConnectionsByProject((prev) => (Object.keys(prev).length > 0 ? {} : prev));
            return;
        }

        const projectIds = Array.from(
            new Set(
                [
                    projectId,
                    ...insights.map((insight) => insight.projectId || null)
                ].filter((id): id is string => typeof id === 'string' && id.length > 0)
            )
        );

        if (projectIds.length === 0) return;

        const pendingProjectIds = projectIds.filter((id) => !routingConnectionsByProject[id]);
        if (pendingProjectIds.length === 0) return;

        setRoutingConnectionsByProject((prev) => {
            const next = { ...prev };
            pendingProjectIds.forEach((id) => {
                next[id] = { hasConnection: false, loading: true };
            });
            return next;
        });

        let cancelled = false;
        (async () => {
            const results = await Promise.all(
                pendingProjectIds.map(async (id) => ({
                    id,
                    hasConnection: await checkProjectHasRoutingConnection(id)
                }))
            );

            if (cancelled) return;

            setRoutingConnectionsByProject((prev) => {
                const next = { ...prev };
                results.forEach((entry) => {
                    next[entry.id] = { hasConnection: entry.hasConnection, loading: false };
                });
                return next;
            });
        })();

        return () => {
            cancelled = true;
        };
    }, [checkProjectHasRoutingConnection, hasRoutingPremium, insights, projectId, routingConnectionsByProject]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const url = projectId
                ? `/api/insights/sync?projectId=${projectId}${organizationId ? `&organizationId=${organizationId}` : ''}`
                : `/api/insights/sync${organizationId ? `?organizationId=${organizationId}` : ''}`;
            const res = await fetch(url, { method: 'POST' });
            if (res.ok) {
                showToast("Insights sincronizzati con successo!");
                fetchInsights();
            } else {
                showToast("Errore durante la sincronizzazione", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Errore di rete", "error");
        } finally {
            setSyncing(false);
        }
    };

    const handleSaveStrategy = async () => {
        setIsSavingStrategy(true);
        try {
            // Save to project-level if a project is selected, otherwise org-level
            const url = projectId
                ? `/api/projects/${projectId}/settings`
                : '/api/organization/settings';
            const res = await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategicVision, valueProposition })
            });
            if (res.ok) {
                showToast("Strategia salvata! Verrà usata per la prossima analisi.");
                setShowStrategyEdit(false);
            } else {
                showToast("Errore durante il salvataggio", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Errore di rete", "error");
        } finally {
            setIsSavingStrategy(false);
        }
    };

    const normalizeInsightStatus = (status: string | null | undefined) => {
        const normalized = (status || 'new').toLowerCase();
        if (normalized === 'actioned') return 'completed';
        if (normalized === 'dismissed') return 'archived';
        return normalized;
    };

    const handleInsightStatus = async (insightId: string, status: 'new' | 'starred' | 'completed' | 'archived') => {
        setUpdatingInsightId(insightId);
        try {
            await updateInsightStatus(insightId, status);
            setInsights(prev => prev.map(i => i.id === insightId ? { ...i, status } : i));
        } catch (err) {
            console.error(err);
            showToast('Errore aggiornando lo stato del tip', 'error');
        } finally {
            setUpdatingInsightId(null);
        }
    };

    const tipTypeOptions = Array.from(
        new Set(
            insights
                .filter(i => i.topicName !== "Health Report: Brand & Sito")
                .flatMap(i => (Array.isArray(i.suggestedActions) ? i.suggestedActions : []).map(a => a.type))
                .filter(Boolean)
        )
    ).sort();

    const handleApplyAction = async (insightId: string, actionTitle: string) => {
        setUpdatingInsightId(insightId);
        try {
            await updateInsightStatus(insightId, 'completed');
            setInsights(prev => prev.map(i => i.id === insightId ? { ...i, status: 'completed' } : i));
            showToast(`Azione "${actionTitle}" applicata con successo`, 'success');
        } catch (err) {
            console.error(err);
            showToast("Errore durante l'applicazione dell'azione", 'error');
        } finally {
            setUpdatingInsightId(null);
        }
    };

    const handleOpenSuggestionManager = async (insight: Insight, action: Action, actionKey: string) => {
        setOpeningSuggestionKey(actionKey);
        try {
            if (insight.isVirtual && !organizationId) {
                showToast('Organizzazione non trovata per questo tip', 'error');
                return;
            }
            const payload = insight.isVirtual
                ? {
                    actionTitle: action.title || getActionTypeLabel(action.type),
                    virtualTip: {
                        organizationId: organizationId as string,
                        projectId: insight.projectId || projectId || null,
                        topicName: insight.topicName,
                        source: insight.source || 'site_analysis',
                        action: {
                            type: action.type,
                            target: action.target,
                            title: action.title,
                            body: action.body,
                            reasoning: action.reasoning,
                            strategicAlignment: action.strategicAlignment,
                            coordination: action.coordination,
                            evidence: action.evidence,
                            executionClass: action.executionClass,
                            contentKind: action.contentKind,
                            category: action.category,
                            businessCategory: action.businessCategory,
                            workflowStatus: action.workflowStatus,
                            autoApply: action.autoApply
                        }
                    }
                }
                : {
                    insightId: insight.id,
                    actionTitle: action.title || getActionTypeLabel(action.type)
                };
            const res = await fetch('/api/insights/suggestions/prepare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data?.error || 'Impossibile aprire la gestione del tip', 'error');
                return;
            }
            if (typeof data?.url === 'string' && data.url) {
                router.push(data.url);
                return;
            }
            showToast('Bozza preparata ma link non disponibile', 'error');
        } catch (err) {
            console.error(err);
            showToast('Errore di rete durante apertura tip', 'error');
        } finally {
            setOpeningSuggestionKey(null);
        }
    };

    const selectedProjectRoutingState = projectId ? routingConnectionsByProject[projectId] : null;
    const showRoutingConnectionInvite = Boolean(
        hasRoutingPremium
        && projectId
        && selectedProjectRoutingState
        && !selectedProjectRoutingState.loading
        && !selectedProjectRoutingState.hasConnection
    );

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        AI Tips
                    </h2>
                    <p className="text-muted-foreground font-medium flex items-center gap-2">
                        Analisi cross-channel di interviste, chatbot e visibilità online.
                        {selectedProject && !isAllProjectsSelected && (
                            <Badge variant="outline" className="ml-2 gap-1 font-medium">
                                <Folder className="w-3 h-3" />
                                {selectedProject.name}
                            </Badge>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleExportCsv}
                        variant="outline"
                        className="rounded-full px-6"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <Button
                        onClick={handleSync}
                        disabled={syncing}
                        className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-8 shadow-lg shadow-amber-200 transition-all hover:scale-105 active:scale-95"
                    >
                        {syncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {syncing ? 'Analisi in corso...' : 'Aggiorna Analisi'}
                    </Button>
                </div>
            </div>

            <Card className="border-blue-100 bg-blue-50/50">
                <CardContent className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-blue-900">
                            Dall&apos;insight all&apos;esecuzione, con supporto Copilot
                        </p>
                        <p className="text-xs text-blue-800/90 mt-1">
                            Usa il Strategy Copilot per trasformare i tip in bozze operative, creare regole AI Routing e configurare le connessioni ai tool esterni.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {projectId && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRoutingConnections(projectId)}
                                className="rounded-full border-blue-200 text-blue-700 hover:bg-blue-100"
                            >
                                Apri integrazioni
                            </Button>
                        )}
                        {!hasRoutingPremium && (
                            <Button
                                size="sm"
                                onClick={openRoutingUpgrade}
                                className="rounded-full bg-amber-600 hover:bg-amber-700 text-white"
                            >
                                Upgrade Business
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {showRoutingConnectionInvite && (
                <Card className="border-amber-200 bg-amber-50/60">
                    <CardContent className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-amber-900">
                                AI Routing non ancora configurato per questo progetto
                            </p>
                            <p className="text-xs text-amber-800/90 mt-1">
                                Collega almeno una destinazione (CMS, WordPress/WooCommerce o n8n) per inviare i tip in modo operativo.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => openRoutingConnections(projectId)}
                            className="bg-amber-600 hover:bg-amber-700 text-white rounded-full"
                        >
                            Configura connessione
                        </Button>
                    </CardContent>
                </Card>
            )}

            {tipHistoryByContentKind.length > 0 && (
                <Card className="border-slate-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
                            Storico AI Tips per tipologia
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                                        <th className="px-4 py-2">Tipologia</th>
                                        <th className="px-4 py-2">Categoria</th>
                                        <th className="px-4 py-2">Bozza</th>
                                        <th className="px-4 py-2">Inviate</th>
                                        <th className="px-4 py-2">Scartate</th>
                                        <th className="px-4 py-2">Totale</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tipHistoryByContentKind.slice(0, 8).map((item) => (
                                        <tr key={item.contentKind} className="border-t border-slate-100">
                                            <td className="px-4 py-2 font-medium text-slate-800">
                                                {CONTENT_KIND_LABELS[item.contentKind as ContentKind] || item.contentKind}
                                            </td>
                                            <td className="px-4 py-2 text-xs text-slate-500">
                                                {item.category
                                                    ? ROUTING_TIP_CATEGORY_LABELS[item.category as keyof typeof ROUTING_TIP_CATEGORY_LABELS] || item.category
                                                    : 'N/D'}
                                            </td>
                                            <td className="px-4 py-2 text-slate-600">{item.draftReady}</td>
                                            <td className="px-4 py-2 text-slate-600">{item.sent}</td>
                                            <td className="px-4 py-2 text-slate-600">{item.discarded}</td>
                                            <td className="px-4 py-2 font-semibold text-slate-800">{item.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Strategic Context Section */}
            <Card className="border-amber-100 bg-amber-50/20">
                <CardHeader className="pb-3 border-b border-amber-100/50 bg-white/50">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
                                <Lightbulb className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold">Visione Strategica & Value Prop</CardTitle>
                                <CardDescription className="text-xs">
                                    {projectId
                                        ? `Definisci la strategia per il progetto "${selectedProject?.name}" per suggerimenti AI più mirati.`
                                        : 'Definisci la direzione della tua organizzazione per suggerimenti AI più mirati.'}
                                </CardDescription>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowStrategyEdit(!showStrategyEdit)}
                            className="text-amber-700 hover:text-amber-800 hover:bg-amber-100"
                        >
                            {showStrategyEdit ? 'Annulla' : (strategicVision || valueProposition ? 'Modifica' : 'Imposta Strategia')}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    {showStrategyEdit ? (
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 ml-1">Visione Strategica</label>
                                    <textarea
                                        value={strategicVision}
                                        onChange={(e) => setStrategicVision(e.target.value)}
                                        placeholder="Esempio: Diventare il punto di riferimento per l'automazione HR in Italia entro il 2026..."
                                        className="w-full h-32 p-4 text-sm rounded-2xl border border-amber-100 bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:italic"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 ml-1">Value Proposition</label>
                                    <textarea
                                        value={valueProposition}
                                        onChange={(e) => setValueProposition(e.target.value)}
                                        placeholder="Esempio: Aiutiamo le aziende a scalare riducendo i costi di recruiting del 40% tramite intelligenza artificiale."
                                        className="w-full h-32 p-4 text-sm rounded-2xl border border-amber-100 bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:italic"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    onClick={handleSaveStrategy}
                                    disabled={isSavingStrategy}
                                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-8 shadow-md"
                                >
                                    {isSavingStrategy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salva Strategia
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="relative p-6 bg-white rounded-[2rem] border border-amber-50 shadow-sm group hover:shadow-md transition-all">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <TrendingUp className="w-12 h-12 text-amber-900" />
                                </div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Visione Attuale</h4>
                                <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                                    {strategicVision || "Non ancora definita. Clicca su 'Imposta Strategia' per aiutare l'AI a darti suggerimenti più mirati."}
                                </p>
                            </div>
                            <div className="relative p-6 bg-white rounded-[2rem] border border-amber-50 shadow-sm group hover:shadow-md transition-all">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Zap className="w-12 h-12 text-amber-900" />
                                </div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Value Proposition</h4>
                                <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                                    {valueProposition || "Non ancora definita. Definisci il tuo valore unico per ottenere analisi migliori."}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Health Assessment Section */}
            {healthReport && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-gradient-to-br from-white to-green-50/30 border-green-100 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-center text-green-700">
                                <MessageSquare className="w-5 h-5" />
                                <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
                                    {healthReport.chatbotSatisfaction.trend === 'improving' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                    {healthReport.chatbotSatisfaction.trend}
                                </Badge>
                            </div>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 pt-2">Soddisfazione Chatbot</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-slate-900">{healthReport.chatbotSatisfaction.score}%</div>
                            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{healthReport.chatbotSatisfaction.summary}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-white to-blue-50/30 border-blue-100 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-center text-blue-700">
                                <Globe className="w-5 h-5" />
                                <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">Sito Web</Badge>
                            </div>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 pt-2">Efficacia Contenuti</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-slate-900">{healthReport.websiteEffectiveness.score}%</div>
                            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{healthReport.websiteEffectiveness.feedbackSummary}</p>
                            <div className="mt-3 flex flex-wrap gap-1">
                                {healthReport.websiteEffectiveness.contentGaps.slice(0, 2).map((gap: string, i: number) => (
                                    <Badge key={i} className="text-[9px] bg-red-50 text-red-600 border-red-100 font-bold uppercase">Manca: {gap}</Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-white to-amber-50/30 border-amber-100 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-center text-amber-700">
                                <Search className="w-5 h-5" />
                                <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">Reputazione</Badge>
                            </div>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 pt-2">Reputazione Online</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-slate-900">{healthReport.brandVisibility.score}%</div>
                            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{healthReport.brandVisibility.competitorInsights}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Website Performance Section */}
            {websiteAnalytics && (
                <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-500" />
                        Performance Sito Web
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-stone-50 rounded-xl">
                            <p className="text-2xl font-black text-stone-900">
                                {Math.round(websiteAnalytics.avgPageviews).toLocaleString()}
                            </p>
                            <p className="text-xs text-stone-500 mt-1">Visite/giorno</p>
                        </div>
                        <div className="text-center p-4 bg-stone-50 rounded-xl">
                            <p className="text-2xl font-black text-stone-900">
                                {(websiteAnalytics.avgBounceRate * 100).toFixed(0)}%
                            </p>
                            <p className="text-xs text-stone-500 mt-1">Bounce Rate</p>
                        </div>
                        <div className="text-center p-4 bg-stone-50 rounded-xl">
                            <p className="text-2xl font-black text-stone-900">
                                {websiteAnalytics.searchQueries || 0}
                            </p>
                            <p className="text-xs text-stone-500 mt-1">Query tracciate</p>
                        </div>
                        <div className="text-center p-4 bg-stone-50 rounded-xl">
                            <p className="text-2xl font-black text-stone-900">
                                {websiteAnalytics.lowPerformingPages || 0}
                            </p>
                            <p className="text-xs text-stone-500 mt-1">Pagine da ottimizzare</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Industry Sources Section */}
            {topSources && topSources.length > 0 && (
                <Card className="border-stone-100 bg-white shadow-sm">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-50 rounded-xl">
                                <Globe className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Fonti di Settore</p>
                                <CardTitle className="text-base font-bold text-stone-900">Fonti Più Rilevanti per il Settore</CardTitle>
                                <CardDescription className="text-xs">
                                    Siti e fonti citati più frequentemente dagli LLM per le tue query monitorate
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {topSources.map((source: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-xl border border-indigo-100 hover:border-indigo-200 transition-colors group">
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <div className="text-2xl font-black text-indigo-600 shrink-0">#{idx + 1}</div>
                                        <div className="min-w-0 flex-1">
                                            <a
                                                href={source.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-semibold text-sm hover:underline hover:text-amber-600 truncate block transition-colors"
                                            >
                                                {source.domain}
                                            </a>
                                            <div className="flex gap-2 mt-1.5 flex-wrap">
                                                {source.platforms.map((p: string) => (
                                                    <Badge key={p} variant="outline" className="text-[9px] border-stone-200 text-stone-600 bg-stone-50">
                                                        {p}
                                                    </Badge>
                                                ))}
                                            </div>
                                            {source.prompts && source.prompts.length > 0 && (
                                                <div className="mt-2 text-[10px] text-slate-500 truncate">
                                                    Query: {source.prompts[0]}
                                                    {source.prompts.length > 1 && ` +${source.prompts.length - 1}`}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-4">
                                        <div className="text-lg font-bold text-slate-900">{source.count}</div>
                                        <div className="text-[10px] text-slate-500">citazioni</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 text-[10px] text-slate-400 text-center pt-3 border-t">
                            Basato sulle ultime {topSources.length > 0 ? '50' : '0'} scansioni completate
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Website LLM Optimization Section - from Brand Monitor */}
            {websiteAnalysis?.websiteUrl && (
                <Card className="border-stone-100 bg-white shadow-sm">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-50 rounded-xl">
                                    <Globe className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold">Ottimizzazione Sito per LLM</CardTitle>
                                    <CardDescription className="text-xs">
                                        {websiteAnalysis.brandName && <span className="font-medium text-amber-600">{websiteAnalysis.brandName}</span>}
                                        {' - '}Analisi del sito per visibilità su ChatGPT, Claude e Gemini
                                    </CardDescription>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => runWebsiteAnalysis(websiteAnalysis.configId)}
                                disabled={websiteAnalysisLoading}
                                className="gap-2 border-stone-200 text-stone-600 hover:bg-stone-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${websiteAnalysisLoading ? 'animate-spin' : ''}`} />
                                {websiteAnalysisLoading ? 'Analisi...' : 'Aggiorna'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {websiteAnalysis.overallScore !== undefined ? (
                            <>
                                {/* Scores */}
                                <div className="grid grid-cols-5 gap-3">
                                    <div className={`p-3 rounded-xl text-center border ${websiteAnalysis.overallScore >= 80 ? 'bg-green-50 border-green-200 text-green-700' :
                                            websiteAnalysis.overallScore >= 60 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                'bg-red-50 border-red-200 text-red-700'
                                        }`}>
                                        <div className="text-2xl font-black">{websiteAnalysis.overallScore}</div>
                                        <div className="text-[10px] font-bold uppercase">Score Totale</div>
                                    </div>
                                    <div className="p-3 rounded-xl text-center bg-slate-50 border border-slate-100">
                                        <div className="text-lg font-bold text-slate-700">{websiteAnalysis.structuredDataScore || 0}</div>
                                        <div className="text-[9px] text-slate-500">Schema.org</div>
                                    </div>
                                    <div className="p-3 rounded-xl text-center bg-slate-50 border border-slate-100">
                                        <div className="text-lg font-bold text-slate-700">{websiteAnalysis.valuePropositionScore || 0}</div>
                                        <div className="text-[9px] text-slate-500">Value Prop</div>
                                    </div>
                                    <div className="p-3 rounded-xl text-center bg-slate-50 border border-slate-100">
                                        <div className="text-lg font-bold text-slate-700">{websiteAnalysis.keywordCoverageScore || 0}</div>
                                        <div className="text-[9px] text-slate-500">Keywords</div>
                                    </div>
                                    <div className="p-3 rounded-xl text-center bg-slate-50 border border-slate-100">
                                        <div className="text-lg font-bold text-slate-700">{websiteAnalysis.contentClarityScore || 0}</div>
                                        <div className="text-[9px] text-slate-500">Chiarezza</div>
                                    </div>
                                </div>

                                {/* Prompt Coverage */}
                                {websiteAnalysis.promptsAddressed && (
                                    <div className="bg-white rounded-xl border p-4">
                                        <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2">
                                            <Target className="w-4 h-4 text-amber-600" />
                                            Copertura Query Monitorate
                                        </h4>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 text-green-700 text-xs font-medium mb-2">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Query Coperte ({websiteAnalysis.promptsAddressed.addressed?.length || 0})
                                                </div>
                                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                                    {websiteAnalysis.promptsAddressed.addressed?.slice(0, 4).map((prompt: string, i: number) => (
                                                        <div key={i} className="text-xs text-slate-600 truncate bg-green-50 px-2 py-1 rounded">
                                                            {prompt}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 text-amber-700 text-xs font-medium mb-2">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                    Gap da Colmare ({websiteAnalysis.promptsAddressed.gaps?.length || 0})
                                                </div>
                                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                                    {websiteAnalysis.promptsAddressed.gaps?.slice(0, 4).map((prompt: string, i: number) => (
                                                        <div key={i} className="text-xs text-slate-600 truncate bg-amber-50 px-2 py-1 rounded">
                                                            {prompt}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Recommendations */}
                                {websiteAnalysis.recommendations && websiteAnalysis.recommendations.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2">
                                            <Lightbulb className="w-4 h-4 text-amber-500" />
                                            Raccomandazioni per Visibilità LLM ({websiteAnalysis.recommendations.length})
                                        </h4>
                                        <div className="space-y-2">
                                            {websiteAnalysis.recommendations.map((rec: any, idx: number) => (
                                                <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                                    <div
                                                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                                        onClick={() => setExpandedWebsiteRec(expandedWebsiteRec === idx ? null : idx)}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`p-1.5 rounded-lg shrink-0 ${rec.type === 'add_structured_data' ? 'bg-blue-100' :
                                                                    rec.type === 'improve_value_proposition' ? 'bg-amber-50' :
                                                                        rec.type === 'add_keyword_content' ? 'bg-green-100' :
                                                                            'bg-amber-100'
                                                                }`}>
                                                                {rec.type === 'add_structured_data' ? <Code className="w-4 h-4 text-blue-600" /> :
                                                                    rec.type === 'improve_value_proposition' ? <Target className="w-4 h-4 text-amber-600" /> :
                                                                        rec.type === 'add_keyword_content' ? <FileText className="w-4 h-4 text-green-600" /> :
                                                                            <Sparkles className="w-4 h-4 text-amber-600" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-sm text-slate-800 truncate">{rec.title}</div>
                                                                <Badge variant="outline" className={`text-[9px] mt-0.5 font-semibold ${rec.priority === 'high' ? '!border-red-300 !bg-red-100 !text-red-800' :
                                                                        rec.priority === 'medium' ? '!border-amber-300 !bg-amber-100 !text-amber-800' :
                                                                            '!border-blue-300 !bg-blue-100 !text-blue-800'
                                                                    }`}>
                                                                    {rec.priority === 'high' ? 'Alta Priorità' : rec.priority === 'medium' ? 'Media' : 'Bassa'}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        {expandedWebsiteRec === idx ?
                                                            <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" /> :
                                                            <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                                                        }
                                                    </div>
                                                    {expandedWebsiteRec === idx && (
                                                        <div className="px-4 pb-4 pt-0 border-t bg-slate-50/50">
                                                            <p className="text-sm text-slate-600 mt-3 leading-relaxed">{rec.description}</p>
                                                            <div className="mt-3 p-3 bg-green-50 rounded-lg">
                                                                <div className="text-xs font-bold text-green-700 mb-1">Impatto Atteso:</div>
                                                                <p className="text-sm text-green-800">{rec.impact}</p>
                                                            </div>
                                                            {rec.relatedPrompts && rec.relatedPrompts.length > 0 && (
                                                                <div className="mt-3 flex flex-wrap gap-1">
                                                                    <span className="text-[10px] text-slate-500 mr-1">Query correlate:</span>
                                                                    {rec.relatedPrompts.slice(0, 3).map((p: string, i: number) => (
                                                                        <span key={i} className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-600 rounded">
                                                                            {p}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="text-[10px] text-slate-400 text-center pt-2 border-t">
                                    Ultima analisi: {websiteAnalysis.completedAt ? new Date(websiteAnalysis.completedAt).toLocaleString('it-IT') : 'Mai'}
                                    {websiteAnalysis.pagesScraped && websiteAnalysis.pagesScraped > 1 && (
                                        <span className="ml-2">• {websiteAnalysis.pagesScraped} pagine analizzate</span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <Globe className="w-12 h-12 text-stone-200 mx-auto mb-3" />
                                <h4 className="font-semibold text-slate-700">Nessuna Analisi Disponibile</h4>
                                <p className="text-sm text-slate-500 mt-1 mb-4">
                                    Analizza il sito per scoprire come migliorare la visibilità su ChatGPT, Claude e Gemini.
                                </p>
                                <Button
                                    onClick={() => runWebsiteAnalysis(websiteAnalysis.configId)}
                                    disabled={websiteAnalysisLoading}
                                    className="gap-2 bg-amber-600 hover:bg-amber-700"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    {websiteAnalysisLoading ? 'Analisi in corso...' : 'Avvia Analisi Sito'}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-600 fill-amber-600" />
                        <h3 className="text-xl font-bold text-slate-900">Cosa Migliorare</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                            <span className="text-slate-500 font-medium">Manuale</span>
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'active' | 'starred' | 'completed' | 'archived' | 'all')}
                            className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
                            aria-label="Filtra per stato"
                        >
                            <option value="active">Stato: Attivi</option>
                            <option value="starred">Stato: Prioritari</option>
                            <option value="completed">Stato: Completati</option>
                            <option value="archived">Stato: Archiviati</option>
                            <option value="all">Stato: Tutti</option>
                        </select>
                        <select
                            value={tipTypeFilter}
                            onChange={(e) => setTipTypeFilter(e.target.value)}
                            className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
                            aria-label="Filtra per tipologia"
                        >
                            <option value="all">Tipologia: Tutte</option>
                            {tipTypeOptions.map((type) => (
                                <option key={type} value={type}>
                                    {getActionTypeLabel(type)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="grid gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-2xl" />
                        ))}
                    </div>
                ) : (() => {
                    const filtered = insights
                        .filter(i => i.topicName !== "Health Report: Brand & Sito")
                        .filter(i => {
                            const status = normalizeInsightStatus(i.status);
                            if (statusFilter === 'active') return status !== 'archived' && status !== 'completed';
                            if (statusFilter === 'starred') return status === 'starred';
                            if (statusFilter === 'completed') return status === 'completed';
                            if (statusFilter === 'archived') return status === 'archived';
                            return true;
                        })
                        .filter(i => {
                            if (tipTypeFilter === 'all') return true;
                            return Array.isArray(i.suggestedActions)
                                && i.suggestedActions.some((action) => action.type === tipTypeFilter);
                        });

                    if (filtered.length === 0) {
                        return (
                            <Card className="border-dashed border-2 bg-slate-50">
                                <CardContent className="flex flex-col items-center py-16 text-center">
                                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-md mb-6 rotate-3">
                                        <Lightbulb className="w-10 h-10 text-slate-200" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900">Suggerimenti in arrivo</h3>
                                    <p className="text-sm text-slate-500 max-w-sm mt-2">
                                        Nessun tip per i filtri selezionati oppure analisi ancora in corso. Clicca su "Aggiorna Analisi" per rigenerare i suggerimenti.
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    }

                    return (
                        <div className="grid gap-6">
                            {filtered.map((insight) => {
                                const status = normalizeInsightStatus(insight.status);
                                return (
                                    <Card key={insight.id} className={`overflow-hidden border-slate-200 hover:border-amber-200 transition-all group hover:shadow-xl hover:shadow-slate-200/50 ${status === 'archived' ? 'opacity-60' : ''}`}>
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <CardHeader className="pb-4">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <CardTitle className="text-xl font-extrabold text-slate-900 leading-tight">
                                                            {insight.topicName}
                                                        </CardTitle>
                                                        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 font-bold">
                                                            CC Score: {insight.crossChannelScore}%
                                                        </Badge>
                                                        {insight.source === 'site_analysis' && (
                                                            <Badge variant="outline" className="text-[9px] uppercase font-bold !border-indigo-200 !bg-indigo-50 !text-indigo-700">
                                                                Site Analysis
                                                            </Badge>
                                                        )}
                                                        <Badge variant="outline" className={`text-[9px] uppercase font-bold ${
                                                            status === 'starred'
                                                                ? '!border-yellow-300 !bg-yellow-50 !text-yellow-700'
                                                                : status === 'completed'
                                                                    ? '!border-emerald-200 !bg-emerald-50 !text-emerald-700'
                                                                    : status === 'archived'
                                                                        ? '!border-slate-300 !bg-slate-100 !text-slate-600'
                                                                        : '!border-slate-300 !bg-white !text-slate-700'
                                                        }`}>
                                                            {status}
                                                        </Badge>
                                                    </div>
                                                    <CardDescription className="flex items-center gap-4 pt-2">
                                                        <span className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-full">
                                                            <Mic className="w-3 h-3" /> Feedback
                                                        </span>
                                                        <span className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-full">
                                                            <MessageSquare className="w-3 h-3" /> Domande clienti
                                                        </span>
                                                        <span className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-full">
                                                            <Eye className="w-3 h-3" /> Reputazione
                                                        </span>
                                                    </CardDescription>
                                                </div>
                                                <div className="text-right">
                                                    {!insight.isVirtual && (
                                                        <button
                                                            onClick={() => handleInsightStatus(insight.id, status === 'starred' ? 'new' : 'starred')}
                                                            disabled={updatingInsightId === insight.id}
                                                            className={`ml-auto mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                                                                status === 'starred'
                                                                    ? 'border-yellow-300 bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                                                                    : 'border-slate-200 bg-white text-slate-400 hover:text-yellow-600 hover:border-yellow-200'
                                                            }`}
                                                            title={status === 'starred' ? 'Rimuovi priorità' : 'Segna prioritario'}
                                                        >
                                                            <Star className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <div className="text-3xl font-black text-slate-900">
                                                        {insight.priorityScore}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        Priority
                                                    </div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                    Azioni Suggerite
                                                </h4>
                                                <div className="grid gap-4">
                                                    {insight.suggestedActions.map((action: Action, idx: number) => {
                                                        const canApply = canBeAutoApplied(action);
                                                        const actionKey = `${insight.id}:${idx}`;
                                                        const canManageTip = (
                                                            action.executionClass === 'routing_ready'
                                                            || action.executionClass === 'digital_manual'
                                                            || action.type === 'create_content'
                                                            || action.type === 'modify_content'
                                                        );
                                                        const routingProjectId = insight.projectId || projectId || null;
                                                        const routingConnectionState = routingProjectId
                                                            ? routingConnectionsByProject[routingProjectId]
                                                            : null;
                                                        const routingConnectionLoading = Boolean(
                                                            canManageTip
                                                            && hasRoutingPremium
                                                            && routingProjectId
                                                            && (!routingConnectionState || routingConnectionState.loading)
                                                        );
                                                        const requiresUpgradeForRouting = canManageTip && !hasRoutingPremium;
                                                        const requiresProjectSelection = canManageTip && hasRoutingPremium && !routingProjectId;
                                                        const requiresRoutingConnection = Boolean(
                                                            canManageTip
                                                            && hasRoutingPremium
                                                            && routingProjectId
                                                            && routingConnectionState
                                                            && !routingConnectionState.loading
                                                            && !routingConnectionState.hasConnection
                                                        );
                                                        return (
                                                            <div key={idx} className={`flex flex-col md:flex-row md:items-start justify-between gap-4 p-5 rounded-2xl border group/action hover:shadow-lg transition-all duration-300 ${canApply ? 'bg-slate-50 border-slate-100 hover:bg-white hover:border-green-300' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-300'}`}>
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <div className={`w-2 h-2 rounded-full ${canApply ? 'bg-green-500' : 'bg-slate-400'}`} title={canApply ? 'Applicabile automaticamente' : 'Manuale'} />
                                                                        <Badge className={`${action.target === 'website' || action.target === 'strategy' ? 'bg-blue-100 text-blue-700' :
                                                                            action.target === 'chatbot' || action.target === 'interview' ? 'bg-green-100 text-green-700' :
                                                                                action.target === 'product' ? 'bg-indigo-100 text-indigo-700' :
                                                                                    action.target === 'marketing' || action.target === 'pr' ? 'bg-pink-100 text-pink-700' :
                                                                                        'bg-amber-100 text-amber-700'
                                                                            } hover:bg-opacity-80 border-none px-2.5 py-0.5 font-bold uppercase text-[9px]`}>
                                                                            {getTargetLabel(action.target)}
                                                                        </Badge>
                                                                        <Badge variant="outline" className={`text-[9px] uppercase font-bold ${canApply ? '!border-green-300 !bg-green-100 !text-green-800' : '!border-slate-300 !bg-slate-100 !text-slate-700'}`}>
                                                                            {getActionTypeLabel(action.type)}
                                                                        </Badge>
                                                                        {action.contentKind && (
                                                                            <Badge variant="outline" className="text-[9px] uppercase font-bold !border-blue-200 !bg-blue-50 !text-blue-700">
                                                                                {CONTENT_KIND_LABELS[action.contentKind as ContentKind] || action.contentKind}
                                                                            </Badge>
                                                                        )}
                                                                        {action.executionClass && (
                                                                            <Badge variant="outline" className={`text-[9px] uppercase font-bold ${
                                                                                action.executionClass === 'routing_ready'
                                                                                    ? '!border-emerald-200 !bg-emerald-50 !text-emerald-700'
                                                                                    : action.executionClass === 'non_digital'
                                                                                        ? '!border-purple-200 !bg-purple-50 !text-purple-700'
                                                                                        : '!border-slate-300 !bg-slate-100 !text-slate-700'
                                                                            }`}>
                                                                                {getExecutionClassLabel(action.executionClass)}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-sm font-extrabold text-slate-800">
                                                                        {action.title || getActionTypeLabel(action.type)}
                                                                    </p>
                                                                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                                                        {action.body}
                                                                    </p>
                                                                    <div className="pt-2 flex items-start gap-2">
                                                                        <Lightbulb className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                                                        <p className="text-xs text-slate-500 font-medium">
                                                                            {action.reasoning}
                                                                        </p>
                                                                    </div>
                                                                    {action.strategicAlignment && (
                                                                        <div className="pt-1 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1">
                                                                            <span className="font-semibold">Allineamento strategico:</span> {action.strategicAlignment}
                                                                        </div>
                                                                    )}
                                                                    {Array.isArray(action.evidence) && action.evidence.length > 0 && (
                                                                        <div className="pt-1 space-y-1">
                                                                            <p className="text-[11px] font-semibold text-slate-600">Evidenze e fonti</p>
                                                                            {action.evidence.slice(0, 3).map((ev, evIdx) => (
                                                                                <div key={`${ev.sourceRef}-${evIdx}`} className="text-[11px] text-slate-600 bg-slate-100 rounded-lg px-2 py-1">
                                                                                    <span className="font-semibold">{ev.sourceType}</span> · {ev.sourceRef}: {ev.detail}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {action.coordination && (
                                                                        <div className="pt-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
                                                                            <span className="font-semibold">Coordinamento multicanale:</span> {action.coordination}
                                                                        </div>
                                                                    )}
                                                                    {action.lifecycleHistory && (
                                                                        <div className="pt-1 text-[11px] text-slate-500 font-medium">
                                                                            Storico tipologia: bozze {action.lifecycleHistory.draftReady} · inviate {action.lifecycleHistory.sent} · scartate {action.lifecycleHistory.discarded}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {(canApply || canManageTip) && (
                                                                    <div className="flex items-center gap-2 md:pt-1">
                                                                        {canManageTip && (
                                                                            <>
                                                                                {requiresUpgradeForRouting ? (
                                                                                    <div className="flex flex-col items-end gap-1">
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            className="h-9 px-4 rounded-full font-bold text-xs gap-2 border-slate-300 text-slate-500"
                                                                                            disabled
                                                                                        >
                                                                                            <Lock className="h-3.5 w-3.5" />
                                                                                            Routing AI
                                                                                        </Button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={openRoutingUpgrade}
                                                                                            className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-2"
                                                                                        >
                                                                                            Upgrade Business
                                                                                        </button>
                                                                                    </div>
                                                                                ) : routingConnectionLoading ? (
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        className="h-9 px-4 rounded-full font-bold text-xs border-slate-300 text-slate-500"
                                                                                        disabled
                                                                                    >
                                                                                        Verifico...
                                                                                    </Button>
                                                                                ) : requiresProjectSelection ? (
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        className="h-9 px-4 rounded-full font-bold text-xs gap-2 border-amber-200 text-amber-700 hover:border-amber-500 hover:bg-amber-50 transition-all"
                                                                                        onClick={() => router.push('/dashboard/projects')}
                                                                                    >
                                                                                        Seleziona progetto
                                                                                    </Button>
                                                                                ) : requiresRoutingConnection ? (
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        className="h-9 px-4 rounded-full font-bold text-xs gap-2 border-amber-200 text-amber-700 hover:border-amber-500 hover:bg-amber-50 transition-all"
                                                                                        onClick={() => openRoutingConnections(routingProjectId)}
                                                                                    >
                                                                                        Configura connessione
                                                                                    </Button>
                                                                                ) : (
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        className="h-9 px-4 rounded-full font-bold text-xs gap-2 border-blue-200 text-blue-700 hover:border-blue-500 hover:bg-blue-50 transition-all"
                                                                                        onClick={() => handleOpenSuggestionManager(insight, action, actionKey)}
                                                                                        disabled={Boolean(openingSuggestionKey) || updatingInsightId === insight.id}
                                                                                    >
                                                                                        {openingSuggestionKey === actionKey ? 'Apro...' : 'Scopri'}
                                                                                    </Button>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-9 px-4 rounded-full font-bold text-xs gap-2 border-green-200 text-green-700 hover:border-green-500 hover:bg-green-50 group/btn transition-all"
                                                                            onClick={() => handleApplyAction(insight.id, action.title || getActionTypeLabel(action.type))}
                                                                            disabled={updatingInsightId === insight.id || insight.isVirtual}
                                                                        >
                                                                            Applica <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            {!insight.isVirtual ? (
                                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                                    {(status === 'completed' || status === 'archived') ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleInsightStatus(insight.id, 'new')}
                                                            disabled={updatingInsightId === insight.id}
                                                            className="h-8 px-3 rounded-full text-xs"
                                                        >
                                                            Riapri
                                                        </Button>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleInsightStatus(insight.id, 'archived')}
                                                                disabled={updatingInsightId === insight.id}
                                                                className="h-8 px-3 rounded-full text-xs"
                                                            >
                                                                Archivia
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleInsightStatus(insight.id, 'completed')}
                                                                disabled={updatingInsightId === insight.id}
                                                                className="h-8 px-3 rounded-full text-xs"
                                                            >
                                                                Segna completato
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                                                    Tip importato dalla Site Analysis (sola lettura in questa vista).
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
