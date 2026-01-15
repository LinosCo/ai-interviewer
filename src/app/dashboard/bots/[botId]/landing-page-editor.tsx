'use client';

import { useState } from 'react';
import { Bot, PlanType } from '@prisma/client';
import { Save, Lock, Layout, Image as ImageIcon, Video, Type, AlignLeft, Palette, Upload } from 'lucide-react';
import { colors, gradients, shadows } from '@/lib/design-system';
import { useRouter } from 'next/navigation';
import { updateBotAction } from '@/app/actions';
import { showToast } from '@/components/toast';

interface BrandingEditorProps {
    bot: Bot;
    plan: PlanType;
}

export default function BrandingEditor({ bot, plan }: BrandingEditorProps) {
    const isPro = plan === 'PRO' || plan === 'BUSINESS' || plan === 'TRIAL';
    const updateAction = updateBotAction.bind(null, bot.id);
    const [logoPreview, setLogoPreview] = useState(bot.logoUrl || '');

    const handleSubmit = async (formData: FormData) => {
        // Appends scope
        formData.append('_scope', 'branding');
        await updateAction(formData);
        showToast('Branding updated!', 'success');
    };

    if (!isPro) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center space-y-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                    <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4 max-w-sm border border-amber-100">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                            <Lock className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">Funzionalità Pro</h3>
                        <p className="text-gray-500 text-sm">Passa a Pro o Business per personalizzare logo, colori e Landing Page.</p>
                        <a href="/dashboard/billing/plans" className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium text-sm hover:bg-amber-600 transition-colors">
                            Vedi Piani
                        </a>
                    </div>
                </div>
                {/* Mockup content */}
                <div className="opacity-40 filter blur-sm pointer-events-none select-none h-40"></div>
            </div>
        );
    }

    return (
        <form action={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-800">
                    <Palette className="w-5 h-5 text-amber-500" />
                    <h2 className="font-bold text-lg">Look & Feel (Branding)</h2>
                </div>
                <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                    <Save className="w-4 h-4" /> Salva Modifiche
                </button>
            </div>

            <div className="p-6 space-y-8">

                {/* LOGO & COLORS */}
                <section className="space-y-6">
                    <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4 border-b pb-2">Identità Visiva</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Logo Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
                            <div className="flex items-start gap-4">
                                <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden relative">
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                                    ) : (
                                        <ImageIcon className="text-gray-300 w-8 h-8" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-2"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                // Check size limit (max 500KB to ensure Base64 < 1MB limit of Server Actions)
                                                // 500KB * 1.33 = ~665KB Base64. Safe.
                                                if (file.size > 500 * 1024) {
                                                    alert("L'immagine è troppo grande. Per favore usa un file più piccolo di 500KB.");
                                                    return;
                                                }
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    const res = reader.result as string;
                                                    setLogoPreview(res);
                                                    // No need for manual DOM update, we use controlled input below
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                    <input type="hidden" name="logoUrl" value={logoPreview} />
                                    <p className="text-xs text-gray-400">Consigliato: PNG trasparente 200x200px.</p>
                                </div>
                            </div>
                        </div>

                        {/* Colors */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Colore Primario</label>
                                <div className="flex items-center gap-3">
                                    <input type="color" name="primaryColor" defaultValue={bot.primaryColor || '#f59e0b'} className="w-10 h-10 border rounded cursor-pointer" />
                                    <span className="text-xs text-gray-500 font-mono">Usato per bottoni e accenti</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Background</label>
                                    <input type="color" name="backgroundColor" defaultValue={bot.backgroundColor || '#ffffff'} className="w-full h-8 border rounded cursor-pointer" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Testo</label>
                                    <input type="color" name="textColor" defaultValue={bot.textColor || '#1f2937'} className="w-full h-8 border rounded cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* LANDING PAGE */}
                <section className="space-y-6 pt-6">
                    <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
                        <Layout className="w-4 h-4" /> Landing Page
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Titolo Pubblico</label>
                            <input
                                name="landingTitle"
                                type="text"
                                defaultValue={bot.landingTitle || bot.name}
                                placeholder="e.g. Intervista stage 2024"
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione / Sottotitolo</label>
                            <textarea
                                name="landingDescription"
                                defaultValue={bot.landingDescription || bot.introMessage || ''}
                                rows={3}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL</label>
                                <input
                                    name="landingImageUrl"
                                    type="url"
                                    defaultValue={bot.landingImageUrl || ''}
                                    placeholder="https://..."
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Video Embed URL</label>
                                <input
                                    name="landingVideoUrl"
                                    type="url"
                                    defaultValue={bot.landingVideoUrl || ''}
                                    placeholder="https://youtube.com/..."
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <div className="bg-amber-50 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-800">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>Le modifiche al branding si riflettono sia sulla Landing Page che sull'interfaccia della chat.</p>
                </div>

                <div className="pt-4 border-t flex justify-end">
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-md"
                    >
                        <Save className="w-4 h-4" /> Salva Branding
                    </button>
                </div>
            </div>
        </form>
    );
}

function Info({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}
