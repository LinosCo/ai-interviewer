require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { prisma } = require('../src/lib/prisma');

(async () => {
  const cols = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='GlobalConfig' ORDER BY column_name");
  const names = cols.map((c: any) => c.column_name);
  const want = [
    'smtpHost','smtpPort','smtpSecure','smtpUser','smtpPass','smtpFromEmail','smtpNotificationEmail','publicDemoBotId','stripeWebhookSecret'
  ];

  for (const k of want) {
    console.log(`${k}:${names.includes(k) ? 'column_present' : 'column_missing'}`);
  }

  const selectCols = want.filter((k) => names.includes(k)).map((k) => `"${k}"`).join(', ');
  if (selectCols) {
    const rows = await prisma.$queryRawUnsafe(`SELECT ${selectCols} FROM "GlobalConfig" WHERE id='default' LIMIT 1`) as Array<Record<string, unknown>>;
    const r = rows[0] || {};
    for (const k of want) {
      if (!names.includes(k)) continue;
      const v = r[k];
      console.log(`${k}=${v === null || v === undefined || v === '' ? 'missing' : 'set'}`);
    }
  }

  await prisma.$disconnect();
})().catch(async (e: any) => {
  console.error(e?.message || e);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
