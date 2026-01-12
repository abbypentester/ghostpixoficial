import axios from 'axios';
import crypto from 'crypto';

const SUITPAY_URL = "https://ws.suitpay.app";
const CLIENT_ID = process.env.SUITPAY_CI || "leticiagois_1717420674376";
const CLIENT_SECRET = process.env.SUITPAY_CS || "aa63b095228fb36cfed61289fe61d01d44f45d0e1fafbb0814c451647257615fab671f35717a4ba89d7ad3cd4d9d5fa4";

interface PixResponse {
  idTransaction: string;
  paymentCode: string;
  paymentCodeBase64: string;
}

function generateCPF(): string {
  const rnd = (n: number) => Math.round(Math.random() * n);
  const mod = (base: number, div: number) => Math.round(base - (Math.floor(base / div) * div));
  const n = Array(9).fill(0).map(() => rnd(9));
  
  let d1 = n.reduce((total, val, i) => total + (val * (10 - i)), 0);
  d1 = 11 - mod(d1, 11);
  if (d1 >= 10) d1 = 0;
  
  let d2 = n.reduce((total, val, i) => total + (val * (11 - i)), 0) + (d1 * 2);
  d2 = 11 - mod(d2, 11);
  if (d2 >= 10) d2 = 0;
  
  return `${n.join('')}${d1}${d2}`;
}

export const suitpay = {
  validateWebhook(payload: any): boolean {
    try {
      if (!payload || !payload.hash) {
        console.error("Webhook Validation Failed: Missing hash or payload");
        return false;
      }

      const receivedHash = payload.hash;
      
      // Concatenate values in the order received, excluding 'hash'
      // Note: The documentation says "Keep the order of values consistent with the order of values received in the JSON".
      // Since Next.js parses JSON, key order is generally preserved for non-integer keys.
      let concatenatedString = "";
      
      for (const key in payload) {
        if (key !== 'hash') {
          concatenatedString += payload[key].toString();
        }
      }

      concatenatedString += CLIENT_SECRET;

      const calculatedHash = crypto.createHash('sha256').update(concatenatedString).digest('hex');

      const isValid = calculatedHash === receivedHash;
      
      if (!isValid) {
        console.warn("Webhook Hash Mismatch:");
        console.warn("Received:", receivedHash);
        console.warn("Calculated:", calculatedHash);
        console.warn("Concatenated String:", concatenatedString);
      }

      return isValid;
    } catch (error) {
      console.error("Error validating webhook:", error);
      return false;
    }
  },

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
