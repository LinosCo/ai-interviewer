
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
                {/* Business Tuner Logo SVG Scaled Down */}
                <svg
                    width="32"
                    height="32"
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <linearGradient id="logoGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#d97706" /> {/* amber-600 */}
                            <stop offset="50%" stopColor="#f59e0b" /> {/* amber-500 */}
                            <stop offset="100%" stopColor="#ffd700" /> {/* gold */}
                        </linearGradient>
                    </defs>
                    <rect width="48" height="48" rx="14" fill="url(#logoGradient)" />
                    <path
                        d="M10 34 L17.5 30 L24.5 22 L31.5 16 L38.5 22"
                        stroke="white"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                    <circle cx="31.5" cy="16" r="4" fill="white" />
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
