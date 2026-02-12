import { Icons } from '@/components/ui/business-tuner/Icons';

export default function InterviewLoadingPage() {
    const brandColor = '#f59e0b';

    return (
        <div className="min-h-screen bg-white">
            <div className="fixed inset-0 z-40 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/40 backdrop-blur-[2px]" />
                <div className="relative flex items-center justify-center">
                    <div
                        className="absolute rounded-full"
                        style={{
                            width: 96,
                            height: 96,
                            border: `3px solid ${brandColor}30`,
                            animation: 'ping 1.5s ease-in-out infinite',
                        }}
                    />
                    <div
                        className="relative flex items-center justify-center rounded-full bg-white shadow-lg"
                        style={{
                            width: 80,
                            height: 80,
                            border: `2px solid ${brandColor}40`,
                            animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                    >
                        <Icons.Logo size={36} style={{ color: brandColor }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
