'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { colors, gradients, shadows } from '@/lib/design-system';

interface DashboardSidebarProps {
    isAdmin: boolean;
    signOutAction: () => Promise<void>;
}

export function DashboardSidebar({ isAdmin, signOutAction }: DashboardSidebarProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    return (
        <>
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <Icons.Logo size={24} />
                    <span className="font-bold text-lg text-gray-900">Business Tuner</span>
                </Link>
                <button
                    onClick={toggleMenu}
                    className="p-2 text-gray-500 hover:text-amber-600 transition-colors"
                >
                    {isOpen ? <Icons.X size={24} /> : <Icons.Menu size={24} />}
                </button>
            </div>

            {/* Backdrop for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar content */}
            <div className={`
                fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ease-in-out bg-white md:bg-transparent
                md:relative md:translate-x-0 md:z-20 md:flex md:flex-col p-6
                ${isOpen ? 'translate-x-0 overflow-y-auto' : '-translate-x-full'}
            `}>
                <div className="hidden md:block absolute inset-6 bg-white/65 backdrop-blur-md border border-white/40 shadow-md rounded-[24px] -z-1" />

                <Link href="/dashboard" className="mb-8 hidden md:flex items-center gap-2 px-3">
                    <Icons.Logo size={32} />
                    <span className="font-bold text-xl text-gray-900 tracking-tight">Business Tuner</span>
                </Link>

                {/* Quick Create Button */}
                <Link
                    href="/onboarding"
                    onClick={() => setIsOpen(false)}
                    className="mb-8 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-semibold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 group"
                    style={{ background: gradients.primary, boxShadow: shadows.amber }}
                >
                    <Icons.Plus className="w-5 h-5" color="white" />
                    <span>Nuova intervista</span>
                </Link>

                <nav className="flex flex-col gap-2 flex-1">
                    <DashboardLink href="/dashboard" icon={<Icons.Home size={20} />} label="Home" onClick={() => setIsOpen(false)} />
                    <DashboardLink href="/dashboard/interviews" icon={<Icons.MessageSquare size={20} />} label="Le mie interviste" onClick={() => setIsOpen(false)} />
                    <DashboardLink href="/templates" icon={<Icons.LayoutTemplate size={20} />} label="Template" onClick={() => setIsOpen(false)} />

                    {isAdmin && (
                        <div className="mt-6 pt-6 border-t border-gray-200/50">
                            <span className="text-xs text-amber-600 font-bold uppercase tracking-wider px-4 mb-3 block">Admin</span>
                            <DashboardLink href="/dashboard/admin/users" icon={<Icons.Users size={20} />} label="Gestione utenti" isAdmin onClick={() => setIsOpen(false)} />
                        </div>
                    )}
                </nav>

                {/* Bottom Section */}
                <div className="border-t border-gray-200/50 pt-4 mt-auto space-y-2">
                    <DashboardLink href="/dashboard/settings" icon={<Icons.Settings size={20} />} label="Impostazioni" onClick={() => setIsOpen(false)} />

                    <button
                        onClick={() => signOutAction()}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all text-gray-500 hover:text-red-600 hover:bg-red-50 group font-medium"
                    >
                        <Icons.LogOut size={20} className="text-gray-400 group-hover:text-red-500" />
                        <span>Esci</span>
                    </button>
                </div>
            </div>
        </>
    );
}

function DashboardLink({ href, icon, label, isAdmin = false, onClick }: { href: string, icon: React.ReactNode, label: string, isAdmin?: boolean, onClick: () => void }) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isAdmin ? 'text-amber-700 hover:bg-amber-50' : 'text-gray-600 hover:text-gray-900 hover:bg-stone-50 md:hover:bg-white/50 hover:shadow-sm'}`}
        >
            <span className={isAdmin ? 'text-amber-600' : 'text-gray-400 group-hover:text-amber-500 transition-colors'}>
                {icon}
            </span>
            <span className="font-medium">{label}</span>
        </Link>
    );
}
