import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json(
        {
            error: 'ENDPOINT_GONE',
            message: 'Questo endpoint è stato dismesso. Usa /api/credits, /api/credits/usage-by-tool e /api/credits/history.'
        },
        { status: 410 }
    );
}
