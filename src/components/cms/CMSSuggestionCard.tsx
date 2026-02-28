'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FileText, Send, CheckCircle, Clock,
  TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  RefreshCw, X, AlertCircle, ThumbsUp, ThumbsDown,
  Share2, Linkedin, Facebook, Instagram
} from 'lucide-react';

type SocialOption = {
  label: string;
  platform: string;
  format?: string;
  icon: typeof Linkedin;
};

const SOCIAL_OPTIONS: SocialOption[] = [
  { label: 'LinkedIn Article', platform: 'linkedin', format: 'article', icon: Linkedin },
  { label: 'LinkedIn Carousel', platform: 'linkedin', format: 'carousel', icon: Linkedin },
  { label: 'Facebook Post', platform: 'facebook', icon: Facebook },
  { label: 'Instagram Caption', platform: 'instagram', icon: Instagram },
];

interface CMSSuggestionCardProps {
  suggestion: {
    id: string;
    title: string;
    body: string;
    targetSection: string | null;
    type: string;
    status: string;
    priorityScore: number;
    reasoning: string;
    createdAt: string;
    publishedAt: string | null;
    performanceBefore: any;
    performanceAfter: any;
    userFeedback?: string | null;
  };
  connectionId: string;
  projectId?: string;
  showPushButton?: boolean;
  showSocialButton?: boolean;
  showStatus?: boolean;
  showPerformance?: boolean;
  onPushSuccess?: () => void;
}

