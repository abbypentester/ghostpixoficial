import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { suitpay } from '@/lib/suitpay';

export async function POST(request: Request) {
  try {
    console.log('[API] /api/pix/generate called');
    const body = await request.json();
    const { walletId, amount } = body;

    console.log(
      `[API] Payload received: walletId=${walletId}, amount=${amount}`
    );

    const numericAmount = Number(amount);

    if (!walletId || !numericAmount || numericAmount <= 0) {
      console.warn('[API] Missing walletId or invalid amount');
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    console.log('[API] Searching for wallet in database...');
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId }
    });

    if (!wallet) {
      console.error(`[API] Wallet not found: ${walletId}`);
      return NextResponse.json(
        { error: 'Carteira não encontrada' },
        { status: 404 }
      );
    }
    console.log(`[API] Wallet found: ${wallet.id}`);

    console.log('[API] Calling SuitPay service...');
    const pixData = await suitpay.generatePix(numericAmount);
    console.log(
      `[API] SuitPay success. Transaction ID: ${pixData.idTransaction}`
    );

    const fee = numericAmount * 0.15;
    const netAmount = numericAmount - fee;

    console.log('[API] Creating transaction record in database...');
    const transaction = await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'CASH_IN',
        amount: numericAmount,
        fee,
        netAmount,
        status: 'PENDING',
        suitpayId: pixData.idTransaction,
        pixCode: pixData.paymentCode,
        description: 'Depósito PIX'
      }
    });
    console.log(`[API] Transaction created: ${transaction.id}`);

    return NextResponse.json({
      transactionId: transaction.id,
      pixCode: pixData.paymentCode,
      pixCodeBase64: pixData.paymentCodeBase64,
      amount: transaction.amount,
      fee: transaction.fee,
      netAmount: transaction.netAmount
    });
  } catch (error: any) {
    console.error('[API] Critical Error generating PIX:', error);

    return NextResponse.json(
      {
        error: 'Erro interno ao processar PIX',
        details: error?.response?.data || error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
