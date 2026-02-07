import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ botId: string }> }
) {
    try {
        const { botId } = await params;

        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            select: {
                id: true,
                name: true,
                botType: true,
                primaryColor: true,
                introMessage: true,
                privacyPolicyUrl: true,
                enablePageContext: true,
                // Only include other PUBLIC fields needed for UI
            }
        });

        if (!bot) {
            return new NextResponse("Bot not found", { status: 404 });
        }

        return NextResponse.json(bot);
    } catch (error) {
        console.error("[BOT_CONFIG_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
