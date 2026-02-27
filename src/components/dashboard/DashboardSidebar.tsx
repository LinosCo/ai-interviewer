'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { Icons } from '@/components/ui/business-tuner/Icons';
import OrganizationProjectSelector from './OrganizationProjectSelector';
import { ChevronDown } from 'lucide-react';
import CreditsWidget from './CreditsWidget';

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
    const pathname = usePathname();
    const { projects, selectedProject, isAllProjectsSelected } = useProject();

    const activeProjectId = !isAllProjectsSelected && selectedProject?.id ? selectedProject.id : null;

    const toggleMenu = () => setIsOpen(!isOpen);

    // Navigation items configuration
    // Primary features (App core)
    const primaryItems = [
        { href: '/dashboard/interviews', icon: Icons.MessageSquare, label: 'Interviste AI', visible: true },
        { href: '/dashboard/bots', icon: Icons.Bot, label: 'Chatbot AI', visible: hasChatbot },
        { href: '/dashboard/visibility', icon: Icons.Search, label: 'Brand Monitor', visible: hasVisibilityTracker },
        { href: '/dashboard/insights', icon: Icons.Layers, label: 'AI Tips', visible: hasAiTips },
    ].filter(item => item.visible);

    // Secondary features (Management & Tools)
    const secondaryItems = [
        { href: '/dashboard/projects', icon: Icons.FolderKanban, label: 'Progetti', visible: canManageProjects },
        { href: '/dashboard/settings/members', icon: Icons.Users, label: 'Team', visible: true },
        { href: '/dashboard/billing', icon: Icons.CreditCard, label: 'Abbonamento', visible: true },
        { href: '/dashboard/cms', icon: Icons.Globe, label: 'Contenuti AI', visible: hasCMSIntegration },
        {
            href: activeProjectId
                ? `/dashboard/projects/${activeProjectId}/integrations`
                : (projects?.length > 0 ? `/dashboard/projects/${projects[0].id}/integrations` : '/dashboard/projects'),
            icon: Icons.Link,
            label: 'Integrazioni',
            visible: true
        },
        { href: '/dashboard/templates', icon: Icons.LayoutTemplate, label: 'Template', visible: true },
        { href: '/dashboard/settings', icon: Icons.Settings, label: 'Impostazioni', visible: true },
    ].filter(item => item.visible);

    const adminItems = [
        { href: '/dashboard/admin/usage', icon: Icons.Activity, label: 'Monitoraggio' },
        { href: '/dashboard/admin/interviews', icon: Icons.BarChart, label: 'Qualita Interviste' },
        { href: '/dashboard/admin/organizations', icon: Icons.Building, label: 'Organizzazioni' },
        { href: '/dashboard/admin/users', icon: Icons.Users, label: 'Utenti' },
        { href: '/dashboard/admin/projects', icon: Icons.FolderKanban, label: 'Progetti' },
        { href: '/dashboard/admin/cms', icon: Icons.Link, label: 'CMS' },
    ];

    return (
        <>
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-40">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <Icons.Logo size={24} />
                    <span className="font-bold text-lg text-gray-900">Business Tuner</span>
                </Link>
                <button
                    onClick={toggleMenu}
                    className="p-2 text-gray-500 hover:text-amber-600 hover:bg-gray-50 rounded-lg transition-colors"
                    aria-label={isOpen ? 'Chiudi menu' : 'Apri menu'}
                >
                    {isOpen ? <Icons.X size={24} /> : <Icons.Menu size={24} />}
                </button>
            </div>

            {/* Backdrop for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-30 md:hidden"
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar content */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-40 w-[280px] transform transition-transform duration-300 ease-in-out
                    bg-white border-r border-gray-200
                    md:relative md:translate-x-0 md:z-20
                    flex flex-col p-6 h-full overflow-hidden
                    ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}
            >
                {/* Logo Section */}
                <Link
                    href="/dashboard"
                    className="hidden md:flex items-center gap-2.5 mb-8"
                >
                    <Icons.Logo size={28} />
                    <span className="font-bold text-xl text-gray-900 tracking-tight">Business Tuner</span>
                </Link>

                {/* Organization & Project Selector (Fixed Header) */}
                <div className="flex-shrink-0 space-y-4 mb-4">
                    <OrganizationProjectSelector />
                </div>

                {/* Main Navigation (Scrollable) */}
                <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2 py-2 space-y-6">
                    {/* Primary Features */}
                    <div className="space-y-0.5">
                        <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            App
                        </div>
                        {primaryItems.map((item) => (
                            <DashboardLink
                                key={item.href}
                                href={item.href}
                                icon={<item.icon size={20} />}
                                label={item.label}
                                isActive={pathname?.startsWith(item.href)}
                                onClick={() => setIsOpen(false)}
                            />
                        ))}
                    </div>

                    {/* Secondary Features */}
                    <div className="space-y-0.5">
                        <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Gestione
                        </div>
                        {secondaryItems.map((item) => (
                            <DashboardLink
                                key={item.href}
                                href={item.href}
                                icon={<item.icon size={18} />}
                                label={item.label}
                                isActive={pathname?.startsWith(item.href)}
                                onClick={() => setIsOpen(false)}
                                compact={true} // Slightly smaller for secondary items
                            />
                        ))}
                    </div>
                </div>

                {/* Footer Section (Fixed) */}
                <div className="flex-shrink-0 border-t border-slate-100 pt-3 mt-2 space-y-1">
                    <div className="mb-2">
                        <CreditsWidget />
                    </div>

                    {/* Admin Section */}
                    {isAdmin && (
                        <div className="mb-1">
                            <button
                                onClick={() => setAdminExpanded(!adminExpanded)}
                                className={`
                                    flex items-center justify-between w-full px-3 py-2 rounded-lg
                                    text-xs font-bold transition-colors
                                    ${adminExpanded || pathname?.startsWith('/dashboard/admin')
                                        ? 'bg-amber-50 text-amber-900'
                                        : 'text-slate-600 hover:bg-slate-50'
                                    }
                                `}
                                aria-expanded={adminExpanded}
                            >
                                <div className="flex items-center gap-2.5">
                                    <Icons.Shield size={16} className="text-amber-500" />
                                    <span>Amministrazione</span>
                                </div>
                                <ChevronDown
                                    size={14}
                                    className={`text-slate-400 transition-transform duration-200 ${adminExpanded ? 'rotate-0' : '-rotate-90'}`}
                                />
                            </button>
                            {adminExpanded && (
                                <div className="mt-1 ml-2 pl-2 border-l border-amber-200/50 space-y-0.5">
                                    {adminItems.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setIsOpen(false)}
                                            className={`
                                                flex items-center gap-2 px-2.5 py-1.5 rounded-md
                                                text-xs transition-colors
                                                ${pathname === item.href
                                                    ? 'bg-amber-50 text-amber-900 font-bold'
                                                    : 'text-slate-500 hover:text-amber-700 hover:bg-amber-50/50'
                                                }
                                            `}
                                        >
                                            <div className="w-1 h-1 rounded-full bg-amber-400" />
                                            <span>{item.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Settings & Sign Out */}
                    <div className="pt-1 flex items-center justify-end px-1">
                        <button
                            onClick={() => signOutAction()}
                            className="
                                flex items-center gap-2 px-2 py-1.5 rounded-lg
                                text-xs font-medium transition-colors
                                text-slate-400 hover:text-red-600 hover:bg-red-50
                            "
                        >
                            <Icons.LogOut size={16} />
                            <span>Esci</span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}

// Helper: Navigation arrays extraction (removed as it's now inside)

interface DashboardLinkProps {
    href: string;
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
    highlight?: boolean;
    compact?: boolean;
    onClick?: () => void;
}

function DashboardLink({ href, icon, label, isActive = false, highlight = false, compact = false, onClick }: DashboardLinkProps) {
    if (highlight) {
        return (
            <Link
                href={href}
                onClick={onClick}
                className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg
                    text-sm font-medium transition-colors
                    ${isActive
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100'
                    }
                `}
            >
                <span className="text-emerald-600">{icon}</span>
                <span>{label}</span>
                <span className="ml-auto text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded uppercase">
                    CMS
                </span>
            </Link>
        );
    }

    return (
        <Link
            href={href}
            onClick={onClick}
            className={`
                flex items-center gap-3 rounded-lg
                font-medium transition-colors
                ${compact ? 'px-3 py-2 text-xs' : 'px-3 py-2.5 text-sm'}
                ${isActive
                    ? 'bg-amber-50 text-amber-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }
            `}
            aria-current={isActive ? 'page' : undefined}
        >
            <span className={`transition-colors ${isActive ? 'text-amber-500' : 'text-slate-400'}`}>
                {icon}
            </span>
            <span>{label}</span>
        </Link>
    );
}
