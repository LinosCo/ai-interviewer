import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export const alt = 'Interview';
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

const BRAND_NAME = 'Business Tuner';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://businesstuner.voler.ai';

function isUsableImageUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    // Exclude Base64 data URLs (cannot be fetched by ImageResponse)
    if (url.startsWith('data:')) return false;
    // Accept absolute URLs and our API paths
    return url.startsWith('http') || url.startsWith('/api/uploads');
}

function toAbsoluteUrl(url: string): string {
    if (url.startsWith('http')) return url;
    return `${APP_URL}${url}`;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    const bot = await prisma.bot.findUnique({
        where: { slug },
        select: {
            name: true,
            landingTitle: true,
            landingDescription: true,
            landingImageUrl: true,
            logoUrl: true,
            primaryColor: true,
            backgroundColor: true,
            project: {
                select: {
                    organization: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        },
    });

    const title = bot?.landingTitle || bot?.name || 'Intervista';
    const description = bot?.landingDescription || `Partecipa all'intervista interattiva "${title}"`;
    const brandColor = bot?.primaryColor || '#f59e0b';
    const bgColor = bot?.backgroundColor || '#0f172a';
    const orgName = bot?.project?.organization?.name || BRAND_NAME;

    // Case 1: cover image available
    if (isUsableImageUrl(bot?.landingImageUrl)) {
        const coverUrl = toAbsoluteUrl(bot!.landingImageUrl!);

        return new ImageResponse(
            (
                <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                            padding: '40px 60px 50px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                        }}
                    >
                        <div style={{ fontSize: '48px', fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
                            {title}
                        </div>
                        <div style={{ fontSize: '24px', color: 'rgba(255,255,255,0.75)' }}>
                            {orgName}
                        </div>
                    </div>
                </div>
            ),
            { ...size }
        );
    }

    // Case 2: logo available
    if (isUsableImageUrl(bot?.logoUrl)) {
        const logoUrl = toAbsoluteUrl(bot!.logoUrl!);

        return new ImageResponse(
            (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: bgColor.startsWith('#') ? bgColor : '#0f172a',
                        padding: '60px 80px',
                        gap: '32px',
                    }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt={orgName} style={{ maxHeight: '120px', maxWidth: '400px', objectFit: 'contain' }} />
                    <div
                        style={{
                            fontSize: '52px',
                            fontWeight: 800,
                            color: '#ffffff',
                            textAlign: 'center',
                            lineHeight: 1.15,
                            display: 'flex',
                        }}
                    >
                        {title}
                    </div>
                    <div
                        style={{
                            fontSize: '26px',
                            color: 'rgba(255,255,255,0.65)',
                            textAlign: 'center',
                            maxWidth: '900px',
                            lineHeight: 1.4,
                            display: 'flex',
                        }}
                    >
                        {description.slice(0, 120)}
                        {description.length > 120 ? '...' : ''}
                    </div>
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '8px',
                            background: brandColor,
                        }}
                    />
                </div>
            ),
            { ...size }
        );
    }

    // Case 3: fallback generic card
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    padding: '60px 80px',
                }}
            >
                <div style={{ fontSize: '56px', fontWeight: 700, color: '#f59e0b', textAlign: 'center', display: 'flex', marginBottom: '24px' }}>
                    {BRAND_NAME}
                </div>
                <div style={{ fontSize: '36px', color: '#94a3b8', textAlign: 'center', display: 'flex' }}>
                    {title}
                </div>
            </div>
        ),
        { ...size }
    );
}
