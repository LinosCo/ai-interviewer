import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import WidgetPreview from "./WidgetPreview";
import { Code } from "lucide-react";

export default async function WidgetPage({ params }: { params: Promise<{ botId: string }> }) {
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
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2">Anteprima Widget</h1>
                <p className="text-slate-500">
                    Visualizza come apparirà il tuo chatbot sul sito web.
                </p>
            </div>

            {/* Live Preview */}
            <WidgetPreview bot={bot} />

            {/* Embed Code */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold">Codice di Integrazione</h2>
                </div>
                <p className="text-sm text-slate-500">
                    Copia questo codice e incollalo nel tag <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">&lt;head&gt;</code> o prima della chiusura del <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">&lt;/body&gt;</code> del tuo sito web.
                </p>
                <div className="relative">
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs">
                        <code>{embedCode}</code>
                    </pre>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(embedCode);
                            alert('Codice copiato!');
                        }}
                        className="absolute top-2 right-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors"
                    >
                        Copia
                    </button>
                </div>
            </div>
        </div>
    );
}
