'use client';

import { useState } from 'react';
import { Users, Mail, Building, Phone, MessageSquare, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

interface WizardStepLeadsProps {
    initialConfig: any;
    onNext: (config: any) => void;
    onBack: () => void;
}

export default function WizardStepLeads({ initialConfig, onNext, onBack }: WizardStepLeadsProps) {
    const [config, setConfig] = useState(initialConfig);
    const [leadCaptureStrategy, setLeadCaptureStrategy] = useState(
        config.leadCaptureStrategy || 'after_3_msgs'
    );
    // Explicitly type usage of dataFields
    const [dataFields, setDataFields] = useState<any[]>(
        config.candidateDataFields || [
            { field: 'name', question: 'Come ti chiami?', required: true },
            { field: 'email', question: 'Qual è la tua email?', required: true }
        ]
    );

    const strategies = [
        {
            id: 'immediate',
            label: 'Immediato',
            desc: 'Chiedi i dati al primo messaggio',
            icon: MessageSquare,
            color: 'red'
        },
        {
            id: 'after_3_msgs',
            label: 'Bilanciato',
            desc: 'Dopo 3 messaggi (Consigliato)',
            icon: Users,
            color: 'green'
        },
        {
            id: 'smart',
            label: 'Intelligente',
            desc: 'L\'AI decide il momento migliore',
            icon: Building,
            color: 'blue'
        },
        {
            id: 'on_exit',
            label: 'All\'uscita',
            desc: 'Solo quando l\'utente chiude',
            icon: Phone,
            color: 'blue'
        }
    ];

    const commonFields = [
        { field: 'name', question: 'Come ti chiami?', icon: Users },
        { field: 'email', question: 'Qual è la tua email?', icon: Mail },
        { field: 'phone', question: 'Qual è il tuo numero di telefono?', icon: Phone },
        { field: 'company', question: 'Per quale azienda lavori?', icon: Building },
        { field: 'location', question: 'Da dove ci scrivi?', icon: MapPin }
    ];

    const toggleField = (field: any) => {
        const exists = dataFields.find((f: any) => f.field === field.field);
        if (exists) {
            setDataFields(dataFields.filter((f: any) => f.field !== field.field));
        } else {
            setDataFields([...dataFields, { ...field, required: false }]);
        }
    };

    const handleContinue = () => {
        onNext({
            ...config,
            leadCaptureStrategy,
            candidateDataFields: dataFields
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Lead Generation
                </h2>
                <p className="text-gray-600">
                    Configura quando e quali dati raccogliere dagli utenti
                </p>
            </div>

            {/* Strategy Selection */}
            <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Quando chiedere i dati di contatto?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {strategies.map((strategy: any) => {
                        const Icon = strategy.icon;
                        const isSelected = leadCaptureStrategy === strategy.id;
                        return (
                            <button
                                key={strategy.id}
                                onClick={() => setLeadCaptureStrategy(strategy.id)}
                                className={`p-4 border-2 rounded-xl text-left transition-all ${isSelected
                                    ? `border-${strategy.color}-600 bg-${strategy.color}-50 ring-2 ring-${strategy.color}-600`
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg ${isSelected ? `bg-${strategy.color}-100` : 'bg-gray-100'
                                        }`}>
                                        <Icon className={`w-5 h-5 ${isSelected ? `text-${strategy.color}-600` : 'text-gray-600'
                                            }`} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900 mb-1">
                                            {strategy.label}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                            {strategy.desc}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Data Fields */}
            <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Quali dati raccogliere?
                </h3>
                <div className="space-y-2">
                    {commonFields.map(field => {
                        const Icon = field.icon;
                        const isSelected = dataFields.some((f: any) => f.field === field.field);
                        const selectedField = dataFields.find((f: any) => f.field === field.field);

                        return (
                            <div
                                key={field.field}
                                className={`p-4 border rounded-xl transition-all ${isSelected
                                    ? 'border-blue-300 bg-blue-50'
                                    : 'border-gray-200 bg-white'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-gray-400'
                                            }`} />
                                        <div>
                                            <div className="font-medium text-gray-900 capitalize">
                                                {field.field}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                {field.question}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {isSelected && (
                                            <label className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedField?.required || false}
                                                    onChange={(e) => {
                                                        setDataFields(dataFields.map((f: any) =>
                                                            f.field === field.field
                                                                ? { ...f, required: e.target.checked }
                                                                : f
                                                        ));
                                                    }}
                                                    className="rounded border-gray-300"
                                                />
                                                <span className="text-gray-600">Obbligatorio</span>
                                            </label>
                                        )}
                                        <button
                                            onClick={() => toggleField(field)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isSelected
                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {isSelected ? 'Rimuovi' : 'Aggiungi'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Preview */}
            {dataFields.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                        Anteprima Raccolta Dati
                    </h3>
                    <div className="bg-white rounded-lg p-4 space-y-3">
                        <p className="text-sm text-gray-600 mb-3">
                            Il chatbot chiederà:
                        </p>
                        {dataFields.map((field: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                                    {idx + 1}
                                </span>
                                <span className="text-gray-900">{field.question}</span>
                                {field.required && (
                                    <span className="text-xs text-red-600">*</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Best Practices */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-medium text-amber-900 mb-2">⚡ Best Practices</h3>
                <ul className="space-y-1 text-sm text-amber-800">
                    <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-amber-600 rounded-full mt-1.5" />
                        Chiedi solo i dati strettamente necessari
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-amber-600 rounded-full mt-1.5" />
                        La strategia "Bilanciato" offre il miglior tasso di conversione
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-amber-600 rounded-full mt-1.5" />
                        Email e nome sono sufficienti per la maggior parte dei casi
                    </li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pt-4">
                <button
                    onClick={onBack}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                >
                    ← Indietro
                </button>
                <button
                    onClick={handleContinue}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 shadow-lg"
                >
                    Continua →
                </button>
            </div>
        </motion.div>
    );
}
