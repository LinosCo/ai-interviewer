import { auth } from '@/auth';
import { assertProjectAccess, WorkspaceError } from '@/lib/domain/workspace';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_MIME: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/gif': 'gif',
};

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

function getUploadDir(): string {
    const base = process.env.BACKUP_PATH || '/tmp';
    return path.join(base, 'uploads');
}

function sanitizePath(p: string): boolean {
    // Must start with "uploads/" and contain no traversal
    const normalized = path.normalize(p);
    return normalized.startsWith('uploads/') && !normalized.includes('..');
}

/** POST /api/uploads/image — upload a logo or cover image */
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const botId = formData.get('botId') as string | null;
        const type = formData.get('type') as string | null; // "logo" | "cover"

        if (!file || !botId || !type) {
            return NextResponse.json({ error: 'Missing file, botId, or type' }, { status: 400 });
        }

        if (!['logo', 'cover'].includes(type)) {
            return NextResponse.json({ error: 'type must be logo or cover' }, { status: 400 });
        }

        const ext = ALLOWED_MIME[file.type];
        if (!ext) {
            return NextResponse.json({ error: 'Unsupported image type. Use PNG, JPG, WebP, SVG, or GIF.' }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'Image too large. Maximum size is 2MB.' }, { status: 400 });
        }

        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: { project: { include: { organization: true } } },
        });

        if (!bot) {
            return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
        }

        try {
            await assertProjectAccess(session.user.id, bot.projectId, 'MEMBER');
        } catch (error) {
            if (error instanceof WorkspaceError) {
                return NextResponse.json({ error: error.message }, { status: error.status });
            }
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const orgId = bot.project.organizationId;
        if (!orgId) {
            return NextResponse.json({ error: 'Bot project has no organization' }, { status: 422 });
        }
        const timestamp = Date.now();
        const filename = `${type}-${timestamp}.${ext}`;
        const relativePath = `uploads/${orgId}/${botId}/${filename}`;
        const uploadDir = path.join(getUploadDir(), orgId, botId);
        const fullPath = path.join(uploadDir, filename);

        await fs.mkdir(uploadDir, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(fullPath, buffer);

        const url = `/api/uploads/image?path=${encodeURIComponent(relativePath)}`;
        return NextResponse.json({ url });
    } catch (error) {
        console.error('[IMAGE_UPLOAD_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/** GET /api/uploads/image?path=uploads/{orgId}/{botId}/filename.ext — serve an uploaded image */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const relativePath = searchParams.get('path');

        if (!relativePath || !sanitizePath(relativePath)) {
            return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
        }

        const base = process.env.BACKUP_PATH || '/tmp';
        const fullPath = path.join(base, relativePath);

        let buffer: Buffer;
        try {
            buffer = await fs.readFile(fullPath);
        } catch {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const ext = path.extname(fullPath).slice(1).toLowerCase();
        const mimeMap: Record<string, string> = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            webp: 'image/webp',
            svg: 'image/svg+xml',
            gif: 'image/gif',
        };
        const contentType = mimeMap[ext] || 'application/octet-stream';

        return new Response(new Uint8Array(buffer), {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('[IMAGE_SERVE_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
