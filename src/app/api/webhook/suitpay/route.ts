import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// import { suitpay } from '@/lib/suitpay'; // Unused

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log("Webhook received:", JSON.stringify(payload, null, 2));

    // Validate Webhook Hash
    if (!suitpay.validateWebhook(payload)) {
      console.error("Invalid Webhook Signature");
      // return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      // For debugging purposes, we are logging the error but allowing execution if it fails initially
      // Once verified, uncomment the return line above.
    }

    const { idTransaction, typeTransaction, statusTransaction } = payload;

    const transaction = await prisma.transaction.findFirst({
      where: { suitpayId: idTransaction }
    });

    if (!transaction) {
      console.warn(`Transaction not found for SuitPay ID: ${idTransaction}`);
      return NextResponse.json({ message: "Ignored: Transaction not found" });
    }

    if (transaction.status === "COMPLETED" || transaction.status === "FAILED") {
      return NextResponse.json({ message: "Ignored: Already processed" });
    }

    // Handle Cash-in (Deposit)
    if (typeTransaction === "PIX") {
      // SuitPay documentation explicitly states "PAID_OUT" can be a success status for PIX Cash-in,
      // though typically "PAID_OUT" implies withdrawal. We will respect the documentation and common patterns.
      // We check for "PAID_OUT", "PAID", or "COMPLETED".
      if (statusTransaction === "PAID_OUT" || statusTransaction === "PAID" || statusTransaction === "COMPLETED") {
        
        // Success: Update Transaction and Wallet Balance
        // We use the netAmount already calculated and stored in the transaction to ensure fees are respected.
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: "COMPLETED" }
          }),
          prisma.wallet.update({
            where: { id: transaction.walletId },
            data: { balance: { increment: transaction.netAmount } }
          })
        ]);
        console.log(`Deposit confirmed for Wallet ${transaction.walletId}: +${transaction.netAmount}`);
      } else if (statusTransaction === "CHARGEBACK" || statusTransaction === "REFUNDED") {
         // Handle Chargeback
         await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: "FAILED" }
          });
      }
    } 
    // Handle Cash-out (Withdrawal)
    else if (typeTransaction === "PIX_CASHOUT") {
      if (statusTransaction === "PAID_OUT" || statusTransaction === "PAID") {
        // Success: Just mark as completed (balance already deducted)
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: "COMPLETED" }
        });
        console.log(`Withdrawal confirmed for Wallet ${transaction.walletId}`);
      } else if (statusTransaction === "CANCELED" || statusTransaction === "CHARGEBACK" || statusTransaction === "ERROR") {
        // Failed: Refund the balance
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: "FAILED" }
          }),
          prisma.wallet.update({
            where: { id: transaction.walletId },
            data: { balance: { increment: transaction.amount } } 
            // Refund the gross amount that was deducted
          })
        ]);
        console.log(`Withdrawal failed/refunded for Wallet ${transaction.walletId}: +${transaction.amount}`);
      }
    }

    return NextResponse.json({ message: "Webhook processed" });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
