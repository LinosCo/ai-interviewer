'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, ArrowUpRight } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string;
  url: string;
}

interface LandingNewsResponse {
  items?: NewsItem[];
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function NewsSection() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadNews() {
      try {
        const res = await fetch('/api/public/landing-news?limit=6', {
          signal: controller.signal,
          cache: 'no-store'
        });
        if (!res.ok) return;
        const data = (await res.json()) as LandingNewsResponse;
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        // Silent failure: section remains hidden.
      } finally {
        setLoading(false);
      }
    }

    loadNews();

    return () => controller.abort();
  }, []);

  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <section id="news" className="pt-8 pb-24 md:pt-12 md:pb-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[hsl(var(--amber)/0.05)] to-white" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--amber)/0.18)] border border-[hsl(var(--amber)/0.3)] mb-6">
            <Newspaper className="w-4 h-4 text-[hsl(var(--amber))]" />
            <span className="text-sm font-medium text-[hsl(var(--amber))]">News</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-[hsl(var(--foreground))]">
            Aggiornamenti pubblicati con <span className="gradient-text">AI Tips</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-3xl mx-auto">
            Contenuti editoriali della landing Business Tuner generati dai suggerimenti AI, modificati e pubblicati dal team.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`news-loading-${index}`}
                  className="rounded-2xl border border-[hsl(var(--border)/0.7)] bg-white/80 p-5 animate-pulse h-[210px]"
                />
              ))
            : items.map((item, index) => (
                <motion.a
                  key={item.id}
                  id={`news-${item.slug}`}
                  href={item.url}
                  target={item.url.startsWith('http') ? '_blank' : undefined}
                  rel={item.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="group rounded-2xl border border-[hsl(var(--border)/0.75)] bg-white/90 hover:bg-white p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="text-xs uppercase tracking-wider text-[hsl(var(--amber))] font-semibold mb-3">
                    {formatDate(item.publishedAt)}
                  </div>
                  <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] leading-snug mb-3">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed line-clamp-4">
                    {item.excerpt}
                  </p>
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--coral))]">
                    Leggi
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </motion.a>
              ))}
        </div>
      </div>
    </section>
  );
}

