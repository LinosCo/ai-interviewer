import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Eye, Settings, BarChart3, Building2, Calendar, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLANS, subscriptionTierToPlanType, PlanType } from "@/config/plans";

export default async function BrandsListPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            memberships: {
                take: 1,
                include: {
                    organization: {
                        include: {
                            subscription: true,
                            visibilityConfigs: {
                                orderBy: { createdAt: 'desc' },
                                include: {
                                    project: { select: { id: true, name: true } },
                                    scans: {
                                        orderBy: { completedAt: 'desc' },
                                        take: 1,
                                        where: { status: 'completed' }
                                    },
                                    _count: {
                                        select: { prompts: true, competitors: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    const org = user?.memberships[0]?.organization;
    if (!org) redirect("/login");

    const brands = org.visibilityConfigs;
    const subscription = org.subscription;

    // Get plan limits
    const planType = subscription ? subscriptionTierToPlanType(subscription.tier) : PlanType.TRIAL;
    const plan = PLANS[planType];
    // Brand limit: unlimited (-1) if visibility enabled, otherwise 0
    const maxBrands = plan.limits.visibilityEnabled ? -1 : 0;
    const canAddMore = maxBrands === -1 || brands.length < maxBrands;

    return (
        <div className="space-y-8 p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Brand Monitor</h1>
                    <p className="text-gray-500 mt-1">
                        Gestisci i brand monitorati della tua organizzazione
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-sm py-1 px-3">
                        {brands.length} {maxBrands === -1 ? 'brand' : `/ ${maxBrands} brand`}
                    </Badge>
                    {canAddMore ? (
                        <Link href="/dashboard/visibility/create">
                            <Button className="bg-purple-600 hover:bg-purple-700 gap-2">
                                <Plus className="w-4 h-4" />
                                Nuovo Brand
                            </Button>
                        </Link>
                    ) : (
                        <Link href="/pricing">
                            <Button variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
                                <Zap className="w-4 h-4" />
                                Upgrade per più brand
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
                            Nessun brand configurato
                        </h3>
                        <p className="text-gray-500 mb-6 max-w-md mx-auto">
                            Configura il monitoraggio della visibilità per scoprire come i principali LLM parlano del tuo brand.
                        </p>
                        <Link href="/dashboard/visibility/create">
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
                                        {/* Project association */}
                                        {brand.project ? (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Building2 className="w-4 h-4 text-gray-400" />
                                                <span className="text-gray-600">Progetto:</span>
                                                <Link href={`/dashboard/projects/${brand.project.id}`} className="text-purple-600 hover:underline font-medium">
                                                    {brand.project.name}
                                                </Link>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                                <Building2 className="w-4 h-4" />
                                                <span>Non associato a un progetto</span>
                                            </div>
                                        )}

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
                                        {latestScan && (
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <Calendar className="w-3 h-3" />
                                                <span>Ultimo scan: {latestScan.completedAt?.toLocaleDateString()}</span>
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
                                            <Link href={`/dashboard/visibility/create?configId=${brand.id}`}>
                                                <Button variant="ghost" size="sm" className="gap-1">
                                                    <Settings className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {/* Add more card (if allowed) */}
                    {canAddMore && brands.length > 0 && (
                        <Link href="/dashboard/visibility/create">
                            <Card className="border-dashed border-2 hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer h-full min-h-[200px]">
                                <CardContent className="h-full flex flex-col items-center justify-center py-8">
                                    <div className="p-3 bg-purple-100 rounded-full mb-3">
                                        <Plus className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <p className="font-medium text-gray-900">Aggiungi Brand</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {maxBrands - brands.length} slot disponibili
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
                            {maxBrands === 0
                                ? 'Il brand monitoring non è incluso nel tuo piano'
                                : `Puoi monitorare fino a ${maxBrands} brand con il tuo piano attuale`
                            }
                        </p>
                    </div>
                    {maxBrands < 5 && (
                        <Link href="/pricing">
                            <Button variant="outline" className="gap-2">
                                <Zap className="w-4 h-4" />
                                Vedi piani
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
