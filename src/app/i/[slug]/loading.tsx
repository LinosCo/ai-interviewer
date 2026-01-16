export default function InterviewLoadingPage() {
    return (
        <div className="min-h-screen flex flex-col overflow-x-hidden bg-white">
            {/* Background Decoration - subtle gray */}
            <div className="fixed inset-0 pointer-events-none opacity-20 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-gray-300" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-gray-200" />
            </div>

            <main className="flex-1 relative z-10 w-full max-w-4xl mx-auto p-6 md:p-12 lg:p-16 flex flex-col items-center text-center gap-12 animate-pulse">
                {/* Logo Skeleton */}
                <div className="w-full flex justify-center mb-4">
                    <div className="h-24 md:h-28 w-48 bg-gray-200 rounded-xl" />
                </div>

                {/* Hero Section Skeleton */}
                <div className="w-full space-y-10">
                    <div className="space-y-6 flex flex-col items-center">
                        {/* Badge skeleton */}
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-32 bg-gray-200 rounded-full" />
                            <div className="h-4 w-4 bg-gray-100 rounded-full" />
                            <div className="h-4 w-20 bg-gray-200 rounded" />
                        </div>

                        {/* Title skeleton */}
                        <div className="space-y-3 w-full max-w-3xl">
                            <div className="h-12 md:h-16 bg-gray-200 rounded-xl mx-auto w-3/4" />
                            <div className="h-12 md:h-16 bg-gray-200 rounded-xl mx-auto w-1/2" />
                        </div>

                        {/* Description skeleton */}
                        <div className="space-y-2 w-full max-w-2xl">
                            <div className="h-6 bg-gray-100 rounded mx-auto w-full" />
                            <div className="h-6 bg-gray-100 rounded mx-auto w-4/5" />
                        </div>
                    </div>

                    {/* Button section skeleton */}
                    <div className="w-full max-w-lg mx-auto space-y-6">
                        {/* Consent checkbox skeleton */}
                        <div className="flex items-start gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="h-6 w-6 bg-gray-200 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-full" />
                                <div className="h-4 bg-gray-200 rounded w-3/4" />
                            </div>
                        </div>

                        {/* Button skeleton */}
                        <div className="w-full h-16 bg-gray-200 rounded-2xl" />

                        {/* Info badges skeleton */}
                        <div className="flex items-center justify-center gap-8">
                            <div className="h-4 w-24 bg-gray-100 rounded" />
                            <div className="h-4 w-24 bg-gray-100 rounded" />
                        </div>
                    </div>
                </div>

                {/* Footer skeleton */}
                <footer className="w-full pt-12 border-t border-gray-100">
                    <div className="flex flex-col items-center gap-6">
                        <div className="h-3 w-20 bg-gray-100 rounded" />
                        <div className="h-8 w-40 bg-gray-100 rounded-full" />
                        <div className="flex gap-8">
                            <div className="h-3 w-20 bg-gray-100 rounded" />
                            <div className="h-3 w-16 bg-gray-100 rounded" />
                            <div className="h-3 w-32 bg-gray-100 rounded" />
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
