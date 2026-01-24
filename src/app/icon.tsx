
import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const size = {
    width: 32,
    height: 32,
};
export const contentType = 'image/png';

// Image generation
export default function Icon() {
    return new ImageResponse(
        (
            // ImageResponse JSX element
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                }}
            >
                {/* Business Tuner Logo - New Design */}
                <svg
                    width="32"
                    height="22"
                    viewBox="0 0 195 132"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <linearGradient id="logoGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" stopColor="#FF9A5A" />
                            <stop offset="100%" stopColor="#F06543" />
                        </linearGradient>
                    </defs>
                    <circle cx="14" cy="98" r="14" fill="url(#logoGradient)" />
                    <rect x="41" y="59" width="28" height="63" rx="14" fill="url(#logoGradient)" />
                    <rect x="83" y="0" width="28" height="132" rx="14" fill="url(#logoGradient)" />
                    <rect x="125" y="50" width="28" height="63" rx="14" fill="url(#logoGradient)" />
                    <rect x="167" y="28" width="28" height="84" rx="14" fill="url(#logoGradient)" />
                </svg>
            </div>
        ),
        // ImageResponse options
        {
            // For convenience, we can re-use the exported icons size metadata
            // config to also set the ImageResponse's width and height.
            ...size,
        }
    );
}
