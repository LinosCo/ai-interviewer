/**
 * Brand Report PDF Template
 *
 * Generates a management-ready PDF report for a BrandReport record.
 * Uses @react-pdf/renderer for server-side PDF generation.
 */

import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
} from '@react-pdf/renderer';

// ─── Styles ───────────────────────────────────────────────────────────────────

const palette = {
    amber: '#F59E0B',
    amberLight: '#FEF3C7',
    slate: '#1E293B',
    muted: '#64748B',
    border: '#E2E8F0',
    white: '#FFFFFF',
    red: '#EF4444',
    green: '#10B981',
    orange: '#F97316',
};

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica',
        backgroundColor: palette.white,
        paddingHorizontal: 40,
        paddingVertical: 36,
        fontSize: 10,
        color: palette.slate,
    },
    // Header
    header: {
        marginBottom: 24,
        borderBottomWidth: 2,
        borderBottomColor: palette.amber,
        paddingBottom: 12,
    },
    brandName: {
        fontSize: 22,
        fontFamily: 'Helvetica-Bold',
        color: palette.slate,
        marginBottom: 4,
    },
    reportTitle: {
        fontSize: 13,
        color: palette.muted,
    },
    reportDate: {
        fontSize: 9,
        color: palette.muted,
        marginTop: 4,
    },
    // Section
    sectionTitle: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: palette.slate,
        marginBottom: 8,
        marginTop: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // Score cards row
    scoreRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    scoreCard: {
        flex: 1,
        backgroundColor: palette.amberLight,
        borderRadius: 6,
        padding: 10,
        alignItems: 'center',
    },
    scoreValue: {
        fontSize: 24,
        fontFamily: 'Helvetica-Bold',
        color: palette.amber,
    },
    scoreLabel: {
        fontSize: 8,
        color: palette.muted,
        textAlign: 'center',
        marginTop: 2,
    },
    // Tip card
    tipCard: {
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 6,
        padding: 10,
        marginBottom: 8,
    },
    tipHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    tipTitle: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        flex: 1,
        color: palette.slate,
    },
    badge: {
        fontSize: 7,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 3,
        textTransform: 'uppercase',
        fontFamily: 'Helvetica-Bold',
    },
    badgeCritical: { backgroundColor: '#FEE2E2', color: palette.red },
    badgeHigh: { backgroundColor: '#FFEDD5', color: palette.orange },
    badgeMedium: { backgroundColor: palette.amberLight, color: palette.amber },
    badgeLow: { backgroundColor: '#F0FDF4', color: palette.green },
    tipDescription: {
        fontSize: 9,
        color: palette.muted,
        lineHeight: 1.4,
        marginBottom: 4,
    },
    tipImpact: {
        fontSize: 9,
        color: palette.slate,
        fontFamily: 'Helvetica-Oblique',
    },
    // Table
    table: {
        marginBottom: 12,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        paddingVertical: 5,
    },
    tableHeader: {
        backgroundColor: '#F8FAFC',
    },
    tableCell: {
        fontSize: 9,
        flex: 1,
        color: palette.slate,
    },
    tableCellBold: {
        fontSize: 9,
        flex: 1,
        fontFamily: 'Helvetica-Bold',
        color: palette.slate,
    },
    // Footer
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 40,
        right: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: palette.border,
        paddingTop: 6,
    },
    footerText: {
        fontSize: 8,
        color: palette.muted,
    },
    summaryBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
    },
    summaryText: {
        fontSize: 10,
        color: palette.slate,
        lineHeight: 1.5,
    },
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface AITip {
    category: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
    estimatedEffort: string;
}

