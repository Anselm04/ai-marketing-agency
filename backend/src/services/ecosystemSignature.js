import crypto from 'crypto';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function signEcosystemPayload(secret, timestamp, body) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verifyEcosystemRequest(req) {
  const secret = process.env.TRILLION_ECOSYSTEM_SHARED_SECRET?.trim();
  if (!secret) {
    return { ok: false, status: 503, error: 'Ecosystem bridge is not configured' };
  }

  const source = req.get('x-trillion-source');
  const timestamp = req.get('x-trillion-timestamp');
  const signature = req.get('x-trillion-signature');
  if (source !== 'appforge' || !timestamp || !signature || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) {
    return { ok: false, status: 401, error: 'Invalid ecosystem signature headers' };
  }

  const requestTime = Number(timestamp);
  if (!Number.isSafeInteger(requestTime) || Math.abs(Date.now() - requestTime) > MAX_CLOCK_SKEW_MS) {
    return { ok: false, status: 401, error: 'Expired ecosystem request' };
  }

  const body = JSON.stringify(req.body ?? {});
  const expected = signEcosystemPayload(secret, timestamp, body);
  const suppliedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const matches =
    suppliedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);

  if (!matches) {
    return { ok: false, status: 401, error: 'Invalid ecosystem signature' };
  }

  return { ok: true };
}

export function requireEcosystemSignature(req, res, next) {
  const verified = verifyEcosystemRequest(req);
  if (!verified.ok) {
    return res.status(verified.status).json({ error: verified.error });
  }
  return next();
}
