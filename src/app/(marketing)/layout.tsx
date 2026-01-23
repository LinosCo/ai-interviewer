import Link from 'next/link';
import Script from 'next/script';
import { Footer } from '@/components/Footer';
import { auth } from '@/auth';
import { MarketingNav } from '@/components/MarketingNav';

export default async function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    return (
        <div className="min-h-screen bg-stone-950 flex flex-col">
            <MarketingNav session={session} />

            {/* Main Content */}
            <main className="pt-20 flex-1">
                {children}
            </main>

            {/* Footer */}
            <Footer />

            {/* Chatbot Widget for Customer Support (Only on marketing pages) */}
            <Script
                id="bt-chatbot-script"
                src="https://businesstuner.voler.ai/embed/chatbot.js"
                data-bot-id="cmkfq2fuq0001q5yy3wnk6yvq"
                strategy="lazyOnload"
            />
        </div>
    );
}