interface BrandReportPDFProps {
    brandName: string;
    websiteUrl: string;
    generatedAt: Date;
    overallScore: number;
    seoScore: number;
    llmoScore: number;
    geoScore: number;
    serpScore: number;
    pagesAudited: number;
    summaryInsight?: string;
    tips: AITip[];
    topSeoIssues?: Array<{ issue: string; count: number }>;
    topLlmoIssues?: Array<{ issue: string; count: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priorityBadgeStyle(priority: string) {
    switch (priority) {
        case 'critical': return styles.badgeCritical;
        case 'high': return styles.badgeHigh;
        case 'medium': return styles.badgeMedium;
        default: return styles.badgeLow;
    }
}

function priorityLabel(priority: string): string {
    const map: Record<string, string> = {
        critical: '🔴 Critico',
        high: '🟠 Alto',
        medium: '🟡 Medio',
        low: '🟢 Basso',
    };
    return map[priority] ?? priority;
}

function categoryLabel(category: string): string {
    const map: Record<string, string> = {
        seo_onpage: 'SEO On-Page',
        seo_technical: 'SEO Tecnico',
        llmo_schema: 'LLMO Schema',
        llmo_content: 'LLMO Contenuto',
        content_strategy: 'Content Strategy',
        gsc_performance: 'GSC Performance',
        geo_visibility: 'GEO Visibilità',
    };
    return map[category] ?? category;
}

// ─── PDF Document ──────────────────────────────────────────────────────────────

export function BrandReportPDF({
    brandName,
    websiteUrl,
    generatedAt,
    overallScore,
    seoScore,
    llmoScore,
    geoScore,
    serpScore,
    pagesAudited,
    summaryInsight,
    tips,
    topSeoIssues = [],
    topLlmoIssues = [],
}: BrandReportPDFProps) {
    const dateStr = generatedAt.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.brandName}>{brandName}</Text>
                    <Text style={styles.reportTitle}>
                        Report SEO & AI Visibility — {websiteUrl}
                    </Text>
                    <Text style={styles.reportDate}>Generato il {dateStr}</Text>
                </View>

                {/* Score overview */}
                <Text style={styles.sectionTitle}>Panoramica Score</Text>
                <View style={styles.scoreRow}>
                    <View style={styles.scoreCard}>
                        <Text style={styles.scoreValue}>{overallScore}</Text>
                        <Text style={styles.scoreLabel}>Score Globale</Text>
                    </View>
                    <View style={styles.scoreCard}>
                        <Text style={styles.scoreValue}>{seoScore}</Text>
                        <Text style={styles.scoreLabel}>SEO Tecnico</Text>
                    </View>
                    <View style={styles.scoreCard}>
                        <Text style={styles.scoreValue}>{llmoScore}</Text>
                        <Text style={styles.scoreLabel}>LLMO / AI</Text>
                    </View>
                    <View style={styles.scoreCard}>
                        <Text style={styles.scoreValue}>{geoScore}</Text>
                        <Text style={styles.scoreLabel}>GEO Brand</Text>
                    </View>
                    <View style={styles.scoreCard}>
                        <Text style={styles.scoreValue}>{serpScore}</Text>
                        <Text style={styles.scoreLabel}>SERP</Text>
                    </View>
                </View>

                <Text style={{ fontSize: 9, color: palette.muted, marginBottom: 12 }}>
                    Pagine analizzate: {pagesAudited}
                </Text>

                {/* Strategic summary */}
                {summaryInsight && (
                    <>
                        <Text style={styles.sectionTitle}>Sintesi Strategica</Text>
                        <View style={styles.summaryBox}>
                            <Text style={styles.summaryText}>{summaryInsight}</Text>
                        </View>
                    </>
                )}

                {/* Top SEO issues */}
                {topSeoIssues.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Principali Problemi SEO</Text>
                        <View style={styles.table}>
                            <View style={[styles.tableRow, styles.tableHeader]}>
                                <Text style={styles.tableCellBold}>Problema</Text>
                                <Text style={[styles.tableCellBold, { flex: 0.3, textAlign: 'right' }]}>Pagine</Text>
                            </View>
                            {topSeoIssues.slice(0, 5).map((issue, i) => (
                                <View key={i} style={styles.tableRow}>
                                    <Text style={styles.tableCell}>{issue.issue}</Text>
                                    <Text style={[styles.tableCell, { flex: 0.3, textAlign: 'right' }]}>{issue.count}</Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}

                {/* Top LLMO issues */}
                {topLlmoIssues.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Principali Problemi AI Optimization</Text>
                        <View style={styles.table}>
                            <View style={[styles.tableRow, styles.tableHeader]}>
                                <Text style={styles.tableCellBold}>Opportunità LLMO</Text>
                                <Text style={[styles.tableCellBold, { flex: 0.3, textAlign: 'right' }]}>Pagine</Text>
                            </View>
                            {topLlmoIssues.slice(0, 5).map((issue, i) => (
                                <View key={i} style={styles.tableRow}>
                                    <Text style={styles.tableCell}>{issue.issue}</Text>
                                    <Text style={[styles.tableCell, { flex: 0.3, textAlign: 'right' }]}>{issue.count}</Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}

                {/* AI Tips */}
                {tips.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>
                            Raccomandazioni AI ({tips.length})
                        </Text>
                        {tips.map((tip, i) => (
                            <View key={i} style={styles.tipCard} wrap={false}>
                                <View style={styles.tipHeader}>
                                    <Text style={styles.tipTitle}>{tip.title}</Text>
                                    <Text style={[styles.badge, priorityBadgeStyle(tip.priority)]}>
                                        {priorityLabel(tip.priority)}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 8, color: palette.muted, marginBottom: 4 }}>
                                    {categoryLabel(tip.category)}
                                </Text>
                                <Text style={styles.tipDescription}>{tip.description}</Text>
                                <Text style={styles.tipImpact}>Impatto atteso: {tip.impact}</Text>
                            </View>
                        ))}
                    </>
                )}

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>{brandName} — Report SEO & AI</Text>
                    <Text style={styles.footerText}>{dateStr}</Text>
                    <Text
                        style={styles.footerText}
                        render={({ pageNumber, totalPages }) =>
                            `Pagina ${pageNumber} di ${totalPages}`
                        }
                    />
                </View>
            </Page>
        </Document>
    );
}
