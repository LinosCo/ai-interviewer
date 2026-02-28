/**
 * GET /api/export/brand-report?reportId=xxx
 *
 * Generates and streams a PDF for a BrandReport record.
 * The PDF is rendered server-side via @react-pdf/renderer.
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import { BrandReportPDF } from '@/lib/pdf/brand-report-pdf';

export const maxDuration = 60; // PDF rendering can take a few seconds

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const reportId = searchParams.get('reportId');

        if (!reportId) {
            return NextResponse.json({ error: 'reportId is required' }, { status: 400 });
        }

        // Load report with access check
        const report = await prisma.brandReport.findUnique({
            where: { id: reportId },
            include: {
                config: {
                    select: {
                        brandName: true,
                        websiteUrl: true,
                        organizationId: true,
                    },
                },
            },
        });

        if (!report || report.status !== 'completed') {
            return NextResponse.json({ error: 'Report not found or not completed' }, { status: 404 });
        }

        // Verify membership
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: report.config.organizationId,
                },
            },
            select: { status: true },
        });
        if (membership?.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Extract AI tips and audit data from JSON fields
        const aiTips = report.aiTips as {
            tips?: Array<{
                category: string;
                priority: string;
                title: string;
                description: string;
                impact: string;
                estimatedEffort: string;
            }>;
            summaryInsight?: string;
        } | null;

        const seoAuditData = report.seoAuditData as {
            aggregated?: {
                topSeoIssues?: Array<{ issue: string; count: number }>;
                topLlmoIssues?: Array<{ issue: string; count: number }>;
            };
        } | null;

        // Build PDF element
        const element = React.createElement(BrandReportPDF, {
            brandName: report.config.brandName,
            websiteUrl: report.config.websiteUrl ?? '',
            generatedAt: report.generatedAt ?? report.createdAt,
            overallScore: report.overallScore,
            seoScore: report.seoScore,
            llmoScore: report.llmoScore,
            geoScore: report.geoScore,
            serpScore: report.serpScore,
            pagesAudited: report.pagesAudited,
            summaryInsight: aiTips?.summaryInsight,
            tips: (aiTips?.tips ?? []) as Parameters<typeof BrandReportPDF>[0]['tips'],
            topSeoIssues: seoAuditData?.aggregated?.topSeoIssues ?? [],
            topLlmoIssues: seoAuditData?.aggregated?.topLlmoIssues ?? [],
        });

        const stream = await renderToStream(element);

        // Collect stream into Buffer
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream as AsyncIterable<Uint8Array>) {
            chunks.push(chunk);
        }
        const pdfBuffer = Buffer.concat(chunks);

        const filename = `${report.config.brandName.replace(/[^a-z0-9]/gi, '_')}_report.pdf`;

        return new Response(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': String(pdfBuffer.length),
            },
        });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Export failed';
        console.error('[export/brand-report]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
