export default function ChatLoadingPage() {
    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            {/* Header skeleton */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                        <div className="space-y-1">
                            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />
                    </div>
                </div>
            </header>

            {/* Progress bar skeleton */}
            <div className="fixed top-[60px] left-0 right-0 h-1 bg-gray-100 z-40">
                <div className="h-full w-1/4 bg-gray-200 animate-pulse" />
            </div>

            {/* Main content area */}
            <main className="flex-1 pt-20 pb-32 px-4">
                <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
                    {/* Loading spinner */}
                    <div className="relative w-16 h-16 mb-6">
                        <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-gray-400 animate-spin" />
                    </div>
                    <p className="text-gray-400 font-medium tracking-wide text-sm uppercase animate-pulse">
                        Caricamento...
                    </p>
                </div>
            </main>

            {/* Input area skeleton */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 p-4">
                <div className="max-w-2xl mx-auto">
                    <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
                </div>
            </div>
        </div>
    );
}
