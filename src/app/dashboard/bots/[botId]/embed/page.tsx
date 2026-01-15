import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import WidgetPreview from "../widget/WidgetPreview";
import { Code, Torus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/business-tuner/Button";

export default async function EmbedPage({ params }: { params: Promise<{ botId: string }> }) {
    const { botId } = await params;
    const session = await auth();
    if (!session) redirect("/login");

    const bot = await prisma.bot.findUnique({
        where: { id: botId }
    });

    if (!bot) redirect("/dashboard");

    const embedCode = `<script 
  src="${process.env.NEXT_PUBLIC_APP_URL || 'https://businesstuner.voler.ai'}/embed/chatbot.js"
  data-bot-id="${bot.id}"
  data-domain="${process.env.NEXT_PUBLIC_APP_URL || 'https://businesstuner.voler.ai'}"
  defer
></script>`;

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 min-h-screen bg-white">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Installazione Widget</h1>
                    <p className="text-slate-500">
                        Visualizza come apparirà il tuo chatbot sul sito web e copia il codice di integrazione.
                    </p>
                </div>
                <Link href={`/dashboard/bots/${botId}`}>
                    <Button variant="outline">
                        Torna alla Configurazione
                    </Button>
                </Link>
            </div>

            {/* Live Preview Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Torus className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-semibold">Anteprima Live Interattiva</h2>
                </div>
                <WidgetPreview bot={bot} />
            </div>

            {/* Embed Code Section */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 space-y-4 shadow-sm">
                <div className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-slate-700" />
                    <h2 className="text-lg font-semibold text-slate-900">Codice di Integrazione</h2>
                </div>
                <p className="text-sm text-slate-600">
                    Copia questo codice e incollalo nel tag <code className="bg-slate-200 px-1 py-0.5 rounded text-xs text-slate-800">&lt;head&gt;</code> o prima della chiusura del <code className="bg-slate-200 px-1 py-0.5 rounded text-xs text-slate-800">&lt;/body&gt;</code> del tuo sito web.
                </p>

                <div className="relative group">
                    <pre className="bg-slate-900 text-slate-100 p-5 rounded-xl overflow-x-auto text-xs leading-relaxed border border-slate-800">
                        <code className="block">{embedCode}</code>
                    </pre>
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            size="sm"
                            onClick={() => {
                                // This will need a client component for functionality, but for now we provide the UI
                                // We'll keep it simple for the preview
                            }}
                            className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border-white/20"
                        >
                            Copia Codice
                        </Button>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
                    <div className="mt-1 bg-amber-500 rounded-full p-1 text-white">
                        <Code size={12} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-amber-900 uppercase tracking-tight mb-1">Suggerimento</p>
                        <p className="text-xs text-amber-800">
                            Lo script caricherà automaticamente la bolla e la finestra di chat secondo le tue configurazioni di stile e comportamento.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
