'use client';

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function CopyLinkButton({ url }: { url: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-2 text-gray-600"
            title="Copy Public Link"
        >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            <span className="text-sm font-medium">{copied ? "Copied" : "Copy Link"}</span>
        </button>
    );
}
