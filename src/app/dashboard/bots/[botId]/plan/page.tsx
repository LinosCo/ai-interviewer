import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import InterviewPlanEditor from './plan-editor';
import { assertProjectAccess } from '@/lib/domain/workspace';

export default async function InterviewPlanPage({ params }: { params: Promise<{ botId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { botId } = await params;

  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { project: true }
  });

  if (!bot) notFound();
  try {
    await assertProjectAccess(session.user.id, bot.projectId, 'VIEWER');
  } catch {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plan Studio: {bot.name}</h1>
          <p className="text-sm text-gray-500">Grading, coverage prevista, esclusioni probabili e regole di deepen senza alterare l&apos;ordine editoriale dei topic.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/bots/${bot.id}`} className="px-3 py-2 border rounded hover:bg-gray-50">
            Torna al Bot
          </Link>
        </div>
      </div>

      <InterviewPlanEditor botId={bot.id} />
    </div>
  );
}
