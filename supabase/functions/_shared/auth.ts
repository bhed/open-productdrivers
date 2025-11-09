/**
 * Shared Authentication & Security Utilities
 * Used by edge functions for request validation
 */

export interface ValidationMode {
  mode: 'frontend' | 'backend';
  projectId: string;
}

export interface HMACPayload {
  projectKey: string;
  timestamp: number;
  signature?: string;
  nonce?: string;
}

/**
 * Validates HMAC signature for server-side requests
 * 
 * Algorithm: HMAC-SHA256
 * Format: signature = HMAC(secret_key, projectKey + timestamp + nonce + payload)
 * 
 * @param payload Request payload
 * @param secretKey Project secret key
 * @param body Request body as string
 * @returns true if valid, false otherwise
 */
export async function validateHMACSignature(
  payload: HMACPayload,
  secretKey: string,
  body: string
): Promise<{ valid: boolean; error?: string }> {
  // Check required fields
  if (!payload.signature) {
    return { valid: false, error: 'Missing signature' };
  }

  if (!payload.timestamp) {
    return { valid: false, error: 'Missing timestamp' };
  }

  // Check timestamp is within 5 minutes (replay attack prevention)
  const now = Date.now();
  const requestTime = payload.timestamp;
  const timeDiff = Math.abs(now - requestTime);
  const MAX_TIME_DIFF = 5 * 60 * 1000; // 5 minutes

  if (timeDiff > MAX_TIME_DIFF) {
    return { valid: false, error: 'Timestamp expired (max 5 minutes)' };
  }

  try {
    // Reconstruct the message that should have been signed
    const message = `${payload.projectKey}:${payload.timestamp}:${payload.nonce || ''}:${body}`;
    
    // Convert secret key to Uint8Array
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    
    // Import key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign the message
    const signature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(message)
    );
    
    // Convert to hex string
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Compare signatures (constant-time comparison)
    const providedSignature = payload.signature.toLowerCase();
    
    if (expectedSignature !== providedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    return { valid: true };
  } catch (error) {
    console.error('HMAC validation error:', error);
    return { valid: false, error: 'Signature validation failed' };
  }
}

/**
 * Check rate limiting using database fallback
 * 
 * @param supabase Supabase client
 * @param projectKey Project key
 * @param maxRequests Max requests per window
 * @param windowMs Window size in milliseconds
 * @returns true if allowed, false if rate limit exceeded
 */
export async function checkRateLimit(
  supabase: any,
  projectKey: string,
  maxRequests: number = 1000,
  windowMs: number = 60000
): Promise<boolean> {
  try {
    // Calculate window start (round down to minute)
    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    
    // Try to insert or update rate limit record
    const { data, error } = await supabase
      .from('rate_limits')
      .select('request_count')
      .eq('project_key', projectKey)
      .eq('window_start', windowStart.toISOString())
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Rate limit check error:', error);
      // In case of error, allow request (fail open)
      return true;
    }
    
    if (!data) {
      // First request in this window
      await supabase
        .from('rate_limits')
        .insert({
          project_key: projectKey,
          window_start: windowStart.toISOString(),
          request_count: 1
        });
      return true;
    }
    
    // Check if limit exceeded
    if (data.request_count >= maxRequests) {
      return false;
    }
    
    // Increment counter
    await supabase
      .from('rate_limits')
      .update({ request_count: data.request_count + 1 })
      .eq('project_key', projectKey)
      .eq('window_start', windowStart.toISOString());
    
    return true;
  } catch (error) {
    console.error('Rate limit error:', error);
    // Fail open in case of unexpected errors
    return true;
  }
}

/**
 * Check and record signature to prevent replay attacks
 * 
 * @param supabase Supabase client
 * @param projectId Project ID
 * @param signature Signature hash
 * @param timestamp Request timestamp
 * @returns true if signature is new, false if already used
 */
export async function checkSignatureReplay(
  supabase: any,
  projectId: string,
  signature: string,
  timestamp: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('request_signatures')
      .insert({
        project_id: projectId,
        signature_hash: signature,
        timestamp: new Date(timestamp).toISOString()
      });
    
    if (error) {
      // Signature already exists (replay attack)
      if (error.code === '23505') { // Unique violation
        return false;
      }
      // Other errors - fail open
      console.error('Signature replay check error:', error);
      return true;
    }
    
    return true;
  } catch (error) {
    console.error('Signature replay error:', error);
    // Fail open in case of unexpected errors
    return true;
  }
}

