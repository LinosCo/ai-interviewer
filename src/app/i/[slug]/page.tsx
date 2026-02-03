import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import LandingPage from '@/components/interview/LandingPage';
import { canStartInterview } from '@/lib/usage';
import { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { Suspense } from 'react';

// Cache bot data for 60 seconds - landing pages can tolerate slight staleness
const getBotBySlug = unstable_cache(
    async (slug: string) => {
        return prisma.bot.findUnique({
            where: { slug },
            include: {
                project: { include: { organization: true } },
                topics: { orderBy: { orderIndex: 'asc' } }
            }
        });
    },
    ['bot-by-slug'],
    { revalidate: 60, tags: ['bot'] }
);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const bot = await getBotBySlug(slug);

    if (!bot) return {};

    const title = bot.landingTitle || bot.name;
    const brandName = bot.project?.organization?.name || 'Business Tuner';
    const fullTitle = `${title} | ${brandName}`;
    const description = bot.landingDescription || bot.researchGoal || `Partecipa all'intervista interattiva "${title}" - Un'esperienza conversazionale intelligente creata con Business Tuner.`;
    const image = bot.landingImageUrl || bot.logoUrl;
    const canonicalUrl = `https://businesstuner.voler.ai/i/${slug}`;

    return {
        title: fullTitle,
        description,
        keywords: [
            'intervista AI', 'chatbot intelligente', 'feedback clienti',
            'ricerca di mercato', 'survey conversazionale', brandName, title
        ].filter(Boolean),
        authors: [{ name: brandName }],
        creator: brandName,
        publisher: 'Business Tuner',
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-video-preview': -1,
                'max-image-preview': 'large',
                'max-snippet': -1,
            },
        },
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            type: 'website',
            locale: 'it_IT',
            url: canonicalUrl,
            siteName: 'Business Tuner',
            title: fullTitle,
            description,
            images: image ? [{
                url: image,
                width: 1200,
                height: 630,
                alt: `${title} - Intervista interattiva`,
            }] : [{
                url: 'https://businesstuner.voler.ai/og-default.png',
                width: 1200,
                height: 630,
                alt: 'Business Tuner - Interviste AI',
            }],
        },
        twitter: {
            card: 'summary_large_image',
            site: '@businesstuner',
            creator: '@businesstuner',
            title: fullTitle,
            description,
            images: image ? [image] : ['https://businesstuner.voler.ai/og-default.png'],
        },
        other: {
            'theme-color': bot.primaryColor || '#f59e0b',
        },
    };
}

// Usage limit check component - renders error or nothing
async function UsageLimitCheck({ organizationId }: { organizationId: string }) {
    const check = await canStartInterview(organizationId);

    if (!check.allowed) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-50">
                <div className="max-w-md mx-auto p-6 text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                        <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-amber-900 mb-2">Limite raggiunto</h1>
                    <p className="text-amber-700">{check.reason}</p>
                    <p className="mt-4 text-sm text-amber-600">Torna più tardi o contatta il proprietario dell&apos;intervista.</p>
                </div>
            </div>
        );
    }

    return null;
}

// Loading fallback for usage check
function UsageCheckLoading() {
    return null; // Don't show anything while checking - landing page is already visible
}

export default async function InterviewPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const bot = await getBotBySlug(slug);

    if (!bot) notFound();

    const organizationId = bot.project?.organizationId;

    // Server Action to start interview
    const startInterview = async () => {
        'use server';

        // Re-check usage at start time (double-check)
        if (organizationId) {
            const check = await canStartInterview(organizationId);
            if (!check.allowed) {
                throw new Error(check.reason || 'Limite raggiunto');
            }
        }

        // Initialize with the first topic
        const firstTopic = bot.topics[0];

        // Generate unique participant ID using crypto
        const participantId = `anon-${crypto.randomUUID().slice(0, 8)}`;

        const conversation = await prisma.conversation.create({
            data: {
                botId: bot.id,
                participantId,
                status: 'STARTED',
                currentTopicId: firstTopic?.id || null,
            }
        });

        redirect(`/i/chat/${conversation.id}`);
    };

    // JSON-LD Structured Data for SEO
    const brandName = bot.project?.organization?.name || 'Business Tuner';
    const title = bot.landingTitle || bot.name;
    const description = bot.landingDescription || bot.researchGoal || `Intervista interattiva ${title}`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebPage',
                '@id': `https://businesstuner.voler.ai/i/${slug}#webpage`,
                url: `https://businesstuner.voler.ai/i/${slug}`,
                name: `${title} | ${brandName}`,
                description,
                isPartOf: {
                    '@type': 'WebSite',
                    '@id': 'https://businesstuner.voler.ai/#website',
                    name: 'Business Tuner',
                    url: 'https://businesstuner.voler.ai',
                },
                inLanguage: 'it-IT',
                potentialAction: {
                    '@type': 'ReadAction',
                    target: `https://businesstuner.voler.ai/i/${slug}`,
                },
            },
            {
                '@type': 'Organization',
                '@id': 'https://businesstuner.voler.ai/#organization',
                name: 'Business Tuner',
                url: 'https://businesstuner.voler.ai',
                logo: {
                    '@type': 'ImageObject',
                    url: 'https://businesstuner.voler.ai/logo.png',
                },
                sameAs: [
                    'https://www.linkedin.com/company/business-tuner',
                ],
            },
            {
                '@type': 'SoftwareApplication',
                name: title,
                applicationCategory: 'BusinessApplication',
                operatingSystem: 'Web',
                offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'EUR',
                },
                description,
                provider: {
                    '@type': 'Organization',
                    name: brandName,
                },
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {/* Landing page renders immediately */}
            <LandingPage bot={bot} onStart={startInterview} />

            {/* Usage check streams in - blocks UI if limit reached */}
            {organizationId && (
                <Suspense fallback={<UsageCheckLoading />}>
                    <UsageLimitCheck organizationId={organizationId} />
                </Suspense>
            )}
        </>
    );
}
