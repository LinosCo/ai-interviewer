import { TEMPLATES } from '@/lib/onboarding-templates';
import { Icons } from '@/components/ui/business-tuner/Icons';
import Link from 'next/link';

export default function TemplatesPage() {
    return (
        <div className="bg-stone-50 min-h-screen pt-24 pb-20">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-stone-900 mb-6">Template Gallery</h1>
                    <p className="text-xl text-stone-600">
                        Inizia velocemente con modelli testati e ottimizzati per ogni scenario di ricerca.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {TEMPLATES.map((template) => {
                        const Icon = Icons[template.icon as keyof typeof Icons] || Icons.FileText;

                        return (
                            <div key={template.id} className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                                        <Icon size={28} />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-stone-400 bg-stone-100 px-3 py-1.5 rounded-full">
                                        {template.category}
                                    </span>
                                </div>

                                <h3 className="text-2xl font-bold text-stone-900 mb-3">{template.name}</h3>
                                <p className="text-stone-600 mb-8 flex-grow leading-relaxed">
                                    {template.description}
                                </p>

                                <div className="space-y-4 pt-6 border-t border-stone-100">
                                    <h4 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">Cosa scoprirai:</h4>
                                    <ul className="space-y-2">
                                        {template.defaultConfig.topics.slice(0, 3).map((topic, i) => (
                                            <li key={i} className="flex items-center gap-2 text-sm text-stone-500">
                                                <Icons.Check size={14} className="text-amber-500" />
                                                {topic.label}
                                            </li>
                                        ))}
                                        {template.defaultConfig.topics.length > 3 && (
                                            <li className="text-xs text-stone-400 italic">...e molto altro</li>
                                        )}
                                    </ul>
                                </div>

                                <div className="mt-8">
                                    <Link href={`/dashboard/interviews/create?template=${template.id}`}>
                                        <button className="w-full bg-stone-900 text-white font-bold py-4 rounded-2xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2">
                                            Usa questo template <Icons.ArrowRight size={18} />
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Request Template CTA */}
                <div className="mt-20 bg-amber-100 rounded-[2.5rem] p-6 md:p-12 text-center border border-amber-200">
                    <h3 className="text-2xl font-bold text-amber-900 mb-4">Non trovi quello che cerchi?</h3>
                    <p className="text-amber-800 mb-8 max-w-xl mx-auto">
                        Inviaci la tua idea di ricerca e il nostro team di esperti preparerà un template personalizzato per te.
                    </p>
                    <Link href="mailto:businesstuner@voler.ai">
                        <button className="bg-white text-amber-900 font-bold px-8 py-4 rounded-2xl border border-amber-200 hover:bg-amber-50 transition-colors">
                            Richiedi un template
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
