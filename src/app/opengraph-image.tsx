import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const alt = 'Business Tuner';
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

// Image generation
export default function Image() {
    return new ImageResponse(
        (
            // ImageResponse JSX element
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#ffffff',
                    padding: '80px',
                }}
            >
                {/* Brand Logo Container */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                    <svg
                        width="240"
                        height="240"
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

                    {/* Lettering */}
                    <div
                        style={{
                            fontSize: '120px',
                            fontWeight: 900,
                            color: '#111827',
                            letterSpacing: '-0.05em',
                            display: 'flex',
                        }}
                    >
                        Business Tuner
                    </div>
                </div>
            </div>
        ),
        // ImageResponse options
        {
            ...size,
        }
    );
}
