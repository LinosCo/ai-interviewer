import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Code, Settings2, Palette, Layout, Shield } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/business-tuner/Button";
import EmbedCodeSection from "./EmbedCodeSection";

export default async function EmbedPage({ params }: { params: Promise<{ botId: string }> }) {
    const { botId } = await params;
    const session = await auth();
    if (!session) redirect("/login");

    const bot = await prisma.bot.findUnique({
        where: { id: botId }
    });

    if (!bot) redirect("/dashboard");

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://businesstuner.voler.ai';

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8 min-h-screen bg-white">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Installa Chatbot</h1>
                    <p className="text-slate-500">
                        Configura e installa il chatbot sul tuo sito web.
                    </p>
                </div>
                <Link href={`/dashboard/bots/${botId}`}>
                    <Button variant="outline">
                        Torna alla Configurazione
                    </Button>
                </Link>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-2xl border border-purple-200">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-600 rounded-xl">
                            <Palette className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-purple-900">Colore Brand</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg border-2 border-white shadow-sm" style={{ backgroundColor: bot.primaryColor }} />
                        <code className="text-xs text-purple-700 bg-purple-200/50 px-2 py-1 rounded">{bot.primaryColor}</code>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-2xl border border-blue-200">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-600 rounded-xl">
                            <Layout className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-blue-900">Posizione</span>
                    </div>
                    <span className="text-sm text-blue-700 capitalize">{bot.bubblePosition?.replace('-', ' ') || 'bottom-right'}</span>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-2xl border border-green-200">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-600 rounded-xl">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-green-900">Lead Gen</span>
                    </div>
                    <span className="text-sm text-green-700 capitalize">{bot.leadCaptureStrategy?.replace('_', ' ') || 'after 3 msgs'}</span>
                </div>
            </div>

            {/* Embed Code Section - Client Component */}
            <EmbedCodeSection botId={bot.id} baseUrl={baseUrl} botName={bot.name} />

            {/* Integration Guide */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-6">
                <div className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-slate-700" />
                    <h2 className="text-lg font-bold text-slate-900">Guida all'Integrazione</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-800">WordPress</h3>
                        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                            <li>Vai su <strong>Aspetto → Editor</strong></li>
                            <li>Apri il file <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">footer.php</code></li>
                            <li>Incolla il codice prima di <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">&lt;/body&gt;</code></li>
                            <li>Salva le modifiche</li>
                        </ol>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-800">Shopify</h3>
                        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                            <li>Vai su <strong>Online Store → Themes</strong></li>
                            <li>Clicca <strong>Actions → Edit code</strong></li>
                            <li>Apri <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">theme.liquid</code></li>
                            <li>Incolla il codice prima di <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">&lt;/body&gt;</code></li>
                        </ol>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-800">React / Next.js</h3>
                        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                            <li>Aggiungi lo script in <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">_document.tsx</code> o <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">layout.tsx</code></li>
                            <li>Oppure usa un componente Script con strategy=&quot;lazyOnload&quot;</li>
                        </ol>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-800">HTML Statico</h3>
                        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                            <li>Apri il tuo file HTML</li>
                            <li>Incolla il codice prima di <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">&lt;/body&gt;</code></li>
                            <li>Salva e pubblica</li>
                        </ol>
                    </div>
                </div>
            </div>

            {/* Note about configuration */}
            <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-4">
                <div className="p-2 bg-amber-500 rounded-xl text-white flex-shrink-0">
                    <Code className="w-4 h-4" />
                </div>
                <div>
                    <p className="font-bold text-amber-900 mb-1">Personalizzazione Avanzata</p>
                    <p className="text-sm text-amber-800">
                        Tutte le configurazioni di stile, comportamento e lead generation vengono caricate automaticamente dal server.
                        Per modificarle, torna alla <Link href={`/dashboard/bots/${botId}`} className="underline font-medium">pagina di configurazione</Link>.
                    </p>
                </div>
            </div>
        </div>
    );
}
