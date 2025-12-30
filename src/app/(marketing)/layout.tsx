import Link from 'next/link';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Footer } from '@/components/Footer';
import { gradients, shadows } from '@/lib/design-system';
import { auth } from '@/auth';

export default async function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    return (
        <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAF8]/80 backdrop-blur-md border-b border-stone-200/50">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2">
                            <Icons.Logo size={32} />
                            <span className="text-xl font-semibold text-stone-900 tracking-tight">Voler</span>
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
                            {session ? (
                                <Link
                                    href="/dashboard"
                                    className="text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <Link
                                    href="/login"
                                    className="text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors"
                                >
                                    Accedi
                                </Link>
                            )}
                            <Link
                                href={session ? "/dashboard" : "/onboarding/preview"}
                                className="text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5"
                                style={{ background: gradients.primary, boxShadow: shadows.amber }}
                            >
                                {session ? "Vai alla console" : "Guarda Demo"}
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-20 flex-1">
                {children}
            </main>

            {/* Footer */}
            <Footer />
        </div>
    );
}
