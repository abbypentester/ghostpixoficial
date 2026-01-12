import axios from 'axios';
import crypto from 'crypto';

const SUITPAY_URL = process.env.SUITPAY_BASE_URL || "https://ws.suitpay.app";
const CLIENT_ID = process.env.SUITPAY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SUITPAY_CLIENT_SECRET!;
// const AUTH_SECRET = process.env.AUTH_SECRET; // Unused

export interface PixResponse {
  idTransaction: string;
  paymentCode: string;
  paymentCodeBase64?: string;
}

function generateCPF(): string {
  const randomDigit = () => Math.floor(Math.random() * 9);
  const n1 = randomDigit();
  const n2 = randomDigit();
  const n3 = randomDigit();
  const n4 = randomDigit();
  const n5 = randomDigit();
  const n6 = randomDigit();
  const n7 = randomDigit();
  const n8 = randomDigit();
  const n9 = randomDigit();

  let d1 = n9 * 2 + n8 * 3 + n7 * 4 + n6 * 5 + n5 * 6 + n4 * 7 + n3 * 8 + n2 * 9 + n1 * 10;
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;

  let d2 = d1 * 2 + n9 * 3 + n8 * 4 + n7 * 5 + n6 * 6 + n5 * 7 + n4 * 8 + n3 * 9 + n2 * 10 + n1 * 11;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;

  return `${n1}${n2}${n3}${n4}${n5}${n6}${n7}${n8}${n9}${d1}${d2}`;
}

export const suitpay = {
  async generatePix(amount: number, _description: string = "GhostPIX Load"): Promise<PixResponse> {
    try {
      // SuitPay Request QR Code
      
      const requestNumber = crypto.randomUUID();
      
      const response = await axios.post(
        `${SUITPAY_URL}/api/v1/gateway/request-qrcode`,
        {
          requestNumber: requestNumber,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 day expiry
          amount: amount,
          callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/suitpay`,
          client: {
            name: "GhostPIX User",
            document: generateCPF(),
          }
        },
        {
          headers: {
            ci: CLIENT_ID,
            cs: CLIENT_SECRET,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.idTransaction && response.data.paymentCode) {
        return {
          idTransaction: response.data.idTransaction,
          paymentCode: response.data.paymentCode,
          paymentCodeBase64: response.data.paymentCodeBase64
        };
      } else {
        throw new Error("Invalid response from SuitPay");
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
         console.error("SuitPay Generate PIX Error:", error.response?.data || error.message);
      } else {
         console.error("SuitPay Generate PIX Error:", error);
      }
      throw error;
    }
  },

  async requestWithdrawal(amount: number, key: string, keyType: string, name: string, document: string): Promise<string> {
    try {
      // SuitPay Cash Out / Transfer
      
      const response = await axios.post(
        `${SUITPAY_URL}/api/v1/gateway/pix-payment`,
        {
          value: amount,
          key: key,
          typeKey: keyType, 
          callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/suitpay`,
          document: document,
          name: name
        },
        {
          headers: {
            ci: CLIENT_ID,
            cs: CLIENT_SECRET,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.idTransaction) {
        return response.data.idTransaction;
      }
      
      // If success but no ID (some async flows)
      if (response.status === 200) {
        return "PENDING";
      }
      
      throw new Error("Failed to request withdrawal");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error("SuitPay Withdrawal Error:", error.response?.data || error.message);
      } else {
        console.error("SuitPay Withdrawal Error:", error);
      }
      throw error;
    }
  },
  
  // validateWebhook(payload: any): boolean {
  //   // Implement signature check if SuitPay provides a secret or hash
  //   return true;
  // }
};
