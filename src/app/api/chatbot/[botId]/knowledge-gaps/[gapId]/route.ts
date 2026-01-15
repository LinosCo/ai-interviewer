import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ botId: string; gapId: string }> }
) {
    const { botId, gapId } = await params;
    const session = await auth();

    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const body = await req.json();
        const { status, question, answer } = body;
        // status: 'approved' | 'dismissed'

        if (status === 'approved' && question && answer) {
            // 1. Create Knowledge Source
            await prisma.knowledgeSource.create({
                data: {
                    botId,
                    type: 'text',
                    title: `FAQ: ${question}`,
                    content: `Q: ${question}\nA: ${answer}`
                }
            });

            // 2. Mark Gap as Resolved
            const updatedGap = await prisma.knowledgeGap.update({
                where: { id: gapId },
                data: {
                    status: 'approved',
                    resolvedAt: new Date(),
                    resolvedBy: session.user.email,
                    suggestedFaq: { question, answer } // Update with final text
                }
            });

            return NextResponse.json({ success: true, gap: updatedGap });
        }

        if (status === 'dismissed') {
            const updatedGap = await prisma.knowledgeGap.update({
                where: { id: gapId },
                data: { status: 'dismissed' }
            });
            return NextResponse.json({ success: true, gap: updatedGap });
        }

        return new NextResponse("Invalid action", { status: 400 });

    } catch (error) {
        console.error("Gap Action Error", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
