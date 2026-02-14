import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata
const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'Voler AI';

export const alt = `${BRAND_NAME} - Ascolta il mercato. Decidi meglio.`;
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

// Image generation
export default function Image() {
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
                {/* Logo + Brand Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
                    <svg
                        width="80"
                        height="80"
                        viewBox="0 0 48 48"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            <linearGradient id="logoGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#d97706" />
                                <stop offset="50%" stopColor="#f59e0b" />
                                <stop offset="100%" stopColor="#ffd700" />
                            </linearGradient>
                        </defs>
                        <rect width="48" height="48" rx="14" fill="url(#logoGradient)" />
                        <g fill="white" opacity="0.9">
                            <rect x="8" y="28" width="5" height="12" rx="2" opacity="0.4" />
                            <rect x="15" y="24" width="5" height="16" rx="2" opacity="0.55" />
                            <rect x="22" y="18" width="5" height="22" rx="2" opacity="0.7" />
                            <rect x="29" y="14" width="5" height="26" rx="2" opacity="0.85" />
                            <rect x="36" y="20" width="5" height="20" rx="2" opacity="0.7" />
                        </g>
                        <path
                            d="M10 34 L17.5 30 L24.5 22 L31.5 16 L38.5 22"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                        <circle cx="31.5" cy="16" r="3" fill="white" />
                    </svg>
                    <div
                        style={{
                            fontSize: '48px',
                            fontWeight: 800,
                            color: '#ffffff',
                            letterSpacing: '-0.02em',
                            display: 'flex',
                        }}
                    >
                        {BRAND_NAME}
                    </div>
                </div>

                {/* Tagline */}
                <div
                    style={{
                        fontSize: '56px',
                        fontWeight: 700,
                        background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
                        backgroundClip: 'text',
                        color: 'transparent',
                        textAlign: 'center',
                        marginBottom: '24px',
                        display: 'flex',
                    }}
                >
                    Ascolta il mercato. Decidi meglio.
                </div>

                {/* Description */}
                <div
                    style={{
                        fontSize: '28px',
                        fontWeight: 400,
                        color: '#94a3b8',
                        textAlign: 'center',
                        maxWidth: '900px',
                        lineHeight: 1.4,
                        display: 'flex',
                    }}
                >
                    Interviste AI per raccogliere feedback qualitativi da clienti e stakeholder
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
