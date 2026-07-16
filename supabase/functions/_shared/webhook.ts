const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

export async function verifyWebhookSignature(request: Request, rawBody: string, secret: string, maxSkewSeconds = 300) {
  const timestamp = request.headers.get('x-webhook-timestamp');
  const provided = request.headers.get('x-webhook-signature')?.replace(/^sha256=/, '').toLowerCase();
  const seconds = Number(timestamp);
  if (!timestamp || !provided || !/^\d{64}$/.test(provided) || !Number.isSafeInteger(seconds)) return null;
  if (Math.abs(Math.floor(Date.now() / 1000) - seconds) > maxSkewSeconds) return null;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const expected = toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`)));
  if (!constantTimeEqual(expected, provided)) return null;
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(`${timestamp}.${provided}`)));
}
