'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function claimReward(conversationId: string, email: string, name?: string) {
    if (!conversationId || !email) {
        throw new Error('Conversation ID and Email are required');
    }

    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            bot: {
                include: { rewardConfig: true }
            },
            rewardGrant: true
        }
    });

    if (!conversation) {
        throw new Error('Conversation not found');
    }

    if (!conversation.bot.rewardConfig?.enabled) {
        throw new Error('No active reward for this conversation');
    }

    // Return existing grant if already claimed
    if (conversation.rewardGrant) {
        return {
            success: true,
            code: conversation.rewardGrant.code,
            payload: conversation.bot.rewardConfig.payload,
            type: conversation.bot.rewardConfig.type,
            alreadyClaimed: true
        };
    }

    // Check if user exists (optional linking)
    const user = await prisma.user.findUnique({ where: { email } });

    // Create Grant
    const grant = await prisma.rewardGrant.create({
        data: {
            conversationId,
            code: conversation.bot.rewardConfig.payload,
            userId: user?.id,
            guestEmail: email,
            guestName: name
        }
    });

    return {
        success: true,
        code: grant.code,
        payload: conversation.bot.rewardConfig.payload,
        type: conversation.bot.rewardConfig.type
    };
}

export async function getRewardDetails(conversationId: string) {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            bot: {
                include: { rewardConfig: true }
            },
            rewardGrant: true
        }
    });

    if (!conversation || !conversation.bot.rewardConfig?.enabled) {
        return null;
    }

    return {
        botName: conversation.bot.name,
        rewardText: conversation.bot.rewardConfig.displayText,
        rewardType: conversation.bot.rewardConfig.type,
        isClaimed: !!conversation.rewardGrant,
        claimedCode: conversation.rewardGrant?.code,
        branding: {
            logoUrl: conversation.bot.logoUrl,
            primaryColor: conversation.bot.primaryColor,
            backgroundColor: conversation.bot.backgroundColor,
            textColor: conversation.bot.textColor
        }
    };
}
