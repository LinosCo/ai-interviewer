'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Plus, Settings, Unlink, Link2, Loader2, BarChart3 } from "lucide-react";
import Link from 'next/link';
import { showToast } from '@/components/toast';

interface Brand {
    id: string;
    brandName: string;
    category: string;
    projectId: string | null;
    latestScore: number | null;
}

interface ProjectBrandManagerProps {
    projectId: string;
    projectName: string;
}

export function ProjectBrandManager({ projectId, projectName }: ProjectBrandManagerProps) {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [unlinkedBrands, setUnlinkedBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [maxBrands, setMaxBrands] = useState(0);

    useEffect(() => {
        fetchBrands();
    }, [projectId]);

    const fetchBrands = async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/brands`);
            if (res.ok) {
                const data = await res.json();
                setBrands(data.linkedBrands || []);
                setUnlinkedBrands(data.unlinkedBrands || []);
                setMaxBrands(data.maxBrands || 0);
            }
        } catch (err) {
            console.error('Error fetching brands:', err);
        } finally {
            setLoading(false);
        }
    };

    const linkBrand = async (brandId: string) => {
        setActionLoading(brandId);
        try {
            const res = await fetch(`/api/projects/${projectId}/brands`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brandId, action: 'link' })
            });

            if (res.ok) {
                showToast('Brand collegato al progetto');
                fetchBrands();
            } else {
                const data = await res.json();
                showToast(data.error || 'Errore nel collegamento', 'error');
            }
        } catch (err) {
            showToast('Errore di rete', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const unlinkBrand = async (brandId: string) => {
        setActionLoading(brandId);
        try {
            const res = await fetch(`/api/projects/${projectId}/brands`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brandId, action: 'unlink' })
            });

            if (res.ok) {
                showToast('Brand scollegato dal progetto');
                fetchBrands();
            } else {
                const data = await res.json();
                showToast(data.error || 'Errore nello scollegamento', 'error');
            }
        } catch (err) {
            showToast('Errore di rete', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Caricamento brand...
                    </div>
                </CardContent>
            </Card>
        );
    }

    const totalBrands = brands.length + unlinkedBrands.length;
    const canAddMore = totalBrands < maxBrands;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Eye className="w-5 h-5 text-purple-600" />
                            Brand Monitor
                        </CardTitle>
                        <CardDescription>
                            Gestisci i brand monitorati per questo progetto
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-sm">
                        {totalBrands} / {maxBrands} brand
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Linked Brands */}
                <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Brand collegati a {projectName}
                    </h4>
                    {brands.length === 0 ? (
                        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed">
                            <Eye className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">
                                Nessun brand collegato a questo progetto
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {brands.map(brand => (
                                <div
                                    key={brand.id}
                                    className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-100 rounded-lg">
                                            <Eye className="w-4 h-4 text-purple-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{brand.brandName}</p>
                                            <p className="text-xs text-gray-500">{brand.category}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {brand.latestScore !== null && (
                                            <Badge className={brand.latestScore >= 50 ? 'bg-green-600' : 'bg-amber-500'}>
                                                {brand.latestScore}%
                                            </Badge>
                                        )}
                                        <Link href={`/dashboard/visibility?brandId=${brand.id}`}>
                                            <Button variant="ghost" size="sm">
                                                <BarChart3 className="w-4 h-4" />
                                            </Button>
                                        </Link>
                                        <Link href={`/dashboard/visibility/create?configId=${brand.id}`}>
                                            <Button variant="ghost" size="sm">
                                                <Settings className="w-4 h-4" />
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => unlinkBrand(brand.id)}
                                            disabled={actionLoading === brand.id}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            {actionLoading === brand.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Unlink className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Unlinked Brands (available to link) */}
                {unlinkedBrands.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            Brand disponibili da collegare
                        </h4>
                        <div className="space-y-2">
                            {unlinkedBrands.map(brand => (
                                <div
                                    key={brand.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 rounded-lg">
                                            <Eye className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{brand.brandName}</p>
                                            <p className="text-xs text-gray-500">{brand.category}</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => linkBrand(brand.id)}
                                        disabled={actionLoading === brand.id}
                                        className="gap-1"
                                    >
                                        {actionLoading === brand.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Link2 className="w-4 h-4" />
                                                Collega
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Create new brand */}
                {canAddMore && (
                    <div className="pt-4 border-t">
                        <Link href={`/dashboard/visibility/create?projectId=${projectId}`}>
                            <Button variant="outline" className="w-full gap-2">
                                <Plus className="w-4 h-4" />
                                Crea nuovo brand per questo progetto
                            </Button>
                        </Link>
                    </div>
                )}

                {!canAddMore && (
                    <div className="pt-4 border-t">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                            <p className="text-sm text-amber-800">
                                Hai raggiunto il limite di brand del tuo piano.{' '}
                                <Link href="/dashboard/billing/plans" className="font-medium underline">
                                    Passa a un piano superiore
                                </Link>{' '}
                                per monitorare più brand.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
