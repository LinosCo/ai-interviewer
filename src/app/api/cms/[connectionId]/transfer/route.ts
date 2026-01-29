import { auth } from '@/auth';
import { CMSConnectionService } from '@/lib/cms';
import { NextResponse } from 'next/server';

export async function POST(
    req: Request,
    { params }: { params: { connectionId: string } }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { targetProjectId } = await req.json();

        if (!targetProjectId) {
            return NextResponse.json(
                { error: 'Target project ID is required' },
                { status: 400 }
            );
        }

        const result = await CMSConnectionService.transferConnection(
            params.connectionId,
            targetProjectId,
            session.user.id
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('CMS Transfer Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