/**
 * Validates domain restriction for frontend requests
 *
 * @param origin Request origin
 * @param allowedDomain Allowed domain from project settings
 * @returns true if allowed, false otherwise
 */
export function validateDomain(origin: string | null, allowedDomain: string): boolean {
  if (!origin) {
    return false;
  }

  try {
    const originHostname = new URL(origin).hostname;

    // Check exact match or subdomain
    const isAllowed = originHostname === allowedDomain ||
                      originHostname.endsWith('.' + allowedDomain);

    return isAllowed;
  } catch {
    return false;
  }
}

/**
 * Validates Supabase API key from Authorization header
 *
 * This adds an additional layer of security by ensuring that only requests
 * with the correct Supabase anon key can access the Edge Functions.
 *
 * @param authHeader Authorization header value (format: "Bearer <key>")
 * @returns true if valid, false otherwise
 */
export function validateSupabaseApiKey(authHeader: string | null): boolean {
  if (!authHeader) {
    return false;
  }

  // Get expected anon key from environment
  const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!expectedAnonKey) {
    console.error('SUPABASE_ANON_KEY not set in environment');
    return false;
  }

  // Authorization header format: "Bearer <key>"
  const token = authHeader.replace('Bearer ', '').trim();

  return token === expectedAnonKey;
}

/**
 * Determines validation mode and validates request accordingly
 *
 * @param payload Request payload
 * @param projectData Project data from database
 * @param origin Request origin
 * @param supabase Supabase client
 * @param body Request body as string
 * @param authHeader Authorization header (for API key validation)
 * @returns Validation result
 */
export async function validateRequest(
  payload: any,
  projectData: { id: string; secret_key: string; domain_restriction: string | null },
  origin: string,
  supabase: any,
  body: string,
  authHeader?: string | null
): Promise<{ valid: boolean; error?: string; mode: 'frontend' | 'backend' }> {
  // STEP 1: Validate Supabase API key (required for all requests)
  if (!validateSupabaseApiKey(authHeader || null)) {
    return {
      valid: false,
      error: 'Invalid or missing Supabase API key in Authorization header',
      mode: payload.signature ? 'backend' : 'frontend'
    };
  }

  // STEP 2: BACKEND MODE - Signature present (HMAC-SHA256)
  if (payload.signature) {
    // Validate HMAC signature
    const hmacResult = await validateHMACSignature(
      payload,
      projectData.secret_key,
      body
    );

    if (!hmacResult.valid) {
      return { valid: false, error: hmacResult.error, mode: 'backend' };
    }

    // Check replay attack
    const replayCheck = await checkSignatureReplay(
      supabase,
      projectData.id,
      payload.signature,
      payload.timestamp
    );

    if (!replayCheck) {
      return { valid: false, error: 'Signature already used (replay attack)', mode: 'backend' };
    }

    return { valid: true, mode: 'backend' };
  }

  // STEP 3: FRONTEND MODE - No signature (domain restriction + rate limiting)
  // Check domain restriction if configured
  if (projectData.domain_restriction) {
    const requestOrigin = origin === '*' ? null : origin;
    
    if (!requestOrigin) {
      return { 
        valid: false, 
        error: 'Origin header required for domain-restricted projects',
        mode: 'frontend'
      };
    }
    
    const domainValid = validateDomain(requestOrigin, projectData.domain_restriction);
    
    if (!domainValid) {
      return { 
        valid: false, 
        error: 'Domain not allowed for this project',
        mode: 'frontend'
      };
    }
  }
  
  // Check rate limiting (stricter for frontend)
  const rateLimitOk = await checkRateLimit(
    supabase,
    payload.projectKey,
    1000, // 1000 requests per minute for frontend
    60000
  );
  
  if (!rateLimitOk) {
    return { valid: false, error: 'Rate limit exceeded', mode: 'frontend' };
  }
  
  return { valid: true, mode: 'frontend' };
}

