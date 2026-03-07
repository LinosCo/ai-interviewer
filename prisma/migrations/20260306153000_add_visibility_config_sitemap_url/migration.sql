-- Persist optional sitemap URL used by Brand Monitor site analysis setup.
ALTER TABLE "VisibilityConfig"
ADD COLUMN IF NOT EXISTS "sitemapUrl" TEXT;
