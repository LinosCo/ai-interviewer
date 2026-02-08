'use client';

import { TEMPLATES } from '@/lib/onboarding-templates';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { colors } from '@/lib/design-system';
import Link from 'next/link';

export default function DashboardTemplatesPage() {
    return (
        <div className="pb-10">
            <div className="mb-10">
                <h1 className="text-3xl font-bold text-stone-900 mb-2">Libreria Template</h1>
                <p className="text-stone-600">
                    Scegli un punto di partenza ottimizzato per raccogliere insight di qualità immediatamente.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {TEMPLATES.map((template) => {
                    const Icon = Icons[template.icon as keyof typeof Icons] || Icons.FileText;

                    return (
                        <div key={template.id} className="bg-white/80 backdrop-blur-md rounded-[24px] p-6 border border-white/50 shadow-sm hover:shadow-md transition-all flex flex-col h-full group">
                            <div className="flex items-center justify-between mb-5">
                                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                                    <Icon size={24} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 bg-stone-100/50 px-2.5 py-1.5 rounded-lg">
                                    {template.category}
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-stone-900 mb-2">{template.name}</h3>
                            <p className="text-sm text-stone-600 mb-6 flex-grow leading-relaxed line-clamp-3">
                                {template.description}
                            </p>

                            <div className="space-y-3 pt-5 border-t border-stone-100/50 mb-6">
                                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Dimensioni analisi:</h4>
                                <ul className="space-y-1.5">
                                    {template.defaultConfig.topics.slice(0, 3).map((topic, i) => (
                                        <li key={i} className="flex items-center gap-2 text-xs text-stone-500">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                            {topic.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <Link href={`/dashboard/interviews/create?template=${template.id}`}>
                                <button className="w-full bg-stone-900 text-white font-bold py-3.5 rounded-xl hover:bg-amber-500 transition-all flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow-amber-500/20 active:scale-95">
                                    Crea da template <Icons.ArrowRight size={16} />
                                </button>
                            </Link>
                        </div>
                    );
                })}
            </div>

            {/* Support CTA */}
            <div className="mt-12 bg-white/40 backdrop-blur-md rounded-[32px] p-8 text-center border border-white/40">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icons.MessageSquare size={32} className="text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-stone-900 mb-2">Hai bisogno di un template su misura?</h3>
                <p className="text-stone-600 mb-6 max-w-lg mx-auto text-sm">
                    Inviaci il tuo obiettivo di ricerca. Un esperto di Business Tuner configurerà per te il bot ottimizzato in meno di 24 ore.
                </p>
                <Link href="mailto:hello@voler.ai">
                    <button className="bg-white text-stone-900 font-bold px-8 py-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition-all text-sm shadow-sm">
                        Contatta il supporto
                    </button>
                </Link>
            </div>
        </div>
    );
}
