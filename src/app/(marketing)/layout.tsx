import Link from 'next/link';
import { Icons } from '@/components/ui/business-tuner/Icons';

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-[#FAFAF8]">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAF8]/80 backdrop-blur-md border-b border-stone-200/50">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2">
                            <Icons.Logo size={32} />
                            <span className="text-xl font-semibold text-stone-900 tracking-tight">Business Tuner</span>
                        </Link>

                        <div className="hidden md:flex items-center gap-8">
                            <Link href="/#how-it-works" className="text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors">
                                Come funziona
                            </Link>
                            <Link href="/#use-cases" className="text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors">
                                Casi d'uso
                            </Link>
                            <Link href="/#pricing" className="text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors">
                                Prezzi
                            </Link>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link
                                href="/login"
                                className="text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors"
                            >
                                Accedi
                            </Link>
                            <Link
                                href="/onboarding"
                                className="bg-stone-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-stone-800 transition-colors"
                            >
                                Prova gratis
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-20">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-stone-900 text-stone-400 py-16 mt-24">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-2 mb-4">
                                <Icons.Logo size={32} />
                                <span className="text-xl font-semibold text-white tracking-tight">Business Tuner</span>
                            </div>
                            <p className="text-stone-500 text-sm leading-relaxed max-w-sm">
                                Ascolta il mercato. Decidi meglio.<br />
                                Feedback qualitativi da clienti, dipendenti e stakeholder in pochi minuti.
                            </p>
                        </div>

                        <div>
                            <h4 className="text-white font-medium mb-4 text-sm">Prodotto</h4>
                            <ul className="space-y-2 text-sm">
                                <li><Link href="/#how-it-works" className="hover:text-white transition-colors">Come funziona</Link></li>
                                <li><Link href="/#use-cases" className="hover:text-white transition-colors">Casi d'uso</Link></li>
                                <li><Link href="/#pricing" className="hover:text-white transition-colors">Prezzi</Link></li>
                                <li><Link href="/templates" className="hover:text-white transition-colors">Template</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-medium mb-4 text-sm">Azienda</h4>
                            <ul className="space-y-2 text-sm">
                                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                                <li><Link href="/terms" className="hover:text-white transition-colors">Termini di servizio</Link></li>
                                <li><a href="mailto:info@businesstuner.it" className="hover:text-white transition-colors">Contatti</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-stone-800 mt-12 pt-8 text-sm text-stone-500">
                        <p>© {new Date().getFullYear()} Business Tuner. Tutti i diritti riservati.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
