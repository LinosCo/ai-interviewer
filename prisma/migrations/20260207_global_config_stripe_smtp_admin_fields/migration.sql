-- AlterTable
ALTER TABLE "GlobalConfig"
ADD COLUMN "stripePriceBusinessYearly" TEXT,
ADD COLUMN "stripePricePackSmall" TEXT,
ADD COLUMN "stripePricePackMedium" TEXT,
ADD COLUMN "stripePricePackLarge" TEXT,
ADD COLUMN "smtpHost" TEXT,
ADD COLUMN "smtpPort" INTEGER,
ADD COLUMN "smtpSecure" BOOLEAN,
ADD COLUMN "smtpUser" TEXT,
ADD COLUMN "smtpPass" TEXT,
ADD COLUMN "smtpFromEmail" TEXT,
ADD COLUMN "smtpNotificationEmail" TEXT,
ADD COLUMN "resendApiKey" TEXT;
