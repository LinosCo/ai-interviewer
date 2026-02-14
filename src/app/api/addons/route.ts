import { NextResponse } from 'next/server';

const GONE_MESSAGE = 'Gli add-on legacy sono stati dismessi. Usa /api/credits/purchase per acquistare Credit Pack.';

export async function GET() {
    return NextResponse.json(
        {
            error: 'ENDPOINT_GONE',
            message: GONE_MESSAGE,
            replacement: '/api/credits/purchase'
        },
        { status: 410 }
    );
}

export async function POST() {
    return NextResponse.json(
        {
            error: 'ENDPOINT_GONE',
            message: GONE_MESSAGE,
            replacement: '/api/credits/purchase'
        },
        { status: 410 }
    );
}
