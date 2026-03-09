'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock3,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Mic,
  Sparkles,
  TrendingUp,
  UserPlus,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { UnifiedInsight, UnifiedStats } from '@/lib/analytics/AnalyticsEngine';

interface ProjectAnalyticsProps {
  projectId: string;
  availableBots: { id: string; name: string; botType: string | null }[];
}

interface FilterPillProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function FilterPill({ active, label, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'border-amber-300 bg-amber-50 text-amber-800'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

export default function ProjectAnalytics({ projectId, availableBots }: ProjectAnalyticsProps) {
  const [insights, setInsights] = useState<UnifiedInsight[]>([]);
  const [stats, setStats] = useState<UnifiedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (selectedBotIds.length > 0) {
          queryParams.append('botIds', selectedBotIds.join(','));
        }

        const res = await fetch(`/api/projects/${projectId}/analytics?${queryParams.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const data = await res.json();
        setInsights(data.insights);
        setStats(data.stats);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [projectId, selectedBotIds]);

  const toggleBotFilter = (botId: string) => {
    setSelectedBotIds((prev) =>
      prev.includes(botId)
        ? prev.filter((id) => id !== botId)
        : [...prev, botId],
    );
  };

  const clearFilters = () => setSelectedBotIds([]);

  const analytics = stats || {
    avgSentiment: 0,
    totalMessages: 0,
    completionRate: 0,
    trends: [],
    interviewCount: 0,
    chatbotCount: 0,
    avgNpsScore: null,
    topThemes: [],
    knowledgeGaps: [],
    leadsCaptured: 0,
    avgResponseLength: 0,
  };

  const decisionHeadline = useMemo(() => {
    if (analytics.knowledgeGaps.length > 0) {
      return {
        title: 'Ci sono gap di conoscenza da chiudere',
        description: 'Le conversazioni stanno facendo emergere domande ricorrenti che il progetto non risolve ancora in modo chiaro.',
        action: 'Porta questi gap in Tips o chatbot knowledge.',
      };
    }

    if (analytics.avgSentiment < 55) {
      return {
        title: 'La percezione è fragile',
        description: 'Il sentiment combinato indica attrito: serve un messaggio più chiaro o un contenuto correttivo ad alta priorità.',
        action: 'Apri Tips e cerca i temi con maggiore frizione.',
      };
    }

    if (analytics.completionRate < 45) {
      return {
        title: 'Il volume c’è, la conversione meno',
        description: 'Le conversazioni partono ma non arrivano abbastanza spesso a un esito utile.',
        action: 'Rivedi il flusso di risposta e la qualità delle CTA.',
      };
    }

    return {
      title: 'Il progetto sta generando segnali leggibili',
      description: 'Le metriche principali sono abbastanza coerenti da poter passare dalla lettura all’attivazione.',
      action: 'Usa le analytics per scegliere la prossima priorità operativa.',
    };
  }, [analytics.avgSentiment, analytics.completionRate, analytics.knowledgeGaps.length]);

  const topPriorityCards = useMemo(() => {
    return [
      {
        label: 'Ascolto',
        value: `${analytics.interviewCount + analytics.chatbotCount}`,
        helper: 'fonti attive',
        tone: 'border-blue-200 bg-blue-50',
        icon: MessageSquare,
      },
      {
        label: 'Misura',
        value: `${analytics.avgSentiment.toFixed(0)}/100`,
        helper: 'reputazione combinata',
        tone: 'border-amber-200 bg-amber-50',
        icon: TrendingUp,
      },
      {
        label: 'Attivazione',
        value: `${analytics.leadsCaptured}`,
        helper: 'lead catturati',
        tone: 'border-emerald-200 bg-emerald-50',
        icon: UserPlus,
      },
    ];
  }, [analytics.avgSentiment, analytics.chatbotCount, analytics.interviewCount, analytics.leadsCaptured]);

  const operatingLanes = useMemo(() => {
    return [
      {
        title: 'Dove ascoltare meglio',
        description: analytics.topThemes.length > 0
          ? `Tema più forte: ${analytics.topThemes[0].name}.`
          : 'Le fonti stanno ancora producendo pochi pattern consolidati.',
        nextMove: 'Controlla se il tema entra in Tips con una decisione canonica.',
        icon: Mic,
      },
      {
        title: 'Dove servono nuovi tip',
        description: analytics.knowledgeGaps.length > 0
          ? `${analytics.knowledgeGaps.length} gap da trasformare in contenuti o FAQ.`
          : 'Non emergono gap urgenti: puoi lavorare su amplificazione e reuse.',
        nextMove: 'Rivedi Tips e scegli cosa ha impatto più rapido.',
        icon: Lightbulb,
      },
      {
        title: 'Dove misurare il prossimo impatto',
        description: analytics.completionRate < 45
          ? 'Il completion rate è il collo di bottiglia più evidente.'
          : 'La metrica più utile adesso è la qualità del traffico generato.',
        nextMove: 'Confronta il trend e poi spingi in Esecuzione i tip maturi.',
        icon: Clock3,
      },
    ];
  }, [analytics.completionRate, analytics.knowledgeGaps.length, analytics.topThemes]);

  if (loading && !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-40 animate-pulse rounded-[2rem] bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(135deg,#fffdf8_0%,#ffffff_55%,#f8fafc_100%)] shadow-sm">
        <CardContent className="space-y-6 p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
                <Sparkles className="h-3.5 w-3.5" />
                Lettura strategica
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">{decisionHeadline.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{decisionHeadline.description}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Prossima mossa:</span> {decisionHeadline.action}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {availableBots.map((bot) => (
                <FilterPill
                  key={bot.id}
                  active={selectedBotIds.includes(bot.id)}
                  label={bot.name}
                  onClick={() => toggleBotFilter(bot.id)}
                />
              ))}
              {selectedBotIds.length > 0 ? (
                <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={clearFilters}>
                  Reset filtri
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {topPriorityCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className={`rounded-[1.75rem] border p-4 ${card.tone}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{card.value}</p>
                      <p className="mt-1 text-xs text-slate-600">{card.helper}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-3 text-slate-700">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        {operatingLanes.map((lane) => {
          const Icon = lane.icon;
          return (
            <Card key={lane.title} className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <Icon className="h-4 w-4" />
                  <CardTitle className="text-base font-bold">{lane.title}</CardTitle>
                </div>
                <CardDescription className="text-sm leading-6 text-slate-600">
                  {lane.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-semibold text-slate-800">{lane.nextMove}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-black text-slate-900">Trend di qualità</CardTitle>
            <CardDescription>Osserva insieme sentiment e volume per capire se il progetto sta migliorando o semplicemente parlando di più.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.trends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="sentiment"
                    name="Sentiment"
                    stroke="#d97706"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.trends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="volume" name="Conversazioni" fill="#0f172a" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-black text-slate-900">Rischi e opportunità immediate</CardTitle>
            <CardDescription>Questa sezione evidenzia cosa può bloccare o accelerare il loop nel breve.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.knowledgeGaps.length > 0 ? (
              analytics.knowledgeGaps.slice(0, 4).map((gap, index) => (
                <div key={`${gap}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{gap}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Non emergono gap critici: puoi usare Tips ed Esecuzione per spingere la distribuzione.
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Completion rate</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{analytics.completionRate.toFixed(1)}%</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">NPS medio</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {analytics.avgNpsScore !== null ? analytics.avgNpsScore.toFixed(0) : 'N/D'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-black text-slate-900">Temi che stanno guidando il progetto</CardTitle>
            <CardDescription>Usa questi temi per capire quali tip promuovere e quali contenuti collegati mancano.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.topThemes.length > 0 ? (
              analytics.topThemes.map((theme, index) => (
                <div key={`${theme.name}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{theme.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{theme.count} menzioni</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {theme.sentiment > 0 ? '+' : ''}{(theme.sentiment * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Temi ancora troppo deboli per una lettura consolidata.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-black text-slate-900">Suggerimenti strategici da portare nel loop</CardTitle>
            <CardDescription>Questi insight aiutano a decidere quali tip rivedere o quali esecuzioni preparare adesso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length > 0 ? (
              insights.map((insight, index) => {
                const Icon = insight.source === 'CHATBOT' ? Bot : insight.source === 'INTERVIEW' ? Mic : HelpCircle;
                return (
                  <div key={`${insight.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl bg-white p-3 text-slate-700">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{insight.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{insight.description}</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {insight.source}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                      <p className="text-xs text-slate-500">{insight.reasoning}</p>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                        Porta in Tips
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">Nessun insight strategico disponibile per i filtri attuali.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Messaggi</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{analytics.totalMessages.toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-500">volume osservato</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Chatbot</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{analytics.chatbotCount}</p>
            <p className="mt-1 text-xs text-slate-500">bot coinvolti</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Interviste</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{analytics.interviewCount}</p>
            <p className="mt-1 text-xs text-slate-500">sessioni considerate</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Lead</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{analytics.leadsCaptured}</p>
            <p className="mt-1 text-xs text-slate-500">opportunità tracciate</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
