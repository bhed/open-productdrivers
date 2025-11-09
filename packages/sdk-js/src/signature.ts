/**
 * HMAC Signature Utilities for Server-Side SDK Usage
 * 
 * SECURITY: Only use these functions in server-side environments
 * Never expose your secret_key in frontend code!
 */

/**
 * Generates HMAC-SHA256 signature for server-side requests
 * 
 * @param secretKey Project secret key (starts with sk_)
 * @param projectKey Project public key (starts with pk_)
 * @param timestamp Request timestamp in milliseconds
 * @param nonce Optional nonce for additional security
 * @param payload Request payload as string (JSON.stringify)
 * @returns Hex-encoded HMAC signature
 */
export async function generateSignature(
  secretKey: string,
  projectKey: string,
  timestamp: number,
  nonce: string,
  payload: string
): Promise<string> {
  // Construct message: projectKey:timestamp:nonce:payload
  const message = `${projectKey}:${timestamp}:${nonce}:${payload}`;
  
  // Check environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    throw new Error(
      'SECURITY ERROR: generateSignature() should never be called in browser/frontend! ' +
      'This function is for server-side use only. Your secret_key would be exposed.'
    );
  }
  
  // Node.js environment
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Web Crypto API (modern Node.js, Deno, Cloudflare Workers)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(message)
    );
    
    // Convert to hex string
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  // Fallback for older Node.js with crypto module
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    const hmac = nodeCrypto.createHmac('sha256', secretKey);
    hmac.update(message);
    return hmac.digest('hex');
  } catch {
    throw new Error(
      'No suitable crypto implementation found. ' +
      'Please use Node.js 16+ or a modern runtime with Web Crypto API support.'
    );
  }
}

/**
 * Creates a signed request payload for server-side tracking
 * 
 * @param secretKey Project secret key
 * @param payload Request payload object
 * @returns Payload with signature, timestamp, and nonce added
 */
export async function signRequest<T extends { projectKey: string }>(
  secretKey: string,
  payload: T
): Promise<T & { signature: string; timestamp: number; nonce: string }> {
  const timestamp = Date.now();
  const nonce = generateNonce();
  
  // Create payload string (excluding signature fields)
  const payloadString = JSON.stringify(payload);
  
  // Generate signature
  const signature = await generateSignature(
    secretKey,
    payload.projectKey,
    timestamp,
    nonce,
    payloadString
  );
  
  return {
    ...payload,
    signature,
    timestamp,
    nonce
  };
}

/**
 * Generates a random nonce for request uniqueness
 * @returns Random hex string (16 bytes = 32 hex chars)
 */
function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  // Fallback for Node.js
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomBytes(16).toString('hex');
  } catch {
    throw new Error('No suitable random generator found');
  }
}

/**
 * Example usage for server-side tracking:
 * 
 * ```typescript
 * import { signRequest } from '@productdrivers/sdk-js/signature';
 * 
 * const secretKey = process.env.PRODUCTDRIVERS_SECRET_KEY!;
 * 
 * const payload = {
 *   projectKey: 'pk_...',
 *   event: 'JOURNEY_START',
 *   journey: 'onboarding',
 *   userId: 'user_123'
 * };
 * 
 * const signedPayload = await signRequest(secretKey, payload);
 * 
 * await fetch('https://your-project.supabase.co/functions/v1/track', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify(signedPayload)
 * });
 * ```
 */

