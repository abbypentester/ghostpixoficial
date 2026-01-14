import axios from 'axios';
import crypto from 'crypto';

const SUITPAY_URL = 'https://ws.suitpay.app';

interface PixResponse {
  idTransaction: string;
  paymentCode: string;
  paymentCodeBase64: string;
}

function generateCPF(): string {
  const rnd = (n: number) => Math.round(Math.random() * n);
  const mod = (base: number, div: number) =>
    Math.round(base - Math.floor(base / div) * div);
  const n = Array(9)
    .fill(0)
    .map(() => rnd(9));

  let d1 = n.reduce((total, val, i) => total + val * (10 - i), 0);
  d1 = 11 - mod(d1, 11);
  if (d1 >= 10) d1 = 0;

  let d2 =
    n.reduce((total, val, i) => total + val * (11 - i), 0) + d1 * 2;
  d2 = 11 - mod(d2, 11);
  if (d2 >= 10) d2 = 0;

  return `${n.join('')}${d1}${d2}`;
}

function getCredentials() {
  const ci = process.env.SUITPAY_CI;
  const cs = process.env.SUITPAY_CS;

  if (!ci || !cs) {
    throw new Error('SuitPay credentials not configured (SUITPAY_CI/SUITPAY_CS)');
  }

  return { ci, cs };
}

function getAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    console.error(
      'CRITICAL: NEXT_PUBLIC_APP_URL is missing. Using fallback domain for callbacks.'
    );
    return 'https://ghostpix.vercel.app';
  }
  return url;
}

export const suitpay = {
  validateWebhook(payload: any): boolean {
    try {
      if (!payload || !payload.hash) {
        console.error('Webhook Validation Failed: Missing hash or payload');
        return false;
      }

      const receivedHash = payload.hash;

      let concatenatedString = '';

      for (const key in payload) {
        if (key !== 'hash') {
          const value = payload[key];
          if (value !== null && value !== undefined) {
            concatenatedString += value.toString();
          }
        }
      }

      const cs = process.env.SUITPAY_CS;
      if (!cs) {
        console.error(
          'SuitPay webhook validation failed: SUITPAY_CS is not configured'
        );
        return false;
      }

      concatenatedString += cs;

      const calculatedHash = crypto
        .createHash('sha256')
        .update(concatenatedString)
        .digest('hex');

      const isValid = calculatedHash === receivedHash;

      if (!isValid) {
        console.warn('Webhook Hash Mismatch');
      }

      return isValid;
    } catch (error) {
      console.error('Error validating webhook:', error);
      return false;
    }
  },

  async generatePix(
    amount: number,
    _description: string = 'GhostPIX Load'
  ): Promise<PixResponse> {
    const { ci, cs } = getCredentials();
    const appUrl = getAppUrl();

    if (!amount || amount <= 0) {
      throw new Error('Invalid PIX amount');
    }

    try {
      const requestNumber = crypto.randomUUID();
      const callbackUrl = `${appUrl}/api/webhook/suitpay`;

      console.log(
        `[SuitPay] Generating PIX. Amount: ${amount}, Callback: ${callbackUrl}`
      );

      const response = await axios.post(
        `${SUITPAY_URL}/api/v1/gateway/request-qrcode`,
        {
          requestNumber,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          amount: Number(amount),
          callbackUrl,
          client: {
            name: 'GhostPIX User',
            document: generateCPF()
          }
        },
        {
          headers: {
            ci,
            cs,
            'Content-Type': 'application/json'
          }
        }
      );

      if (
        response.data &&
        response.data.idTransaction &&
        response.data.paymentCode
      ) {
        console.log(
          `[SuitPay] Success. Transaction ID: ${response.data.idTransaction}`
        );
        return {
          idTransaction: response.data.idTransaction,
          paymentCode: response.data.paymentCode,
          paymentCodeBase64: response.data.paymentCodeBase64
        };
      }

      console.error('[SuitPay] Invalid response format:', response.data);
      throw new Error('Invalid response from SuitPay');
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.error(
          '[SuitPay] API Error:',
          error.response?.data || error.message
        );
      } else {
        console.error('[SuitPay] Unknown Error:', error);
      }
      throw error;
    }
  },

  async requestWithdrawal(
    amount: number,
    key: string,
    keyType: string
  ): Promise<string> {
    const { ci, cs } = getCredentials();
    const appUrl = getAppUrl();

    if (!amount || amount <= 0) {
      throw new Error('Invalid withdrawal amount');
    }

    try {
      const payload = {
        value: Number(amount),
        key,
        typeKey: keyType
      };

      const response = await axios.post(
        `${SUITPAY_URL}/api/v1/gateway/pix-payment`,
        payload,
        {
          headers: {
            ci,
            cs,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.idTransaction) {
        return response.data.idTransaction;
      }

      if (response.status === 200) {
        return 'PENDING';
      }

      throw new Error('Failed to request withdrawal');
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(
          'SuitPay Withdrawal Error:',
          error.response?.data || error.message
        );
      } else {
        console.error('SuitPay Withdrawal Error:', error);
      }
      throw error;
    }
  }
};
