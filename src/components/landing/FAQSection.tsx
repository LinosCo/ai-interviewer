'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "Cos'è Business Tuner e a chi è rivolto?",
    answer:
      'Business Tuner è una piattaforma AI per interviste, chatbot, visibility monitoring e copilot strategico. È pensata per team marketing, prodotto e consulenza che vogliono un unico workspace con controllo costi tramite crediti organizzazione.',
  },
  {
    question: 'Come funziona il modello a crediti?',
    answer:
      'Ogni organizzazione ha un budget mensile di crediti in base al piano. Ogni operazione AI consuma crediti. Quando i crediti mensili finiscono, il sistema usa automaticamente gli eventuali Credit Pack acquistati.',
  },
  {
    question: 'Cosa succede quando i crediti finiscono?',
    answer:
      'Le API AI vengono bloccate automaticamente finché non hai crediti disponibili. Puoi acquistare un Credit Pack (small/medium/large) o attendere il reset mensile.',
  },
  {
    question: 'I Credit Pack scadono?',
    answer:
      'No. I Credit Pack non scadono, restano disponibili sull’organizzazione e vengono consumati dopo i crediti mensili del piano.',
  },
  {
    question: 'Posso acquistare il piano Business online?',
    answer:
      'No. Il piano Business è gestito solo tramite team Sales, con proposta su misura per volumi, integrazioni e supporto.',
  },
  {
    question: 'Posso provare prima di pagare?',
    answer:
      'Sì. Puoi partire dal piano gratuito e passare a Starter/Pro quando vuoi. Business viene attivato solo tramite contatto Sales.',
  },
  {
    question: 'I miei dati sono al sicuro?',
    answer:
      'Sì. Dati cifrati in transito e a riposo, infrastruttura europea e gestione conforme GDPR. I dati restano sotto il controllo della tua organizzazione.',
  },
  {
    question: 'Come funziona il supporto?',
    answer:
      'Supporto standard su tutti i piani. Per Business includiamo onboarding e supporto commerciale dedicato concordato in fase Sales.',
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
            Prezzi, crediti, pack e gestione piani
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
