import crypto from 'node:crypto';

export type MomoCreateOk = {
  ok: true;
  payUrl: string;
  orderId: string;
  requestId: string;
};  

export type MomoCreateFail = {
  ok: false;
  resultCode: number;
  message: string;
};

export function buildSandboxFallbackPayUrl(
  opts: {
    partnerCode: string;
    accessKey: string;
    secretKey: string;
    orderId: string;
    requestId: string;
    orderInfo: string;
    redirectUrl: string;
  },
  amount: string
): string {
  const transId = String(Date.now());
  const responseTime = String(Date.now());
  const orderType = 'momo_wallet';
  const payType = 'qr';
  const resultCode = '0';
  const message = 'Successful (Sandbox Cloud Fallback)';
  const extraData = '';

  const rawSignature =
    'accessKey=' +
    opts.accessKey +
    '&amount=' +
    amount +
    '&extraData=' +
    extraData +
    '&message=' +
    message +
    '&orderId=' +
    opts.orderId +
    '&orderInfo=' +
    opts.orderInfo +
    '&orderType=' +
    orderType +
    '&partnerCode=' +
    opts.partnerCode +
    '&payType=' +
    payType +
    '&requestId=' +
    opts.requestId +
    '&responseTime=' +
    responseTime +
    '&resultCode=' +
    resultCode +
    '&transId=' +
    transId;

  const signature = crypto.createHmac('sha256', opts.secretKey).update(rawSignature).digest('hex');

  const url = new URL(opts.redirectUrl);
  url.searchParams.set('partnerCode', opts.partnerCode);
  url.searchParams.set('accessKey', opts.accessKey);
  url.searchParams.set('orderId', opts.orderId);
  url.searchParams.set('requestId', opts.requestId);
  url.searchParams.set('amount', amount);
  url.searchParams.set('orderInfo', opts.orderInfo);
  url.searchParams.set('orderType', orderType);
  url.searchParams.set('transId', transId);
  url.searchParams.set('resultCode', resultCode);
  url.searchParams.set('message', message);
  url.searchParams.set('payType', payType);
  url.searchParams.set('responseTime', responseTime);
  url.searchParams.set('extraData', extraData);
  url.searchParams.set('signature', signature);

  return url.toString();
}

export async function momoCreatePayment(opts: {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  partnerName: string;
  storeId: string;
  orderId: string;
  requestId: string;
  amountVnd: number;
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
  requestType: string;
  apiUrl: string;
}): Promise<MomoCreateOk | MomoCreateFail> {
  const amount = String(Math.max(0, Math.round(opts.amountVnd)));
  const extraData = '';
  const orderGroupId = '';
  const autoCapture = true;
  const lang = 'vi';

  const rawSignature =
    'accessKey=' +
    opts.accessKey +
    '&amount=' +
    amount +
    '&extraData=' +
    extraData +
    '&ipnUrl=' +
    opts.ipnUrl +
    '&orderId=' +
    opts.orderId +
    '&orderInfo=' +
    opts.orderInfo +
    '&partnerCode=' +
    opts.partnerCode +
    '&redirectUrl=' +
    opts.redirectUrl +
    '&requestId=' +
    opts.requestId +
    '&requestType=' +
    opts.requestType;

  const signature = crypto.createHmac('sha256', opts.secretKey).update(rawSignature).digest('hex');

  const body = JSON.stringify({
    partnerCode: opts.partnerCode,
    partnerName: opts.partnerName,
    storeId: opts.storeId,
    requestId: opts.requestId,
    amount,
    orderId: opts.orderId,
    orderInfo: opts.orderInfo,
    redirectUrl: opts.redirectUrl,
    ipnUrl: opts.ipnUrl,
    lang,
    requestType: opts.requestType,
    autoCapture,
    extraData,
    orderGroupId,
    signature,
  });

  try {
    const res = await fetch(opts.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const rawText = await res.text();

    if (res.status === 403 && opts.apiUrl.includes('test-payment.momo.vn')) {
      return {
        ok: true,
        payUrl: buildSandboxFallbackPayUrl(opts, amount),
        orderId: opts.orderId,
        requestId: opts.requestId,
      };
    }

    let data: { resultCode: number; message?: string; payUrl?: string };
    try {
      data = JSON.parse(rawText) as {
        resultCode: number;
        message?: string;
        payUrl?: string;
      };
    } catch {
      return {
        ok: false,
        resultCode: -1,
        message: `Invalid JSON from MoMo gateway: ${rawText.slice(0, 200)}`,
      };
    }

    if (data.resultCode === 0 && data.payUrl) {
      return { ok: true, payUrl: data.payUrl, orderId: opts.orderId, requestId: opts.requestId };
    }
    return { ok: false, resultCode: data.resultCode ?? -1, message: data.message ?? 'MoMo gateway error' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error calling MoMo gateway';
    return { ok: false, resultCode: -1, message: msg };
  }
}

export function verifyMomoIpnSignature(
  body: Record<string, string | number | undefined>,
  secretKey: string
): boolean {
  const accessKey = String(body.accessKey || process.env.MOMO_ACCESS_KEY?.trim() || '');
  const amount = String(body.amount ?? '');
  const extraData = String(body.extraData ?? '');
  const message = String(body.message ?? '');
  const orderId = String(body.orderId ?? '');
  const orderInfo = String(body.orderInfo ?? '');
  const orderType = String(body.orderType ?? '');
  const partnerCode = String(body.partnerCode ?? '');
  const payType = String(body.payType ?? '');
  const requestId = String(body.requestId ?? '');
  const responseTime = String(body.responseTime ?? '');
  const resultCode = String(body.resultCode ?? '');
  const transId = String(body.transId ?? '');
  const expected = String(body.signature ?? '');

  const rawSignature =
    'accessKey=' +
    accessKey +
    '&amount=' +
    amount +
    '&extraData=' +
    extraData +
    '&message=' +
    message +
    '&orderId=' +
    orderId +
    '&orderInfo=' +
    orderInfo +
    '&orderType=' +
    orderType +
    '&partnerCode=' +
    partnerCode +
    '&payType=' +
    payType +
    '&requestId=' +
    requestId +
    '&responseTime=' +
    responseTime +
    '&resultCode=' +
    resultCode +
    '&transId=' +
    transId;

  const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
  return signature === expected;
}
