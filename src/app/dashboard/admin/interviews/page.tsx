import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { getInterviewQualityDashboardData } from '@/lib/interview/quality-dashboard';

type PageProps = {
    searchParams?: {
        windowHours?: string;
        refresh?: string;
    };
};

function parseWindowHours(raw?: string): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return 24;
    return Math.min(168, Math.max(1, Math.floor(parsed)));
}

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

function deltaLabel(value: number | null): string {
    if (value === null) return 'n/a';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}`;
}

function parseBooleanFlag(raw?: string): boolean {
    if (!raw) return false;
    const normalized = raw.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export default async function AdminInterviewQualityPage({ searchParams }: PageProps) {
    const session = await auth();
    const userEmail = session?.user?.email;

    if (!userEmail) redirect('/login');

    const currentUser = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { role: true }
    });

    if (currentUser?.role !== 'ADMIN') {
        return <div className="p-8">Access Denied</div>;
    }

    const windowHours = parseWindowHours(searchParams?.windowHours);
    const refreshAi = parseBooleanFlag(searchParams?.refresh);
    const data = await getInterviewQualityDashboardData({
        windowHours,
        maxTurns: 5000,
        includeAiReview: refreshAi
    });

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Qualita Interviste (Admin)</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Monitoraggio quality gate, flow guard e trend senza impatto sul path runtime.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {[24, 48, 72, 168].map(hours => (
                        <Link
                            key={hours}
                            href={`/dashboard/admin/interviews?windowHours=${hours}${refreshAi ? '&refresh=1' : ''}`}
                            className={`px-3 py-1.5 rounded-lg text-sm border ${
                                windowHours === hours
                                    ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold'
                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {hours}h
                        </Link>
                    ))}
                    <Link
                        href={`/dashboard/admin/interviews?windowHours=${windowHours}&refresh=1`}
                        className="px-3 py-1.5 rounded-lg text-sm border bg-slate-900 border-slate-900 text-white hover:bg-slate-800"
                    >
                        Aggiorna Report AI
                    </Link>
                    {refreshAi && (
                        <Link
                            href={`/dashboard/admin/interviews?windowHours=${windowHours}`}
                            className="px-3 py-1.5 rounded-lg text-sm border bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                            Vista Rapida
                        </Link>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                <MetricCard title="Pass Rate" value={formatPercent(data.current.passRate)} subtitle={`delta ${deltaLabel(data.delta.passRate * 100)} pt`} />
                <MetricCard title="Avg Score" value={data.current.avgScore === null ? 'n/a' : `${data.current.avgScore}/100`} subtitle={`delta ${deltaLabel(data.delta.avgScore)}`} />
                <MetricCard title="Gate Trigger" value={formatPercent(data.current.gateTriggerRate)} subtitle={`delta ${deltaLabel(data.delta.gateTriggerRate * 100)} pt`} />
                <MetricCard title="Fallback Rate" value={formatPercent(data.current.fallbackRate)} subtitle={`delta ${deltaLabel(data.delta.fallbackRate * 100)} pt`} />
                <MetricCard title="Telemetry Coverage" value={formatPercent(data.current.telemetryCoverage)} subtitle={`${data.current.telemetryTurns}/${data.current.assistantTurns} turni`} />
                <MetricCard title="Completion Guard" value={formatPercent(data.current.completionGuardRate)} subtitle={`${data.current.completionGuardIntercepts} intercetti`} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {refreshAi && data.aiReview && (
                    <div className="xl:col-span-3 bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <h2 className="text-sm font-semibold text-gray-900">Analisi AI su refresh manuale</h2>
                            <span className={`text-xs px-2 py-1 rounded ${
                                data.aiReview.generated
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                            }`}>
                                {data.aiReview.generated ? `Model: ${data.aiReview.model}` : 'AI non disponibile'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-700">{data.aiReview.summary}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                            <div>
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Priorita</p>
                                {data.aiReview.priorities.length === 0 ? (
                                    <p className="text-sm text-gray-500">Nessuna priorita suggerita.</p>
                                ) : (
                                    <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                                        {data.aiReview.priorities.map((priority, idx) => (
                                            <li key={`${priority}-${idx}`}>{priority}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Rischi</p>
                                {data.aiReview.risks.length === 0 ? (
                                    <p className="text-sm text-gray-500">Nessun rischio evidenziato.</p>
                                ) : (
                                    <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                                        {data.aiReview.risks.map((risk, idx) => (
                                            <li key={`${risk}-${idx}`}>{risk}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-gray-900 mb-3">Alert</h2>
                    {data.alerts.length === 0 ? (
                        <div className="flex items-center gap-2 text-emerald-700 text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            Nessun alert nella finestra selezionata.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {data.alerts.map(alert => (
                                <div
                                    key={alert.id}
                                    className={`rounded-lg border p-3 text-sm ${
                                        alert.severity === 'critical'
                                            ? 'bg-red-50 border-red-200 text-red-900'
                                            : alert.severity === 'warning'
                                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                                : 'bg-blue-50 border-blue-200 text-blue-900'
                                    }`}
                                >
                                    <div className="font-semibold">{alert.title}</div>
                                    <p className="mt-1">{alert.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-gray-900 mb-3">Flow Guard</h2>
                    <div className="space-y-2 text-sm">
                        <GuardRow label="Topic closure intercettate" value={data.current.topicClosureIntercepts} />
                        <GuardRow label="Deep-offer closure intercettate" value={data.current.deepOfferClosureIntercepts} />
                        <GuardRow label="Completion bloccate (consent)" value={data.current.completionBlockedForConsent} />
                        <GuardRow label="Completion bloccate (field)" value={data.current.completionBlockedForMissingField} />
                        <GuardRow label="Turni valutati quality" value={data.current.evaluatedTurns} />
                    </div>
                    {(data.current.truncated || data.previous.truncated) && (
                        <div className="mt-3 text-xs text-amber-700 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Campione troncato al limite di query ({data.maxTurns} turni/finestra).
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-4 h-4 text-gray-600" />
                    <h2 className="text-sm font-semibold text-gray-900">Bot con risultati peggiori</h2>
                </div>
                {data.topFailingBots.length === 0 ? (
                    <p className="text-sm text-gray-500">Nessun bot con campione sufficiente nella finestra selezionata.</p>
                ) : (
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-gray-500 border-b border-gray-200">
                                <tr>
                                    <th className="py-2 pr-3">Bot</th>
                                    <th className="py-2 pr-3">Organizzazione</th>
                                    <th className="py-2 pr-3">Pass Rate</th>
                                    <th className="py-2 pr-3">Avg Score</th>
                                    <th className="py-2 pr-3">Gate Trigger</th>
                                    <th className="py-2 pr-3">Fallback</th>
                                    <th className="py-2 pr-3">Turni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.topFailingBots.map(bot => (
                                    <tr key={bot.botId} className="border-b border-gray-100">
                                        <td className="py-2 pr-3 text-gray-900 font-medium">{bot.botName}</td>
                                        <td className="py-2 pr-3 text-gray-600">{bot.organizationName || 'N/A'}</td>
                                        <td className="py-2 pr-3">{formatPercent(bot.passRate)}</td>
                                        <td className="py-2 pr-3">{bot.avgScore === null ? 'n/a' : `${bot.avgScore}/100`}</td>
                                        <td className="py-2 pr-3">{formatPercent(bot.gateTriggerRate)}</td>
                                        <td className="py-2 pr-3">{formatPercent(bot.fallbackRate)}</td>
                                        <td className="py-2 pr-3 text-gray-600">{bot.evaluatedTurns}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
    );
}

function GuardRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-gray-600">{label}</span>
            <span className="font-semibold text-gray-900">{value}</span>
        </div>
    );
}
