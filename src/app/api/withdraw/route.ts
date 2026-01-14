import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { suitpay } from '@/lib/suitpay';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      walletId,
      amount,
      pixKey,
      pixKeyType,
      key,
      keyType,
      name,
      document
    } = body;

    const finalPixKey = pixKey || key;
    const finalPixKeyType = pixKeyType || keyType || 'RANDOM_KEY';

    if (!walletId || !amount || !finalPixKey) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      );
    }

    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Valor inválido' },
        { status: 400 }
      );
    }

    if (amountNum < 4) {
      return NextResponse.json(
        { error: 'Valor mínimo para saque é R$ 4,00' },
        { status: 400 }
      );
    }

    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId }
    });

    if (!wallet) {
      return NextResponse.json(
        { error: 'Carteira não encontrada' },
        { status: 404 }
      );
    }

    if (wallet.balance < amountNum) {
      return NextResponse.json(
        { error: 'Saldo insuficiente' },
        { status: 400 }
      );
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentWithdrawals = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        walletId,
        type: 'CASH_OUT',
        createdAt: { gte: oneHourAgo },
        status: { not: 'FAILED' }
      }
    });

    const currentHourlyTotal = recentWithdrawals._sum.amount || 0;
    if (currentHourlyTotal + amountNum > 150) {
      return NextResponse.json(
        {
          error: `Limite de saque excedido. Disponível: R$ ${(150 - currentHourlyTotal).toFixed(
            2
          )} nesta hora.`
        },
        { status: 400 }
      );
    }

    const fee = 3 + amountNum * 0.15;
    const netAmount = amountNum - fee;

    const transaction = await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'CASH_OUT',
        amount: amountNum,
        fee,
        netAmount,
        status: 'PENDING',
        description: `Saque para ${finalPixKey}`
      }
    });

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amountNum } }
    });

    try {
      const suitpayId = await suitpay.requestWithdrawal(
        netAmount,
        finalPixKey,
        finalPixKeyType
      );

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { suitpayId }
      });

      return NextResponse.json({
        success: true,
        message: 'Saque solicitado com sucesso',
        transactionId: transaction.id,
        netAmount
      });
    } catch (suitpayError: unknown) {
      console.error('SuitPay Withdrawal Error:', suitpayError);

      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED' }
        }),
        prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amountNum } }
        })
      ]);

      let errorMessage = 'Erro ao processar saque no gateway.';
      if (axios.isAxiosError(suitpayError)) {
        const responseData = suitpayError.response?.data as any;
        errorMessage =
          responseData?.message ||
          responseData?.response ||
          suitpayError.message ||
          errorMessage;
      }

      return NextResponse.json(
        {
          error: `${errorMessage} Valor estornado.`
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Withdraw Error:', error);
    return NextResponse.json(
      {
        error: 'Erro interno no servidor',
        details: error?.response?.data || error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
