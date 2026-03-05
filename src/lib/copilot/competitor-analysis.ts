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
    contentGaps: string | null;
    strengths: string | null;
    weaknesses: string | null;
    lastAnalyzedAt: Date | null;
  } | null;
}

export interface CompetitorReport {
  brandName: string;
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

        // Fix 5: Guard empty/null competitor names in matching
        const match = compPositions.find((cp) => {
          if (!cp.name) return false;
          const cpName = cp.name.toLowerCase();
          const compName = comp.name.toLowerCase();
          return cpName.includes(compName) || compName.includes(cpName);
        });

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

      // Fix 4: Serialize profile fields with concrete types
      const profile = comp.profile ? {
        positioningNotes: comp.profile.positioningNotes,
        contentGaps: comp.profile.contentGaps !== null && comp.profile.contentGaps !== undefined
          ? JSON.stringify(comp.profile.contentGaps).slice(0, 500)
          : null,
        strengths: comp.profile.strengths !== null && comp.profile.strengths !== undefined
          ? JSON.stringify(comp.profile.strengths).slice(0, 300)
          : null,
        weaknesses: comp.profile.weaknesses !== null && comp.profile.weaknesses !== undefined
          ? JSON.stringify(comp.profile.weaknesses).slice(0, 300)
          : null,
        lastAnalyzedAt: comp.profile.lastAnalyzedAt,
      } : null;

      return {
        name: comp.name,
        website: comp.website,
        avgPosition: avgPosition !== null ? Math.round(avgPosition * 10) / 10 : null,
        mentionCount,
        platformsCited: [...platformSet],
        // Fix 2: Sort recentPositions by recency before slicing
        recentPositions: positions
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 5),
        profile,
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
