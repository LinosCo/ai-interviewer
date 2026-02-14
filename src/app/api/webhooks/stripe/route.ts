import { NextResponse } from 'next/server';

const GONE_MESSAGE = 'Questo endpoint webhook Stripe è stato dismesso. Usa /api/stripe/webhook.';

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
