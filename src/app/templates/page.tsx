import Link from 'next/link';
import { templates } from '@/lib/templates';
import { ArrowRight, Sparkles } from 'lucide-react';

export const metadata = {
    title: 'Template | voler.AI',
    description: 'Libreria di template per interviste qualitative. Inizia subito con un template pre-configurato.',
};

export default function TemplatesPage() {
    const categories = [
        { id: 'product', name: 'Product', icon: '💡' },
        { id: 'hr', name: 'HR', icon: '👥' },
        { id: 'sales', name: 'Sales', icon: '📈' },
        { id: 'operations', name: 'Operations', icon: '⚙️' },
        { id: 'strategy', name: 'Strategy', icon: '🎯' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="p-6 border-b border-white/10">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <Link href="/" className="text-2xl font-bold text-white">
                        voler.AI
                    </Link>
                    <div className="flex gap-4">
                        <Link
                            href="/login"
                            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                        >
                            Accedi
                        </Link>
                        <Link
                            href="/onboarding"
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                        >
                            Inizia gratis
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6 py-12">
                {/* Hero */}
                <div className="text-center space-y-4 mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-white">
                        Template per ogni esigenza
                    </h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                        Inizia rapidamente con un template pre-configurato. Ogni template include domande,
                        topic e best practice per il tuo caso d'uso specifico.
                    </p>
                </div>

                {/* Categories Filter */}
                <div className="flex flex-wrap justify-center gap-3 mb-12">
                    <button className="px-4 py-2 bg-purple-600 text-white rounded-full text-sm font-medium">
                        Tutti
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-full text-sm font-medium transition-colors"
                        >
                            {cat.icon} {cat.name}
                        </button>
                    ))}
                </div>

                {/* Templates Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template) => (
                        <Link
                            key={template.id}
                            href={`/onboarding/generate?template=${template.slug}`}
                            className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-2xl p-6 transition-all"
                        >
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <span className="text-4xl">{template.icon}</span>
                                    <span className="px-2 py-1 text-xs bg-white/10 rounded text-slate-400 capitalize">
                                        {template.category}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white group-hover:text-purple-300 transition-colors">
                                        {template.name}
                                    </h3>
                                    <p className="text-slate-400 mt-2 line-clamp-2">
                                        {template.description}
                                    </p>
                                </div>
                                <div className="pt-4 border-t border-white/10">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">
                                            {template.defaultConfig.topics.length} topic •
                                            ~{template.defaultConfig.maxDurationMins} min
                                        </span>
                                        <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}

                    {/* Custom CTA Card */}
                    <Link
                        href="/onboarding"
                        className="group bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 hover:border-purple-500/50 rounded-2xl p-6 transition-all flex flex-col justify-center items-center text-center"
                    >
                        <Sparkles className="w-12 h-12 text-purple-400 mb-4" />
                        <h3 className="text-xl font-semibold text-white">
                            Crea il tuo template
                        </h3>
                        <p className="text-slate-400 mt-2">
                            Descrivi il tuo obiettivo e l'AI genererà l'intervista perfetta
                        </p>
                    </Link>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/10 p-6 mt-12">
                <div className="max-w-6xl mx-auto text-center text-slate-500 text-sm">
                    © 2024 voler.AI - Tutti i diritti riservati
                </div>
            </footer>
        </div>
    );
}
