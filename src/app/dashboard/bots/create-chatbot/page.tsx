'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function CreateChatbotPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        tone: 'Professional and warm',
        knowledgeBase: '',
        primaryColor: '#F59E0B',
        position: 'bottom-right',
        leadCaptureStrategy: 'after_3_msgs'
    });

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Create config and bot via API (reusing existing create-from-config or custom endpoint)
            const res = await fetch('/api/bots/create-from-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    botType: 'chatbot',
                    config: {
                        tone: formData.tone,
                        primaryColor: formData.primaryColor,
                        bubblePosition: formData.position,
                        leadCaptureStrategy: formData.leadCaptureStrategy,
                        knowledgeSources: [{ title: 'Main Knowledge', content: formData.knowledgeBase, type: 'text' }]
                    }
                })
            });

            if (res.ok) {
                const data = await res.json();
                router.push(`/dashboard/bots/${data.botId}/embed`);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <h1 className="text-3xl font-bold mb-8">Crea il tuo AI Chatbot</h1>

            <div className="flex gap-4 mb-8">
                {[1, 2, 3].map(i => (
                    <div key={i} className={`h-2 flex-1 rounded-full ${step >= i ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 min-h-[400px]">
                {step === 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="text-xl font-semibold mb-6">1. Identità & Stile</h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2">Nome Chatbot</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    placeholder="es. Assistente Vendite"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Tono di Voce</label>
                                <select
                                    value={formData.tone}
                                    onChange={e => setFormData({ ...formData, tone: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                >
                                    <option>Professional and warm</option>
                                    <option>Friendly and casual</option>
                                    <option>Energetic and sales-focused</option>
                                    <option>Technical and precise</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Colore Principale</label>
                                <div className="flex gap-3">
                                    {['#F59E0B', '#3B82F6', '#10B981', '#6366F1', '#EC4899'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setFormData({ ...formData, primaryColor: c })}
                                            className={`w-10 h-10 rounded-full border-2 ${formData.primaryColor === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={formData.primaryColor}
                                        onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                                        className="h-10 w-10 p-0 border-0 rounded-full overflow-hidden"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={() => setStep(2)}
                                disabled={!formData.name}
                                className="px-6 py-2 bg-black text-white rounded-lg disabled:opacity-50"
                            >
                                Avanti →
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="text-xl font-semibold mb-6">2. Conoscenza (Knowledge Base)</h2>
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 mb-4">
                                💡 Incolla qui le informazioni aziendali, FAQ, listini prezzi o dettagli servizi.
                                Il chatbot userà PRIMA di tutto queste info, poi il contesto della pagina.
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Informazioni Aziendali</label>
                                <textarea
                                    value={formData.knowledgeBase}
                                    onChange={e => setFormData({ ...formData, knowledgeBase: e.target.value })}
                                    className="w-full p-3 border rounded-lg h-64 font-mono text-sm"
                                    placeholder="La nostra azienda offre servizi di..."
                                />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-between">
                            <button onClick={() => setStep(1)} className="px-6 py-2 text-gray-600">← Indietro</button>
                            <button
                                onClick={() => setStep(3)}
                                disabled={!formData.knowledgeBase}
                                className="px-6 py-2 bg-black text-white rounded-lg disabled:opacity-50"
                            >
                                Avanti →
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="text-xl font-semibold mb-6">3. Lead Generation & Configurazione</h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2">Quando chiedere il contatto?</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[
                                        { id: 'immediate', label: 'Subito', desc: 'Dopo il primo messaggio' },
                                        { id: 'after_3_msgs', label: 'Bilanciato', desc: 'Dopo 3 messaggi (Consigliato)' },
                                        { id: 'on_exit', label: 'Alla fine', desc: 'Solo se l\'utente chiude la chat' }
                                    ].map(opt => (
                                        <div
                                            key={opt.id}
                                            onClick={() => setFormData({ ...formData, leadCaptureStrategy: opt.id })}
                                            className={`p-4 border rounded-xl cursor-pointer transition-all ${formData.leadCaptureStrategy === opt.id
                                                    ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="font-semibold">{opt.label}</div>
                                            <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Posizione Bubble</label>
                                <select
                                    value={formData.position}
                                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                >
                                    <option value="bottom-right">Basso a Destra ↘️</option>
                                    <option value="bottom-left">Basso a Sinistra ↙️</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-12 flex justify-between items-center border-t pt-8">
                            <button onClick={() => setStep(2)} className="px-6 py-2 text-gray-600">← Indietro</button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-medium shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                            >
                                {loading ? 'Creazione in corso...' : '🚀 Crea Chatbot'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Live Preview Container (Fake Page) */}
            <div className="mt-12 border-t pt-12">
                <h3 className="text-center text-gray-400 text-sm mb-4 uppercase tracking-wider font-semibold">Live Preview</h3>
                <div className="relative mx-auto w-full max-w-5xl h-[500px] border shadow-2xl rounded-xl overflow-hidden bg-gray-50">
                    <div className="absolute top-4 left-4 right-4 h-4 bg-gray-200 rounded-full w-2/3 animate-pulse" />
                    <div className="absolute top-12 left-4 right-4 h-32 bg-gray-200 rounded-lg animate-pulse" />

                    {/* Fake Bubble */}
                    <div
                        className={`absolute bottom-8 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white cursor-pointer transition-all hover:scale-110`}
                        style={{
                            backgroundColor: formData.primaryColor,
                            right: formData.position === 'bottom-right' ? '32px' : 'auto',
                            left: formData.position === 'bottom-left' ? '32px' : 'auto',
                        }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" /></svg>
                    </div>

                    {/* Fake Chat Window Hint */}
                    <div
                        className={`absolute bottom-28 w-80 h-96 bg-white rounded-2xl shadow-xl border overflow-hidden`}
                        style={{
                            right: formData.position === 'bottom-right' ? '32px' : 'auto',
                            left: formData.position === 'bottom-left' ? '32px' : 'auto',
                            opacity: 0.9
                        }}
                    >
                        <div className="p-4 text-white" style={{ background: formData.primaryColor }}>
                            <div className="font-bold">{formData.name || 'Chatbot'}</div>
                            <div className="text-xs opacity-80">Online</div>
                        </div>
                        <div className="p-4 bg-gray-50 h-full">
                            <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm text-sm mb-3 max-w-[85%]">
                                Ciao! Come posso aiutarti oggi?
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
