import { prisma } from '@/lib/prisma';

export interface CompetitorIntelligence {
  name: string;
  website: string | null;
  avgPosition: number | null;
  mentionCount: number;
  platformsCited: string[];
  recentPositions: Array<{ platform: string; position: number | null; date: Date }>;
  profile: {
    positioningNotes: string | null;
    contentGaps: unknown;
    strengths: unknown;
    weaknesses: unknown;
    lastAnalyzedAt: Date | null;
  } | null;
}

export interface CompetitorReport {
  brandName: string | null;
  brandAvgPosition: number | null;
  competitors: CompetitorIntelligence[];
  scanCount: number;
  dateRange: { from: Date | null; to: Date | null };
}

export async function getCompetitorIntelligence(
  organizationId: string,
  projectId?: string | null,
  limit = 5
): Promise<CompetitorReport[]> {
  // Fetch visibility configs for org/project
  const configs = await prisma.visibilityConfig.findMany({
    where: {
      organizationId,
      ...(projectId ? {
        OR: [
          { projectId },
          { projectShares: { some: { projectId } } }
        ]
      } : {}),
    },
    select: {
      id: true,
      brandName: true,
      competitors: {
        where: { enabled: true },
        select: {
          id: true,
          name: true,
          website: true,
          profile: {
            select: {
              positioningNotes: true,
              contentGaps: true,
              strengths: true,
              weaknesses: true,
              lastAnalyzedAt: true,
            }
          }
        }
      },
      scans: {
        orderBy: { startedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          startedAt: true,
          score: true,
          responses: {
            select: {
              platform: true,
              brandPosition: true,
              competitorPositions: true,
              createdAt: true,
            }
          }
        }
      }
    },
    take: limit,
  });

  return configs.map((config) => {
    const allResponses = config.scans.flatMap((s) => s.responses);
    const scanCount = config.scans.length;

    // Brand average position
    const brandPositions = allResponses
      .map((r) => r.brandPosition)
      .filter((p): p is number => p !== null && p !== undefined);
    const brandAvgPosition = brandPositions.length > 0
      ? brandPositions.reduce((a, b) => a + b, 0) / brandPositions.length
      : null;

    const dateRange = {
      from: config.scans.at(-1)?.startedAt ?? null,
      to: config.scans.at(0)?.startedAt ?? null,
    };

    // Aggregate per competitor
    const competitors: CompetitorIntelligence[] = config.competitors.map((comp) => {
      const positions: Array<{ platform: string; position: number | null; date: Date }> = [];
      let mentionCount = 0;
      const platformSet = new Set<string>();

      for (const resp of allResponses) {
        const compPositions = Array.isArray(resp.competitorPositions)
          ? (resp.competitorPositions as Array<{ name?: string; position?: number | null }>)
          : [];

        const match = compPositions.find(
          (cp) => cp.name?.toLowerCase().includes(comp.name.toLowerCase()) ||
                  comp.name.toLowerCase().includes(cp.name?.toLowerCase() ?? '')
        );

        if (match) {
          mentionCount++;
          platformSet.add(resp.platform);
          positions.push({
            platform: resp.platform,
            position: match.position ?? null,
            date: resp.createdAt,
          });
        }
      }

      const numericPositions = positions
        .map((p) => p.position)
        .filter((p): p is number => p !== null);
      const avgPosition = numericPositions.length > 0
        ? numericPositions.reduce((a, b) => a + b, 0) / numericPositions.length
        : null;

      return {
        name: comp.name,
        website: comp.website,
        avgPosition: avgPosition !== null ? Math.round(avgPosition * 10) / 10 : null,
        mentionCount,
        platformsCited: [...platformSet],
        recentPositions: positions.slice(0, 5),
        profile: comp.profile ?? null,
      };
    });

    return {
      brandName: config.brandName,
      brandAvgPosition: brandAvgPosition !== null ? Math.round(brandAvgPosition * 10) / 10 : null,
      competitors: competitors.sort((a, b) => (a.avgPosition ?? 999) - (b.avgPosition ?? 999)),
      scanCount,
      dateRange,
    };
  });
}
