'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function EmbedPage() {
    const params = useParams();
    const botId = params.botId as string;
    const [copied, setCopied] = useState(false);

    // Construct embed code
    const embedCode = `<script src="https://businesstuner.ai/embed/chatbot.js"></script>
<script>
  BusinessTuner.init({
    botId: '${botId}',
    position: 'bottom-right', 
    primaryColor: '#F59E0B',
    pageContext: true
  });
</script>`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(embedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Implementa il tuo Chatbot</h1>
                <a href="/dashboard" className="text-sm text-gray-500 hover:text-black">Torna alla Dashboard</a>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-green-100 rounded-lg text-green-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Chatbot creato con successo!</h2>
                        <p className="text-gray-500 mt-1">Il tuo assistente AI è pronto. Copia il codice qui sotto e incollalo nel `<body>` del tuo sito web.</p>
                    </div>
                </div>

                <div className="relative group">
                    <pre className="bg-gray-900 text-gray-100 p-6 rounded-xl overflow-x-auto text-sm font-mono leading-relaxed">
                        {embedCode}
                    </pre>
                    <button
                        onClick={copyToClipboard}
                        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-xs font-medium backdrop-blur-sm transition-all flex items-center gap-2"
                    >
                        {copied ? 'Copiato! ✨' : 'Copia Codice 📋'}
                    </button>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <h3 className="font-semibold text-sm mb-2">🚀 Installazione Rapida</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Incolla questo codice prima della chiusura del tag `</body>` in tutte le pagine dove vuoi che appaia il chatbot.
                    </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="font-semibold text-sm mb-2">⚡️ Performance</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        Il nostro script pesa meno di 20KB e non rallenta il caricamento del tuo sito. Funziona in modo asincrono.
                    </p>
                </div>
            </div>
        </div>
        </div >
    );
}
