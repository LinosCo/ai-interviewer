-- CreateTable
CREATE TABLE "CompetitorProfile" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "positioningNotes" TEXT,
    "contentGaps" JSONB,
    "strengths" JSONB,
    "weaknesses" JSONB,
    "avgPosition" DOUBLE PRECISION,
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "platformsCited" TEXT[],
    "lastAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorProfile_competitorId_key" ON "CompetitorProfile"("competitorId");

-- AddForeignKey
ALTER TABLE "CompetitorProfile" ADD CONSTRAINT "CompetitorProfile_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
