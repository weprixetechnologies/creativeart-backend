const fetch = require('node-fetch');
const crypto = require('crypto');

class PaymentService {
  generateChecksum(path, base64Payload) {
    const key = process.env.KEY;
    const keyIndex = process.env.KEY_INDEX || '1';
    const hash = crypto
      .createHash('sha256')
      .update(base64Payload + path + key)
      .digest('hex');
    return `${hash}###${keyIndex}`;
  }

  async initiatePayment({ merchantOrderId, amount, redirectUrl, description, userId }) {
    const path = '/pg/v1/pay';
    const payUrl = `${process.env.PHONEPE_BASE_URL}${path}`;
    const amountInPaise = Math.round(parseFloat(amount) * 100);

    const payload = {
      merchantId: process.env.MERCHANT_ID,
      merchantTransactionId: merchantOrderId,
      merchantUserId: String(userId || 'guest_user'),
      amount: amountInPaise,
      redirectUrl,
      callbackUrl: `${process.env.BACKEND_URL}/api/v1/webhooks/phonepe`,
      redirectMode: 'REDIRECT',
      paymentInstrument: { type: 'PAY_PAGE' }
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const checksum = this.generateChecksum(path, base64Payload);

    const res = await fetch(payUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': process.env.MERCHANT_ID
      },
      body: JSON.stringify({ request: base64Payload })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to initiate PhonePe payment: ${res.status} - ${errText}`);
    }

    const resData = await res.json();
    if (!resData.success) {
      throw new Error(`PhonePe Payment Initiation failed: ${resData.message || resData.code}`);
    }

    const redirectInfoUrl = resData.data?.instrumentResponse?.redirectInfo?.url;
    if (!redirectInfoUrl) {
      throw new Error('PhonePe response missing redirect URL');
    }

    return {
      redirectUrl: redirectInfoUrl
    };
  }

  async checkPaymentStatus(merchantTransactionId) {
    const merchantId = process.env.MERCHANT_ID;
    const path = `/pg/v1/status/${merchantId}/${merchantTransactionId}`;
    const statusUrl = `${process.env.PHONEPE_BASE_URL}${path}`;
    const checksum = this.generateChecksum(path, '');

    const res = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': merchantId,
        'Accept': 'application/json'
      }
    });

    if (res.status === 204) {
      return { success: false, code: 'NO_CONTENT', state: 'PENDING' };
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to check PhonePe order status: ${res.status} - ${errText}`);
    }

    const resData = await res.json();
    let decodedData = resData;

    // Handle base64 encoded response wrapper if present
    if (resData.response) {
      const rawDecoded = Buffer.from(resData.response, 'base64').toString('utf8');
      decodedData = JSON.parse(rawDecoded);
    }

    // Map PhonePe transaction code to state
    // state: COMPLETED, FAILED, PENDING
    let state = 'PENDING';
    const code = decodedData.code;
    
    if (code === 'PAYMENT_SUCCESS') {
      state = 'COMPLETED';
    } else if (
      code === 'PAYMENT_ERROR' || 
      code === 'PAYMENT_DECLINED' || 
      code === 'TIMED_OUT' || 
      code === 'TRANSACTION_NOT_FOUND'
    ) {
      state = 'FAILED';
    } else {
      state = 'PENDING';
    }

    return {
      success: decodedData.success,
      code: decodedData.code,
      state
    };
  }

  verifyWebhookSignature(xVerifyHeader, rawBodyBuffer) {
    if (!xVerifyHeader) return false;
    const [receivedHash, receivedIndex] = xVerifyHeader.split('###');
    if (receivedIndex !== (process.env.KEY_INDEX || '1')) return false;

    try {
      const bodyStr = rawBodyBuffer.toString('utf8');
      const { response: base64Response } = JSON.parse(bodyStr);
      
      const computedHash = crypto
        .createHash('sha256')
        .update(base64Response + process.env.KEY)
        .digest('hex');

      return computedHash === receivedHash;
    } catch (err) {
      console.error('PhonePe webhook signature verification exception:', err);
      return false;
    }
  }
}

module.exports = new PaymentService();
