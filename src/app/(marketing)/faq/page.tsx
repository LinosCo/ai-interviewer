'use client';

import { motion } from 'framer-motion';
import { FluidBackground } from '@/components/landing/FluidBackground';

const faqs = [
    {
        question: "Cos'è Business Tuner?",
        answer: "Business Tuner è una piattaforma AI per interviste, chatbot, visibility monitoring e copilot strategico. Il consumo è gestito con un modello unico a crediti per organizzazione."
    },
    {
        question: "Come funziona il consumo crediti?",
        answer: "Ogni piano include crediti mensili. Ogni operazione AI consuma crediti in base al tipo di azione. Quando il budget mensile finisce, vengono usati i crediti dei pack acquistati."
    },
    {
        question: "Cosa succede quando i crediti sono esauriti?",
        answer: "Le API AI vengono bloccate automaticamente e le funzionalità dipendenti dall'AI restano sospese finché non hai crediti disponibili. Puoi acquistare un Credit Pack o attendere il reset mensile."
    },
    {
        question: "Quali Credit Pack sono disponibili?",
        answer: "Sono disponibili tre pack: small (2M), medium (6M), large (15M). I pack non scadono e restano associati alla tua organizzazione."
    },
    {
        question: "Il piano Business è acquistabile online?",
        answer: "No. Il piano Business è disponibile solo tramite contatto Sales, con configurazione commerciale su misura."
    },
    {
        question: "Offrite trial gratuito?",
        answer: "Puoi iniziare dal piano gratuito e passare in qualsiasi momento a Starter o Pro. Per Business il percorso è sempre commerciale tramite Sales."
    },
    {
        question: "I dati sono sicuri?",
        answer: "Sì. Dati cifrati in transito e a riposo, controlli di accesso per organizzazione e conformità GDPR."
    },
    {
        question: "Posso integrare Business Tuner con altri tool?",
        answer: "Sì. Le integrazioni disponibili dipendono dal piano. Per esigenze enterprise e integrazioni su misura, il piano Business viene definito con il team Sales."
    }
];

export default function FAQPage() {
    return (
        <div className="min-h-screen relative overflow-x-hidden">
            <FluidBackground />

            <main className="relative">
                <section className="pt-24 pb-12 md:pt-32 md:pb-16 relative">
                    <div className="max-w-4xl mx-auto px-6 text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
                                Domande <span className="gradient-text">Frequenti</span>
                            </h1>
                            <p className="text-xl text-[hsl(var(--muted-foreground))]">
                                Modello crediti, piani e gestione billing
                            </p>
                        </motion.div>
                    </div>
                </section>

                <div className="h-24 section-fade-from-transparent" />

                <section className="pb-24 relative">
                    <div className="absolute inset-0 bg-white/85" />
                    <div className="max-w-3xl mx-auto px-6 relative z-10">
                        <div className="space-y-4">
                            {faqs.map((faq, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.03 }}
                                    className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <h3 className="text-lg font-bold mb-2 text-[hsl(var(--foreground))]">
                                        {faq.question}
                                    </h3>
                                    <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">
                                        {faq.answer}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="h-24 section-fade-to-transparent" />
            </main>
        </div>
    );
}
