import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { suitpay } from '@/lib/suitpay';

export async function POST(request: Request) {
  try {
    const { walletId, amount } = await request.json();

    if (!walletId || !amount) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });
    }

    // Generate PIX via SuitPay
    const pixData = await suitpay.generatePix(Number(amount));

    // Create Transaction Record
    const fee = Number(amount) * 0.15;
    const netAmount = Number(amount) - fee;

    const transaction = await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: "CASH_IN",
        amount: Number(amount),
        fee: fee,
        netAmount: netAmount,
        status: "PENDING",
        suitpayId: pixData.idTransaction,
        pixCode: pixData.paymentCode,
        description: "Depósito PIX"
      }
    });

    return NextResponse.json({
      transactionId: transaction.id,
      pixCode: pixData.paymentCode,
      pixCodeBase64: pixData.paymentCodeBase64,
      amount: transaction.amount,
      fee: transaction.fee,
      netAmount: transaction.netAmount
    });

  } catch (error) {
    console.error("Error generating PIX:", error);
    return NextResponse.json({ error: "Erro ao gerar PIX" }, { status: 500 });
  }
}
