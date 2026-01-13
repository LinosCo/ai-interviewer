import * as cheerio from 'cheerio';

export interface ScrapedContent {
    title: string;
    content: string;
    description?: string;
    url: string;
}

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'BusinessTunerBot/1.0 (AI Assistant; +https://businesstuner.ai)'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove script, style, and navigation elements to clean up text
        $('script, style, nav, footer, header, aside, .ad, .cookie-banner').remove();

        const title = $('title').text().trim() || $('h1').first().text().trim() || url;
        const description = $('meta[name="description"]').attr('content')?.trim();

        // Extract main content
        // Try to find main content container
        let contentEl = $('main, article, #content, .content, .main').first();

        // Fallback to body if no main container found
        if (contentEl.length === 0) {
            contentEl = $('body');
        }

        // Convert to clean text
        // Replace block elements with newlines to preserve structure
        $('br').replaceWith('\n');
        $('p, h1, h2, h3, h4, h5, h6, li, tr').after('\n');

        const content = contentEl.text()
            .replace(/\s\s+/g, ' ') // Collapse multiple spaces
            .replace(/\n\s*\n/g, '\n\n') // Collapse multiple newlines
            .trim();

        if (content.length < 50) {
            throw new Error("Content too short or couldn't extract meaningful text");
        }

        return {
            title,
            content,
            description,
            url
        };
    } catch (error: any) {
        console.error(`Scraping error for ${url}:`, error);
        throw new Error(`Failed to scrape URL: ${error.message}`);
    }
}
