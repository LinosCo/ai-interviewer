'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "Cos'è Business Tuner e a chi è rivolto?",
    answer:
      'Business Tuner è una piattaforma di marketing e business intelligence nativa AI, pensata per PMI, manager e consulenti aziendali. Ti permette di raccogliere feedback, gestire chatbot intelligenti e monitorare la reputazione del brand, tutto in un unico posto.',
  },
  {
    question: 'Come funzionano le interviste AI?',
    answer:
      'Le nostre AI conducono conversazioni naturali con i tuoi stakeholder (clienti, team, partner) tramite chat o email. Fanno domande adattive basate sulle risposte ricevute, proprio come farebbe un intervistatore umano, ma disponibili 24/7.',
  },
  {
    question: 'Posso personalizzare il chatbot con il mio brand?',
    answer:
      'Assolutamente! Il chatbot impara dal tuo tono di voce, può essere addestrato sui tuoi documenti e FAQ, e si adatta perfettamente al look & feel del tuo sito web. Con il piano Enterprise, offriamo anche soluzioni white-label.',
  },
  {
    question: 'I miei dati sono al sicuro?',
    answer:
      'La sicurezza è la nostra priorità. I dati sono crittografati, ospitati su server europei e trattiamo tutto in conformità al GDPR. Non vendiamo né condividiamo mai i tuoi dati con terze parti.',
  },
  {
    question: 'Quanto tempo serve per iniziare?',
    answer:
      'Meno di 5 minuti! Crei un account, configuri il tuo primo progetto e puoi già iniziare a raccogliere feedback o attivare il chatbot. Non serve nessuna competenza tecnica.',
  },
  {
    question: 'Posso provare prima di pagare?',
    answer:
      'Certo! Offriamo un piano gratuito per sempre con funzionalità base, più 14 giorni di prova gratuita su tutti i piani a pagamento. Nessuna carta di credito richiesta per iniziare.',
  },
  {
    question: 'Come funziona il supporto?',
    answer:
      'Offriamo supporto via email per tutti i piani e supporto prioritario con tempi di risposta garantiti per i piani Pro ed Enterprise. Il nostro team è 100% italiano e sempre disponibile ad aiutarti.',
  },
  {
    question: 'Posso integrare Business Tuner con altri strumenti?',
    answer:
      'Sì! Offriamo integrazioni native con i principali CRM, strumenti di email marketing e piattaforme di analytics. I piani Pro ed Enterprise hanno anche accesso alle API per integrazioni personalizzate.',
  },
];

function FAQItem({ question, answer, isOpen, onClick }: {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div className="glass-card rounded-xl overflow-hidden transition-all">
      <button
        className="w-full text-left px-6 py-5 flex items-center justify-between gap-4"
        onClick={onClick}
      >
        <span className="font-semibold text-[hsl(var(--foreground))]">{question}</span>
        <ChevronDown
          className={`w-5 h-5 text-[hsl(var(--muted-foreground))] transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 pb-5 text-[hsl(var(--muted-foreground))]">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 md:py-28 relative">
      {/* White overlay */}
      <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px]" />

      <div className="max-w-3xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Domande <span className="gradient-text">frequenti</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))]">
            Tutto quello che devi sapere su Business Tuner
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-4"
        >
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
