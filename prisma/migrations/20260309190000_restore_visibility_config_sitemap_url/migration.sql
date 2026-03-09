-- Restore optional sitemap URL used by Brand Monitor and website analysis flows.
ALTER TABLE "VisibilityConfig"
ADD COLUMN IF NOT EXISTS "sitemapUrl" TEXT;
