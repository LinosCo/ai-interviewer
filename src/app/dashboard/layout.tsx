import { signOut, auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { gradients } from '@/lib/design-system';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    let isAdmin = false;

    if (session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { role: true }
        });
        isAdmin = user?.role === 'ADMIN';
    }

    const signOutAction = async () => {
        'use server';
        await signOut();
    };

    return (
        <div className="flex flex-col md:flex-row h-screen overflow-hidden font-sans" style={{ background: gradients.mesh }}>

            <DashboardSidebar isAdmin={isAdmin} signOutAction={signOutAction} />

            {/* Main Content Area */}
            <div className="flex-grow overflow-y-auto p-4 md:p-8 relative z-10">
                <div style={{ maxWidth: '1200px', margin: '0 auto', minHeight: '100%' }}>
                    {children}
                </div>
            </div>

            {/* Chatbot Widget for Dashboard Support */}
            <script
                id="bt-dashboard-chatbot"
                src="https://businesstuner.voler.ai/embed/chatbot.js"
                data-bot-id="cmkfq2fuq0001q5yy3wnk6yvq"
                async
            />
        </div>
    );
}

