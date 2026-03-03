/**
 * POST /api/integrations/n8n/social-dispatch
 *
 * Approval + dispatch endpoint for social media content.
 *
 * Flow:
 *   1. Verify user membership on the project
 *   2. Load the CMSSuggestion (must be PENDING)
 *   3. Format it for the requested social channel
 *   4. Fire `social_content_ready` event to the n8n webhook
 *   5. Mark the suggestion as PUSHED (so it won't be dispatched again)
 *
 * Body:
 *   {
 *     suggestionId: string          // CMSSuggestion.id
 *     platform: 'linkedin' | 'facebook' | 'instagram'
 *     linkedInFormat?: 'article' | 'carousel'   // only for linkedin
 *   }
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { N8NDispatcher } from '@/lib/integrations/n8n/dispatcher';
import { NextResponse } from 'next/server';
import type { SocialChannelConfig } from '@/lib/integrations/n8n/social-templates';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { suggestionId, platform, linkedInFormat } = body as {
            suggestionId?: string;
            platform?: string;
            linkedInFormat?: string;
        };

        if (!suggestionId || !platform) {
            return NextResponse.json(
                { error: 'suggestionId and platform are required' },
                { status: 400 }
            );
        }

        const validPlatforms = ['linkedin', 'facebook', 'instagram'];
        if (!validPlatforms.includes(platform)) {
            return NextResponse.json(
                { error: `platform must be one of: ${validPlatforms.join(', ')}` },
                { status: 400 }
            );
        }

        // Load suggestion with project info for membership check
        const suggestion = await prisma.cMSSuggestion.findUnique({
            where: { id: suggestionId },
            include: {
                connection: {
                    include: {
                        project: {
                            include: {
                                organization: {
                                    include: {
                                        members: {
                                            where: { userId: session.user.id, status: 'ACTIVE' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!suggestion) {
            return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
        }

        const project = suggestion.connection.project;
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        const org = project.organization;

        if (!org || org.members.length === 0) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        if (suggestion.status !== 'PENDING') {
            return NextResponse.json(
                { error: `Suggestion is not pending (current status: ${suggestion.status})` },
                { status: 409 }
            );
        }

        // Build channel config
        let channelConfig: SocialChannelConfig;
        if (platform === 'linkedin') {
            channelConfig = {
                platform: 'linkedin',
                format: linkedInFormat === 'carousel' ? 'carousel' : 'article',
            };
        } else if (platform === 'facebook') {
            channelConfig = { platform: 'facebook' };
        } else {
            channelConfig = { platform: 'instagram' };
        }

        // Build TipPayload from CMSSuggestion
        const tip = {
            id: suggestion.id,
            title: suggestion.title,
            content: suggestion.body,
            contentKind: String(suggestion.type),
            targetChannel: suggestion.targetSection ?? undefined,
            metaDescription: suggestion.metaDescription ?? undefined,
            url: suggestion.cmsPreviewUrl ?? undefined,
        };

        // Dispatch to n8n
        await N8NDispatcher.dispatchSocialContent(
            project.id,
            tip,
            channelConfig,
            org.name ?? undefined
        );

        // Mark as PUSHED so it won't be dispatched again
        await prisma.cMSSuggestion.update({
            where: { id: suggestionId },
            data: {
                status: 'PUSHED',
                pushedAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            suggestionId,
            platform,
            format: platform === 'linkedin' ? (linkedInFormat ?? 'article') : undefined,
            message: `Contenuto approvato e inviato a n8n per pubblicazione su ${platform}.`,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Internal error';
        console.error('[social-dispatch]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
