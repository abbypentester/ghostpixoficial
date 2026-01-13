import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function DiagnosticsPage() {
  const checks = {
    env: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      SUITPAY_CI: !!process.env.SUITPAY_CI,
      SUITPAY_CS: !!process.env.SUITPAY_CS,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NODE_ENV: process.env.NODE_ENV,
    },
    database: {
      status: 'pending',
      message: '',
      count: 0
    }
  };

  try {
    const prisma = new PrismaClient();
    // Tenta uma query simples
    const count = await prisma.wallet.count();
    checks.database.status = 'connected';
    checks.database.count = count;
    await prisma.$disconnect();
  } catch (error: any) {
    checks.database.status = 'error';
    checks.database.message = error.message;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>System Diagnostics</h1>
      <pre>{JSON.stringify(checks, null, 2)}</pre>
    </div>
  );
}
