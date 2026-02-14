import { NextResponse } from 'next/server';

const GONE_MESSAGE = 'Il webhook add-on legacy è stato dismesso. Usa /api/stripe/webhook con metadata.type=credit_pack.';

export async function POST() {
    return NextResponse.json(
        {
            error: 'ENDPOINT_GONE',
            message: GONE_MESSAGE,
            replacement: '/api/stripe/webhook'
        },
        { status: 410 }
    );
}
