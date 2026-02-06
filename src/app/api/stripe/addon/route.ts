import { NextResponse } from 'next/server';

const GONE_MESSAGE = 'Il checkout add-on legacy è stato dismesso. Usa /api/credits/purchase per acquistare Credit Pack.';

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
