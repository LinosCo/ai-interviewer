'use client';

import Link from 'next/link';
import { Plus, Eye, Settings, BarChart3, Building2, Calendar, Zap, AlertCircle, Trash2, MoreVertical, ArrowRightLeft, FolderInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useProject } from '@/contexts/ProjectContext';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Brand {
    id: string;
    brandName: string;
    category: string;
    project?: { id: string; name: string } | null;
    scans: Array<{
        score: number | null;
        completedAt: string | null;
    }>;
    _count: {
        prompts: number;
        competitors: number;
    };
}

interface BrandsListProps {
    hasVisibility: boolean;
    planType: string;
}

export function BrandsList({ hasVisibility, planType }: BrandsListProps) {
    const { selectedProject, isAllProjectsSelected, loading: projectLoading, projects } = useProject();
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [movingId, setMovingId] = useState<string | null>(null);
    const router = useRouter();

    const handleDeleteBrand = async (brandId: string, brandName: string) => {
        if (!confirm(`Sei sicuro di voler eliminare il brand "${brandName}"? Questa azione eliminerà anche tutti gli scan e i dati associati.`)) {
            return;
        }

        setDeletingId(brandId);
        try {
            const res = await fetch(`/api/visibility/${brandId}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete brand');
            }

            // Remove brand from local state
            setBrands(prev => prev.filter(b => b.id !== brandId));
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Errore durante l\'eliminazione');
        } finally {
            setDeletingId(null);
        }
    };

    const handleMoveBrand = async (brandId: string, targetProjectId: string | null, targetProjectName: string) => {
        if (!confirm(`Vuoi spostare questo brand nel progetto "${targetProjectName}"?`)) {
            return;
        }

        setMovingId(brandId);
        try {
            const res = await fetch(`/api/visibility/${brandId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: targetProjectId })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to move brand');
            }

            // Update local state
            setBrands(prev => prev.map(b =>
                b.id === brandId
                    ? { ...b, project: targetProjectId ? { id: targetProjectId, name: targetProjectName } : null }
                    : b
            ));

            // If viewing a specific project, refresh to show/hide the brand
            if (!isAllProjectsSelected) {
                router.refresh();
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Errore durante lo spostamento');
        } finally {
            setMovingId(null);
        }
    };

    useEffect(() => {
        if (projectLoading) return;

        const fetchBrands = async () => {
            setLoading(true);
            setError(null);

            try {
                // If a specific project is selected, filter by it
                const url = isAllProjectsSelected || !selectedProject
                    ? '/api/visibility/brands'
                    : `/api/visibility/brands?projectId=${selectedProject.id}`;

                const res = await fetch(url);
                if (!res.ok) throw new Error('Failed to fetch brands');

                const data = await res.json();
                setBrands(data.brands || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Errore sconosciuto');
            } finally {
                setLoading(false);
            }
        };

        fetchBrands();
    }, [selectedProject?.id, isAllProjectsSelected, projectLoading]);

    const canAddMore = hasVisibility;

    if (loading || projectLoading) {
        return (
            <div className="space-y-8 p-6 max-w-6xl mx-auto">
                <div className="flex justify-between items-center">
                    <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
                    <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 max-w-6xl mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Brand Monitor</h1>
                    <p className="text-gray-500 mt-1">
                        {isAllProjectsSelected
                            ? "Tutti i brand monitorati della tua organizzazione"
                            : `Brand monitorati per il progetto ${selectedProject?.name || ''}`
                        }
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-sm py-1 px-3">
                        {brands.length} brand {isAllProjectsSelected ? 'totali' : 'in questo progetto'}
                    </Badge>
                    {canAddMore ? (
                        <Link href={selectedProject && !isAllProjectsSelected
                            ? `/dashboard/visibility/create?projectId=${selectedProject.id}`
                            : "/dashboard/visibility/create"
                        }>
                            <Button className="bg-purple-600 hover:bg-purple-700 gap-2">
                                <Plus className="w-4 h-4" />
                                Nuovo Brand
                            </Button>
                        </Link>
                    ) : (
                        <Link href="/dashboard/billing/plans">
                            <Button variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
                                <Zap className="w-4 h-4" />
                                Upgrade per Brand Monitor
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Brand Cards */}
            {brands.length === 0 ? (
                <Card className="border-dashed border-2">
                    <CardContent className="py-16 text-center">
                        <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {isAllProjectsSelected
                                ? "Nessun brand configurato"
                                : `Nessun brand per il progetto "${selectedProject?.name}"`
                            }
                        </h3>
                        <p className="text-gray-500 mb-6 max-w-md mx-auto">
                            Configura il monitoraggio della visibilità per scoprire come i principali LLM parlano del tuo brand.
                        </p>
                        <Link href={selectedProject && !isAllProjectsSelected
                            ? `/dashboard/visibility/create?projectId=${selectedProject.id}`
                            : "/dashboard/visibility/create"
                        }>
                            <Button className="bg-purple-600 hover:bg-purple-700 gap-2">
                                <Plus className="w-4 h-4" />
                                Configura il primo brand
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {brands.map((brand) => {
                        const latestScan = brand.scans[0];
                        const score = latestScan?.score || 0;

                        return (
                            <Card key={brand.id} className="hover:shadow-lg transition-all group overflow-hidden">
                                <CardContent className="p-0">
                                    {/* Header with score */}
                                    <div className={`p-4 ${score >= 70 ? 'bg-green-50' : score >= 40 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${score >= 70 ? 'bg-green-100' : score >= 40 ? 'bg-amber-100' : 'bg-gray-100'}`}>
                                                    <Eye className={`w-5 h-5 ${score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-gray-400'}`} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                                                        {brand.brandName}
                                                    </h3>
                                                    <p className="text-xs text-gray-500">{brand.category}</p>
                                                </div>
                                            </div>
                                            <Badge className={`text-lg font-bold ${score >= 70 ? 'bg-green-600' : score >= 40 ? 'bg-amber-500' : 'bg-gray-400'}`}>
                                                {score}%
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="p-4 space-y-4">
                                        {/* Project association - only show when viewing all projects */}
                                        {isAllProjectsSelected && brand.project ? (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Building2 className="w-4 h-4 text-gray-400" />
                                                <span className="text-gray-600">Progetto:</span>
                                                <Link href={`/dashboard/projects/${brand.project.id}`} className="text-purple-600 hover:underline font-medium">
                                                    {brand.project.name}
                                                </Link>
                                            </div>
                                        ) : isAllProjectsSelected ? (
                                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                                <Building2 className="w-4 h-4" />
                                                <span>Non associato a un progetto</span>
                                            </div>
                                        ) : null}

                                        {/* Stats */}
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                                                <p className="text-xs text-gray-500">Prompt</p>
                                                <p className="font-bold text-gray-900">{brand._count.prompts}</p>
                                            </div>
                                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                                                <p className="text-xs text-gray-500">Competitor</p>
                                                <p className="font-bold text-gray-900">{brand._count.competitors}</p>
                                            </div>
                                        </div>

                                        {/* Last scan date */}
                                        {latestScan?.completedAt && (
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <Calendar className="w-3 h-3" />
                                                <span>Ultimo scan: {new Date(latestScan.completedAt).toLocaleDateString('it-IT')}</span>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-2 pt-2 border-t">
                                            <Link href={`/dashboard/visibility?brandId=${brand.id}`} className="flex-1">
                                                <Button variant="outline" size="sm" className="w-full gap-1">
                                                    <BarChart3 className="w-4 h-4" />
                                                    Risultati
                                                </Button>
                                            </Link>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="gap-1" disabled={deletingId === brand.id}>
                                                        {deletingId === brand.id ? (
                                                            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                                        ) : (
                                                            <MoreVertical className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/visibility/create?configId=${brand.id}`} className="flex items-center gap-2">
                                                            <Settings className="w-4 h-4" />
                                                            Modifica
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {projects.length > 0 && (
                                                        <DropdownMenuSub>
                                                            <DropdownMenuSubTrigger>
                                                                <FolderInput className="w-4 h-4 mr-2" />
                                                                Sposta in progetto
                                                            </DropdownMenuSubTrigger>
                                                            <DropdownMenuSubContent>
                                                                {projects
                                                                    .filter(p => p.id !== brand.project?.id)
                                                                    .map(project => (
                                                                        <DropdownMenuItem
                                                                            key={project.id}
                                                                            onClick={() => handleMoveBrand(brand.id, project.id, project.name)}
                                                                            disabled={movingId === brand.id}
                                                                        >
                                                                            {project.name}
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                {brand.project && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            onClick={() => handleMoveBrand(brand.id, null, 'Nessun progetto')}
                                                                            disabled={movingId === brand.id}
                                                                            className="text-gray-500"
                                                                        >
                                                                            Rimuovi da progetto
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuSubContent>
                                                        </DropdownMenuSub>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                        onClick={() => handleDeleteBrand(brand.id, brand.brandName)}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Elimina
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {/* Add more card (if allowed) */}
                    {canAddMore && brands.length > 0 && (
                        <Link href={selectedProject && !isAllProjectsSelected
                            ? `/dashboard/visibility/create?projectId=${selectedProject.id}`
                            : "/dashboard/visibility/create"
                        }>
                            <Card className="border-dashed border-2 hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer h-full min-h-[200px]">
                                <CardContent className="h-full flex flex-col items-center justify-center py-8">
                                    <div className="p-3 bg-purple-100 rounded-full mb-3">
                                        <Plus className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <p className="font-medium text-gray-900">Aggiungi Brand</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Monitoraggio illimitato
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
                    )}
                </div>
            )}

            {/* Plan info */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-100">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-900">Piano {planType}</h3>
                        <p className="text-sm text-gray-600">
                            {hasVisibility
                                ? 'Brand Monitor illimitato - ogni scansione consuma crediti AI'
                                : 'Il Brand Monitor non è incluso nel tuo piano'
                            }
                        </p>
                    </div>
                    {!hasVisibility && (
                        <Link href="/dashboard/billing/plans">
                            <Button variant="outline" className="gap-2">
                                <Zap className="w-4 h-4" />
                                Upgrade piano
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