export function CMSSuggestionCard({
  suggestion,
  connectionId,
  projectId,
  showPushButton,
  showSocialButton,
  showStatus,
  showPerformance,
  onPushSuccess
}: CMSSuggestionCardProps) {
  const [isPushing, setIsPushing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pushResult, setPushResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(suggestion.userFeedback ?? null);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [showSocialMenu, setShowSocialMenu] = useState(false);
  const [socialDispatching, setSocialDispatching] = useState(false);
  const [socialResult, setSocialResult] = useState<{ platform: string; label: string } | null>(null);
  const socialMenuRef = useRef<HTMLDivElement>(null);

  // Close social dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (socialMenuRef.current && !socialMenuRef.current.contains(e.target as Node)) {
        setShowSocialMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePush = async () => {
    setIsPushing(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/cms/suggestions/${suggestion.id}/push`, {
        method: 'POST'
      });

      const data = await res.json();

      if (res.ok) {
        setPushResult('success');
        onPushSuccess?.();
      } else {
        setPushResult('error');
        setErrorMessage(data.error || 'Errore durante l\'invio');
      }
    } catch (error) {
      setPushResult('error');
      setErrorMessage('Errore di connessione');
    } finally {
      setIsPushing(false);
    }
  };

  const handleFeedback = async (value: 'UP' | 'DOWN') => {
    if (isSendingFeedback) return;
    setIsSendingFeedback(true);

    // Optimistic update
    const prev = feedback;
    setFeedback(value === feedback ? null : value);

    try {
      const res = await fetch(`/api/cms/suggestions/${suggestion.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: value })
      });

      if (!res.ok) {
        setFeedback(prev); // rollback on error
      } else {
        const data = await res.json();
        setFeedback(data.userFeedback);
      }
    } catch {
      setFeedback(prev);
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const handleSocialDispatch = async (option: SocialOption) => {
    if (!projectId) return;
    setShowSocialMenu(false);
    setSocialDispatching(true);

    try {
      const res = await fetch('/api/integrations/n8n/social-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId: suggestion.id,
          platform: option.platform,
          linkedInFormat: option.format,
        }),
      });

      if (res.ok) {
        setSocialResult({ platform: option.platform, label: option.label });
      } else {
        const data = await res.json();
        setErrorMessage(data.error || 'Errore invio social');
        setPushResult('error');
      }
    } catch {
      setErrorMessage('Errore di connessione');
      setPushResult('error');
    } finally {
      setSocialDispatching(false);
    }
  };

  const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
    PENDING: { color: 'bg-amber-100 text-amber-700', icon: Clock, label: 'In attesa' },
    PUSHED: { color: 'bg-blue-100 text-blue-700', icon: Send, label: 'Inviato al CMS' },
    PUBLISHED: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Pubblicato' },
    REJECTED: { color: 'bg-red-100 text-red-700', icon: X, label: 'Rifiutato' },
    FAILED: { color: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'Errore' }
  };

  const statusBadge = statusConfig[suggestion.status] || statusConfig.PENDING;
  const StatusIcon = statusBadge.icon;

  const typeLabels: Record<string, string> = {
    CREATE_PAGE: 'Nuova Pagina',
    CREATE_FAQ: 'FAQ',
    CREATE_BLOG_POST: 'Blog Post',
    MODIFY_CONTENT: 'Modifica',
    ADD_SECTION: 'Nuova Sezione'
  };

  // Calcola delta performance
  const performanceDelta = showPerformance &&
    suggestion.performanceBefore &&
    suggestion.performanceAfter
    ? {
        bounceRate: suggestion.performanceAfter.avgBounceRate - suggestion.performanceBefore.avgBounceRate,
        pageviews: suggestion.performanceBefore.pageviews > 0
          ? ((suggestion.performanceAfter.pageviews - suggestion.performanceBefore.pageviews) /
              suggestion.performanceBefore.pageviews) * 100
          : 0
      }
    : null;

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {showStatus && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusBadge.color}`}>
                <StatusIcon className="w-3 h-3" />
                {statusBadge.label}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(suggestion.priorityScore)}`}>
              Priorita: {suggestion.priorityScore}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
              {typeLabels[suggestion.type] || suggestion.type}
            </span>
            {suggestion.targetSection && (
              <span className="text-xs text-gray-400 font-mono">
                {suggestion.targetSection}
              </span>
            )}
          </div>
          <h3 className="font-medium text-gray-900">{suggestion.title}</h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {suggestion.reasoning}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {showPushButton && pushResult !== 'success' && suggestion.status === 'PENDING' && (
            <button
              onClick={handlePush}
              disabled={isPushing}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isPushing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Invia al CMS
            </button>
          )}

          {pushResult === 'success' && (
            <span className="flex items-center gap-1 text-emerald-600 text-sm whitespace-nowrap">
              <CheckCircle className="w-4 h-4" />
              Inviato
            </span>
          )}

          {/* Social dispatch button — only when suggestion is PENDING and projectId is set */}
          {showSocialButton && projectId && suggestion.status === 'PENDING' && !socialResult && (
            <div className="relative" ref={socialMenuRef}>
              <button
                onClick={() => setShowSocialMenu(v => !v)}
                disabled={socialDispatching}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 hover:border-gray-400 text-gray-700 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {socialDispatching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                Social
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showSocialMenu && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                  {SOCIAL_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={`${opt.platform}-${opt.format ?? 'default'}`}
                        onClick={() => handleSocialDispatch(opt)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                      >
                        <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {socialResult && (
            <span className="flex items-center gap-1 text-blue-600 text-xs whitespace-nowrap">
              <CheckCircle className="w-3.5 h-3.5" />
              Inviato ({socialResult.label})
            </span>
          )}
        </div>
      </div>

      {/* Error message */}
      {pushResult === 'error' && errorMessage && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {errorMessage}
        </div>
      )}

      {/* Performance delta */}
      {performanceDelta && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4">
          <div className="flex items-center gap-1">
            {performanceDelta.bounceRate < 0 ? (
              <TrendingDown className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingUp className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-sm ${performanceDelta.bounceRate < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {performanceDelta.bounceRate > 0 ? '+' : ''}{(performanceDelta.bounceRate * 100).toFixed(0)}% bounce
            </span>
          </div>
          <div className="flex items-center gap-1">
            {performanceDelta.pageviews > 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-sm ${performanceDelta.pageviews > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {performanceDelta.pageviews > 0 ? '+' : ''}{performanceDelta.pageviews.toFixed(0)}% visite
            </span>
          </div>
        </div>
      )}

      {/* Expand content button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-3 text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
      >
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {isExpanded ? 'Nascondi contenuto' : 'Mostra contenuto'}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
            {suggestion.body}
          </pre>
        </div>
      )}

      {/* Footer: timestamp + feedback */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-gray-400">
          Creato: {new Date(suggestion.createdAt).toLocaleString('it-IT')}
          {suggestion.publishedAt && (
            <span className="ml-3">
              Pubblicato: {new Date(suggestion.publishedAt).toLocaleString('it-IT')}
            </span>
          )}
        </div>

        {/* Thumbs feedback */}
        <div className="flex items-center gap-1" title="Questo suggerimento è utile?">
          <button
            onClick={() => handleFeedback('UP')}
            disabled={isSendingFeedback}
            aria-label="Utile"
            className={`p-1.5 rounded transition-colors disabled:opacity-40 ${
              feedback === 'UP'
                ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleFeedback('DOWN')}
            disabled={isSendingFeedback}
            aria-label="Non utile"
            className={`p-1.5 rounded transition-colors disabled:opacity-40 ${
              feedback === 'DOWN'
                ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
            }`}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function getPriorityColor(score: number): string {
  if (score >= 80) return 'bg-red-100 text-red-800';
  if (score >= 60) return 'bg-orange-100 text-orange-800';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}
