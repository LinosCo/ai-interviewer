-- AlterTable
ALTER TABLE "Bot" ADD COLUMN     "formatExplanation" TEXT,
ADD COLUMN     "progressBarStyle" TEXT NOT NULL DEFAULT 'semantic',
ADD COLUMN     "showProgressBar" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showTopicPreview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "welcomeSubtitle" TEXT,
ADD COLUMN     "welcomeTitle" TEXT;
