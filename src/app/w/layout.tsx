import type { Metadata } from "next";
import "../globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
    title: "Business Tuner Widget",
    description: "Chatbot AI Widget",
};

export default function WidgetLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="it" className="light" suppressHydrationWarning>
            <head>
                <meta name="color-scheme" content="light" />
            </head>
            <body className="antialiased">
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
