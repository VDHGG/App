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

  const res = await fetch(opts.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const data = (await res.json()) as {
    resultCode: number;
    message?: string;
    payUrl?: string;
  };

  if (data.resultCode === 0 && data.payUrl) {
    return { ok: true, payUrl: data.payUrl, orderId: opts.orderId, requestId: opts.requestId };
  }
  return { ok: false, resultCode: data.resultCode, message: data.message ?? 'MoMo gateway error' };
}

export function verifyMomoIpnSignature(
  body: Record<string, string | number | undefined>,
  secretKey: string
): boolean {
  const accessKey = String(body.accessKey ?? '');
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
