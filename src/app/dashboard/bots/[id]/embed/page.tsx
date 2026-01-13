import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';

export default async function EmbedPage({ params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const bot = await prisma.bot.findUnique({
        where: { id: params.id },
        include: {
            project: {
                include: {
                    organization: {
                        include: {
                            members: {
                                where: { user: { email: session.user.email } }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!bot || !bot.project?.organization || bot.project.organization.members.length === 0) {
        notFound();
    }

    // For V2: If it's an interview bot, show warning or redirect
    // But we might want to allow embedding interviews too?
    // Let's assume this page is for the new Chatbot Embed V2.

    const scriptTag = `<script 
  src="${process.env.NEXT_PUBLIC_APP_URL || 'https://interviewer.businesstuner.ai'}/embed/chatbot.js"
  data-bot-id="${bot.id}"
  data-domain="${process.env.NEXT_PUBLIC_APP_URL || 'https://interviewer.businesstuner.ai'}"
  defer
></script>`;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Installazione Widget</h1>
                        <p className="text-gray-500">
                            Copia il codice e incollalo nel tuo sito web per attivare {bot.name}.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => window.open(`/dashboard/bots`)}>
                        Torna alla Dashboard
                    </Button>
                </div>

                {/* Code Snippet */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Codice di Incorporamento</h2>
                    <div className="relative bg-gray-900 rounded-lg p-4 overflow-x-auto group">
                        <pre className="text-sm text-gray-100 font-mono">
                            {scriptTag}
                        </pre>
                        {/* Copy button would need client component wrapper or interactivity */}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                        Inserisci questo script prima della chiusura del tag <code>&lt;/body&gt;</code> di ogni pagina dove vuoi che appaia il chatbot.
                    </p>
                </div>

                {/* Preview Area */}
                <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm h-[600px] relative overflow-hidden flex flex-col items-center justify-center text-center">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5 pointer-events-none"></div>

                    <div className="max-w-md z-0">
                        <Icons.Bot className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-900">Anteprima Live</h2>
                        <p className="text-gray-500 mb-6">
                            Il widget dovrebbe apparire nell'angolo in basso a destra di questo riquadro.
                            <br />
                            Prova a cliccarci per interagire!
                        </p>
                    </div>

                    {/* Inject the script for preview */}
                    {/* Note: In Next.js, injecting script tags in body of specific page needs Script component or raw HTML handling. 
                        Since this is a preview inside dashboard, we can just render strict logic.
                        However, the script attaches to 'document.body'. 
                        To demo it safely inside this div, we ideally would use an iframe or shadow DOM, 
                        but our script uses `fixed` positioning on `body`.
                        
                        For a dashboard preview, we can just let it attach to the main body 
                        (it will appear on top of dashboard UI) which is fine for "Preview".
                    */}
                </div>
            </div>

            {/* Actual Script Injection for Preview */}
            {/* We use dangerouslySetInnerHTML for the script to run? No, Script component. */}
            {/* Actually Script component works best. */}
            {/* We need to pass params to it. */}

            <script
                src="/embed/chatbot.js"
                data-bot-id={bot.id}
                data-domain="" // self relative
                defer
            />
        </div>
    );
}
