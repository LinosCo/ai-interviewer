import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Template Interviste',
    description: 'Template pronti per raccogliere feedback da clienti, dipendenti e stakeholder. Inizia in 2 minuti.',
};

const TEMPLATES = [
    {
        category: 'Clienti B2B',
        icon: '🏢',
        templates: [
            {
                slug: 'customer-satisfaction',
                name: 'Customer Satisfaction',
                description: 'Capire il livello di soddisfazione e raccogliere feedback strutturato.',
                duration: '10 min',
                questions: 8,
            },
            {
                slug: 'churn-analysis',
                name: 'Churn Analysis',
                description: 'Capire perché i clienti non riordinano o abbandonano.',
                duration: '12 min',
                questions: 10,
            },
            {
                slug: 'win-loss',
                name: 'Win/Loss Analysis',
                description: 'Analizzare perché si vincono o perdono le trattative.',
                duration: '15 min',
                questions: 12,
            },
            {
                slug: 'nps-qualitativo',
                name: 'NPS Qualitativo',
                description: 'Andare oltre il numero: capire il perché del punteggio.',
                duration: '8 min',
                questions: 6,
            },
        ],
    },
    {
        category: 'Clienti B2C',
        icon: '🛒',
        templates: [
            {
                slug: 'product-feedback',
                name: 'Product Feedback',
                description: 'Raccogliere opinioni dettagliate su prodotti o servizi.',
                duration: '10 min',
                questions: 8,
            },
            {
                slug: 'customer-journey',
                name: 'Customer Journey',
                description: 'Mappare l\'esperienza del cliente dall\'inizio alla fine.',
                duration: '12 min',
                questions: 10,
            },
            {
                slug: 'concept-testing',
                name: 'Concept Testing',
                description: 'Validare nuove idee prima di investire nello sviluppo.',
                duration: '10 min',
                questions: 8,
            },
            {
                slug: 'brand-perception',
                name: 'Brand Perception',
                description: 'Capire come il brand viene percepito dal mercato.',
                duration: '10 min',
                questions: 8,
            },
        ],
    },
    {
        category: 'Risorse Umane',
        icon: '👥',
        templates: [
            {
                slug: 'exit-interview',
                name: 'Exit Interview',
                description: 'Capire le vere ragioni di chi lascia l\'azienda.',
                duration: '15 min',
                questions: 12,
            },
            {
                slug: 'onboarding-check',
                name: 'Onboarding Check',
                description: 'Verificare l\'esperienza dei nuovi assunti a 30/60/90 giorni.',
                duration: '10 min',
                questions: 8,
            },
            {
                slug: 'clima-aziendale',
                name: 'Clima Aziendale',
                description: 'Misurare il sentiment e identificare aree di miglioramento.',
                duration: '12 min',
                questions: 10,
            },
            {
                slug: 'feedback-manager',
                name: 'Feedback su Manager',
                description: 'Raccogliere feedback anonimo sulla leadership.',
                duration: '10 min',
                questions: 8,
            },
        ],
    },
    {
        category: 'Operations',
        icon: '⚙️',
        templates: [
            {
                slug: 'supplier-feedback',
                name: 'Supplier Feedback',
                description: 'Migliorare la relazione con i fornitori.',
                duration: '10 min',
                questions: 8,
            },
            {
                slug: 'post-progetto',
                name: 'Post-Progetto',
                description: 'Retrospettiva strutturata a fine progetto.',
                duration: '12 min',
                questions: 10,
            },
            {
                slug: 'process-improvement',
                name: 'Process Improvement',
                description: 'Identificare inefficienze e raccogliere idee.',
                duration: '10 min',
                questions: 8,
            },
            {
                slug: 'partner-satisfaction',
                name: 'Partner Satisfaction',
                description: 'Valutare la soddisfazione dei partner commerciali.',
                duration: '10 min',
                questions: 8,
            },
        ],
    },
];

export default function TemplatesPage() {
    return (
        <div className="py-16">
            <div className="max-w-6xl mx-auto px-6">
                {/* Header */}
                <div className="text-center mb-16">
                    <span className="text-amber-600 text-sm font-medium uppercase tracking-wider">Template</span>
                    <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mt-4 mb-6">
                        Inizia con un template pronto
                    </h1>
                    <p className="text-xl text-stone-600 max-w-2xl mx-auto">
                        Scegli il template più adatto al tuo obiettivo. 
                        Puoi personalizzarlo o usarlo così com'è.
                    </p>
                </div>

                {/* Template Categories */}
                <div className="space-y-16">
                    {TEMPLATES.map((category) => (
                        <div key={category.category}>
                            <div className="flex items-center gap-3 mb-8">
                                <span className="text-3xl">{category.icon}</span>
                                <h2 className="text-2xl font-bold text-stone-900">{category.category}</h2>
                            </div>

                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {category.templates.map((template) => (
                                    <Link
                                        key={template.slug}
                                        href={`/onboarding?template=${template.slug}`}
                                        className="group bg-white rounded-xl p-6 border border-stone-200 hover:border-amber-300 hover:shadow-lg transition-all"
                                    >
                                        <h3 className="font-semibold text-stone-900 mb-2 group-hover:text-amber-600 transition-colors">
                                            {template.name}
                                        </h3>
                                        <p className="text-sm text-stone-600 mb-4 leading-relaxed">
                                            {template.description}
                                        </p>
                                        <div className="flex items-center gap-4 text-xs text-stone-500">
                                            <span className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {template.duration}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {template.questions} domande
                                            </span>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-stone-100">
                                            <span className="text-sm font-medium text-amber-600 group-hover:text-amber-700">
                                                Usa questo template →
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="mt-20 text-center bg-gradient-to-br from-stone-100 to-stone-50 rounded-3xl p-12">
                    <h3 className="text-2xl font-bold text-stone-900 mb-4">
                        Non trovi quello che cerchi?
                    </h3>
                    <p className="text-stone-600 mb-8 max-w-lg mx-auto">
                        Descrivi il tuo obiettivo e Business Tuner creerà un'intervista personalizzata in pochi secondi.
                    </p>
                    <Link
                        href="/onboarding"
                        className="inline-flex items-center gap-2 bg-stone-900 text-white px-8 py-4 rounded-full font-medium hover:bg-stone-800 transition-all"
                    >
                        Crea intervista personalizzata
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </Link>
                </div>
            </div>
        </div>
    );
}
