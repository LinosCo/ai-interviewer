'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/ui/business-tuner/Icons';
import GlobalProjectSelector from './GlobalProjectSelector';
import { ChevronDown } from 'lucide-react';

interface DashboardSidebarProps {
    isAdmin: boolean;
    signOutAction: () => Promise<void>;
    hasCMSIntegration?: boolean;
    canManageProjects?: boolean;
    hasChatbot?: boolean;
    hasVisibilityTracker?: boolean;
    hasAiTips?: boolean;
}

export function DashboardSidebar({
    isAdmin,
    signOutAction,
    hasCMSIntegration = false,
    canManageProjects = false,
    hasChatbot = false,
    hasVisibilityTracker = false,
    hasAiTips = false
}: DashboardSidebarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [adminExpanded, setAdminExpanded] = useState(false);

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
                md:relative md:translate-x-0 md:z-20 md:flex md:flex-col p-6 h-full overflow-hidden
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="hidden md:block absolute inset-6 bg-white/65 backdrop-blur-md border border-white/40 shadow-md rounded-[24px] -z-1" />

                <Link href="/dashboard" className="mb-6 hidden md:flex items-center gap-2.5 px-4 pt-[7px]">
                    <Icons.Logo size={32} />
                    <span className="font-bold text-xl text-gray-900 tracking-tight">Business Tuner</span>
                </Link>

                {/* Project Selector */}
                <div className="mb-6">
                    <GlobalProjectSelector />
                </div>

                <nav className="flex flex-col gap-2 flex-1 overflow-y-auto scrollbar-hide pr-2 -mr-2">
                    <DashboardLink href="/dashboard/interviews" icon={<Icons.MessageSquare size={20} />} label="Interviste AI" onClick={() => setIsOpen(false)} />
                    {hasChatbot && (
                        <DashboardLink href="/dashboard/bots" icon={<Icons.Bot size={20} />} label="Chatbot AI" onClick={() => setIsOpen(false)} />
                    )}
                    {hasVisibilityTracker && (
                        <DashboardLink href="/dashboard/visibility" icon={<Icons.Search size={20} />} label="Brand Monitor" onClick={() => setIsOpen(false)} />
                    )}
                    {hasAiTips && (
                        <DashboardLink href="/dashboard/insights" icon={<Icons.Layers size={20} />} label="AI Tips" onClick={() => setIsOpen(false)} />
                    )}
                    {hasCMSIntegration && (
                        <DashboardLink href="/dashboard/cms" icon={<Icons.Globe size={20} />} label="Gestione Sito" highlight={true} onClick={() => setIsOpen(false)} />
                    )}
                    <DashboardLink href="/dashboard/templates" icon={<Icons.LayoutTemplate size={20} />} label="Template" onClick={() => setIsOpen(false)} />
                    {canManageProjects && (
                        <DashboardLink href="/dashboard/projects" icon={<Icons.FolderKanban size={20} />} label="Progetti" onClick={() => setIsOpen(false)} />
                    )}
                    <DashboardLink href="/dashboard/billing" icon={<Icons.CreditCard size={20} />} label="Abbonamento" onClick={() => setIsOpen(false)} />
                </nav>

                {/* Bottom Section */}
                <div className="border-t border-gray-200/50 pt-4 mt-auto space-y-1">
                    {isAdmin && (
                        <div className="mb-1">
                            <button
                                onClick={() => setAdminExpanded(!adminExpanded)}
                                className="flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all text-amber-700 hover:bg-amber-50 group font-medium"
                            >
                                <div className="flex items-center gap-3">
                                    <Icons.Shield size={20} className="text-amber-600" />
                                    <span>Admin</span>
                                </div>
                                <ChevronDown size={16} className={`text-amber-500 transition-transform duration-200 ${adminExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {adminExpanded && (
                                <div className="ml-4 mt-1 space-y-1 border-l-2 border-amber-100 pl-2">
                                    <DashboardLink href="/dashboard/admin/usage" icon={<Icons.Activity size={18} />} label="Monitoraggio" isAdmin onClick={() => setIsOpen(false)} />
                                    <DashboardLink href="/dashboard/admin/users" icon={<Icons.Users size={18} />} label="Utenti" isAdmin onClick={() => setIsOpen(false)} />
                                    <DashboardLink href="/dashboard/admin/projects" icon={<Icons.FolderKanban size={18} />} label="Progetti" isAdmin onClick={() => setIsOpen(false)} />
                                    <DashboardLink href="/dashboard/admin/cms" icon={<Icons.Link size={18} />} label="CMS" isAdmin onClick={() => setIsOpen(false)} />
                                </div>
                            )}
                        </div>
                    )}

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

function DashboardLink({ href, icon, label, isAdmin = false, highlight = false, onClick }: { href: string, icon: React.ReactNode, label: string, isAdmin?: boolean, highlight?: boolean, onClick: () => void }) {
    if (highlight) {
        return (
            <Link
                href={href}
                onClick={onClick}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all group bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200"
            >
                <span className="text-emerald-600">
                    {icon}
                </span>
                <span className="font-medium">{label}</span>
                <span className="ml-auto text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                    CMS
                </span>
            </Link>
        );
    }

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
