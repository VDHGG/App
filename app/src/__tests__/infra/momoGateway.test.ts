import { describe, it, expect, vi, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  momoCreatePayment,
  verifyMomoIpnSignature,
} from '@infra/momo/momoGateway';

describe('momoGateway', () => {
  const secretKey = 'test_secret_key';
  const accessKey = 'test_access_key';

  describe('verifyMomoIpnSignature', () => {
    function createValidPayload(
      overrides: Record<string, string | number | undefined> = {}
    ): Record<string, string | number | undefined> {
      const base: Record<string, string | number | undefined> = {
        accessKey,
        amount: '100000',
        extraData: '',
        message: 'Successful',
        orderId: 'ORDER_123',
        orderInfo: 'Rental R001',
        orderType: 'momo_wallet',
        partnerCode: 'MOMO',
        payType: 'qr',
        requestId: 'REQ_123',
        responseTime: '1700000000000',
        resultCode: '0',
        transId: 'TRANS_123',
        ...overrides,
      };

      const raw =
        'accessKey=' +
        String(base.accessKey ?? '') +
        '&amount=' +
        String(base.amount ?? '') +
        '&extraData=' +
        String(base.extraData ?? '') +
        '&message=' +
        String(base.message ?? '') +
        '&orderId=' +
        String(base.orderId ?? '') +
        '&orderInfo=' +
        String(base.orderInfo ?? '') +
        '&orderType=' +
        String(base.orderType ?? '') +
        '&partnerCode=' +
        String(base.partnerCode ?? '') +
        '&payType=' +
        String(base.payType ?? '') +
        '&requestId=' +
        String(base.requestId ?? '') +
        '&responseTime=' +
        String(base.responseTime ?? '') +
        '&resultCode=' +
        String(base.resultCode ?? '') +
        '&transId=' +
        String(base.transId ?? '');

      const signature = crypto.createHmac('sha256', secretKey).update(raw).digest('hex');
      return { ...base, signature };
    }

    it('returns true for a valid HMAC-SHA256 signature', () => {
      const payload = createValidPayload();
      expect(verifyMomoIpnSignature(payload, secretKey)).toBe(true);
    });

    it('returns true when body.accessKey is omitted and process.env.MOMO_ACCESS_KEY is set', () => {
      const origEnv = process.env.MOMO_ACCESS_KEY;
      try {
        process.env.MOMO_ACCESS_KEY = accessKey;
        const payload = createValidPayload();
        delete payload.accessKey;
        expect(verifyMomoIpnSignature(payload, secretKey)).toBe(true);
      } finally {
        process.env.MOMO_ACCESS_KEY = origEnv;
      }
    });

    it('returns false when amount is tampered', () => {
      const payload = createValidPayload();
      payload.amount = '999999';
      expect(verifyMomoIpnSignature(payload, secretKey)).toBe(false);
    });

    it('returns false when signature is tampered', () => {
      const payload = createValidPayload();
      payload.signature = 'tampered_signature_hex';
      expect(verifyMomoIpnSignature(payload, secretKey)).toBe(false);
    });
  });

  describe('momoCreatePayment', () => {
    const defaultOpts = {
      partnerCode: 'MOMO',
      accessKey: 'test_access_key',
      secretKey: 'test_secret_key',
      partnerName: 'Rental Shoe',
      storeId: 'RentalShoeStore',
      orderId: 'ORDER_123',
      requestId: 'REQ_123',
      amountVnd: 250000,
      orderInfo: 'Rental R001',
      redirectUrl: 'https://example.com/payment/momo/return',
      ipnUrl: 'https://example.com/api/v1/payments/momo/ipn',
      requestType: 'captureWallet',
      apiUrl: 'https://test-payment.momo.vn/v2/gateway/api/create',
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns { ok: true, payUrl } when MoMo responds 200 OK with valid JSON', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 200,
        text: async () =>
          JSON.stringify({
            resultCode: 0,
            message: 'Successful',
            payUrl: 'https://test-payment.momo.vn/pay/test-pay-url',
          }),
      } as unknown as Response);

      const result = await momoCreatePayment(defaultOpts);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payUrl).toBe('https://test-payment.momo.vn/pay/test-pay-url');
        expect(result.orderId).toBe('ORDER_123');
        expect(result.requestId).toBe('REQ_123');
      }
    });

    it('returns { ok: true, payUrl } with signed fallback when test-payment.momo.vn responds 403 Forbidden', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 403,
        text: async () => '<html><body>403 Forbidden (GeoIP blocked by Cloudflare/nginx)</body></html>',
      } as unknown as Response);

      const result = await momoCreatePayment(defaultOpts);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payUrl).toContain('https://example.com/payment/momo/sandbox');
        const url = new URL(result.payUrl);
        const params = Object.fromEntries(url.searchParams.entries());
        expect(params.resultCode).toBe('0');
        expect(params.orderId).toBe('ORDER_123');
        expect(params.amount).toBe('250000');
        expect(verifyMomoIpnSignature(params, defaultOpts.secretKey)).toBe(true);
      }
    });

    it('returns { ok: false, resultCode: -1 } when non-sandbox or 500 returns invalid JSON', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        status: 500,
        text: async () => 'Internal Server Error 500',
      } as unknown as Response);

      const result = await momoCreatePayment(defaultOpts);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.resultCode).toBe(-1);
        expect(result.message).toContain('Invalid JSON from MoMo gateway');
      }
    });

    it('returns { ok: false, resultCode: -1 } when fetch throws network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));

      const result = await momoCreatePayment(defaultOpts);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.resultCode).toBe(-1);
        expect(result.message).toBe('Connection refused');
      }
    });
  });
});
