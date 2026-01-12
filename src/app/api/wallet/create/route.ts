import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST() {
  try {
    const wallet = await prisma.wallet.create({
      data: {
        balance: 0,
      },
    });

    return NextResponse.json({ 
      walletId: wallet.id,
      message: "Carteira criada com sucesso. Guarde sua chave mestra!" 
    });
  } catch (error) {
    console.error("Error creating wallet:", error);
    return NextResponse.json({ error: "Erro ao criar carteira" }, { status: 500 });
  }
}
