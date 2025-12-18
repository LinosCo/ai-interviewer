import { redirect } from 'next/navigation';

export default function TemplatesPage() {
    // Redirect to landing page for now, or show "Coming Soon"
    return (
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
            <h1 className="text-4xl font-bold mb-4">Template Gallery</h1>
            <p className="text-xl text-stone-600 mb-8">Una libreria di interviste pronte all'uso sta arrivando.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-50 pointer-events-none select-none">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white p-6 rounded-xl border border-stone-200">
                        <div className="h-40 bg-stone-100 rounded-lg mb-4"></div>
                        <div className="h-6 w-3/4 bg-stone-100 rounded mb-2"></div>
                        <div className="h-4 w-1/2 bg-stone-100 rounded"></div>
                    </div>
                ))}
            </div>
        </div>
    );
}
