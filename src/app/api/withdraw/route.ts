import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { suitpay } from '@/lib/suitpay';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { walletId, amount, pixKey, pixKeyType, name, document } = await request.json();

    if (!walletId || !amount || !pixKey) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const amountNum = Number(amount);
    if (amountNum <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });
    }

    if (wallet.balance < amountNum) {
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
    }

    // Rate Limit Check: R$150 per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentWithdrawals = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        walletId: walletId,
        type: "CASH_OUT",
        createdAt: { gte: oneHourAgo },
        status: { not: "FAILED" }
      }
    });

    const currentHourlyTotal = recentWithdrawals._sum.amount || 0;
    if (currentHourlyTotal + amountNum > 150) {
      return NextResponse.json({ 
        error: `Limite de saque excedido. Disponível: R$ ${(150 - currentHourlyTotal).toFixed(2)} nesta hora.` 
      }, { status: 400 });
    }

    // Fee Calculation
    const fee = amountNum * 0.15;
    const netAmount = amountNum - fee; 
    
    // Create Transaction (Pending)
    const transaction = await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: "CASH_OUT",
        amount: amountNum,
        fee: fee,
        netAmount: netAmount,
        status: "PENDING",
        description: `Saque para ${pixKey}`
      }
    });

    // Deduct Balance Immediately (Prevent double spend)
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amountNum } }
    });

    try {
      // Call SuitPay
      const destinationName = name || "Ghost User";
      const destinationDoc = document || "00000000000";

      const suitpayId = await suitpay.requestWithdrawal(
        netAmount, 
        pixKey,
        pixKeyType || "RANDOM_KEY", 
        destinationName,
        destinationDoc
      );

      // Update Transaction with SuitPay ID
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { suitpayId: suitpayId }
      });

      return NextResponse.json({ 
        success: true, 
        message: "Saque solicitado com sucesso", 
        transactionId: transaction.id,
        netAmount: netAmount
      });

    } catch (suitpayError: unknown) {
      console.error("SuitPay Withdrawal Error:", suitpayError);
      
      // Refund if SuitPay call fails immediately
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: "FAILED" }
        }),
        prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amountNum } }
        })
      ]);

      let errorMessage = "Erro ao processar saque no gateway.";
      if (axios.isAxiosError(suitpayError)) {
          errorMessage = suitpayError.response?.data?.message || errorMessage;
      }

      return NextResponse.json({ 
        error: `${errorMessage} Valor estornado.` 
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Withdraw Error:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
