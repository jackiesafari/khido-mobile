import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

type SupabaseSession = {
  access_token: string;
  refresh_token?: string;
  user?: { id: string; email?: string };
};

export type AppleIdentityPayload = {
  identityToken: string;
  authorizationCode?: string;
  nonce?: string;
};

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string | null;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string | null;
const chatApiUrl = Constants.expoConfig?.extra?.chatApiUrl as string | null;
const configuredAuthBridgeUrl = Constants.expoConfig?.extra?.authBridgeUrl as string | null;

let session: SupabaseSession | null = null;

function assertSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
}

async function request(path: string, body: object) {
  assertSupabaseConfig();
  const res = await fetch(`${supabaseUrl}${path}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = (data as { error_description?: string; msg?: string }).error_description
      || (data as { msg?: string }).msg
      || 'Auth request failed';
    throw new Error(error);
  }
  return data;
}

export async function sendEmailOtp(email: string) {
  const appDeepLink = Linking.createURL('/auth');
  const fallbackBridgeBase = chatApiUrl ? `${chatApiUrl.replace(/\/$/, '')}/auth/callback` : null;
  const bridgeBase = configuredAuthBridgeUrl || fallbackBridgeBase;
  const emailRedirectTo = bridgeBase
    ? `${bridgeBase}?next=${encodeURIComponent(appDeepLink)}`
    : appDeepLink;

  await request('/auth/v1/otp', {
    email,
    create_user: true,
    redirect_to: emailRedirectTo,
    email_redirect_to: emailRedirectTo,
  });
}

export async function verifyEmailOtp(email: string, token: string) {
  const data = await request('/auth/v1/verify', {
    email,
    token,
    type: 'email',
  });
  session = data as SupabaseSession;
  return session;
}

function getParamsFromUrl(url: string): URLSearchParams {
  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');
  const queryPart = queryIndex >= 0
    ? url.substring(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
    : '';
  const hashPart = hashIndex >= 0 ? url.substring(hashIndex + 1) : '';

  const params = new URLSearchParams(queryPart);
  const hashParams = new URLSearchParams(hashPart);
  for (const [key, value] of hashParams.entries()) {
    if (!params.has(key)) {
      params.set(key, value);
    }
  }
  return params;
}

export async function completeAuthFromUrl(url: string): Promise<boolean> {
  assertSupabaseConfig();
  const params = getParamsFromUrl(url);

  const errorDescription = params.get('error_description') || params.get('error');
  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const accessToken = params.get('access_token');
  if (accessToken) {
    session = {
      access_token: accessToken,
      refresh_token: params.get('refresh_token') || undefined,
    };
    return true;
  }

  const tokenHash = params.get('token_hash') || params.get('token');
  const type = params.get('type');
  if (tokenHash && type) {
    const data = await request('/auth/v1/verify', {
      token_hash: tokenHash,
      type,
    });
    session = data as SupabaseSession;
    return true;
  }

  return false;
}

export async function signInWithAppleIdentity(payload: AppleIdentityPayload) {
  assertSupabaseConfig();
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=id_token`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: 'apple',
      id_token: payload.identityToken,
      access_token: payload.authorizationCode || undefined,
      nonce: payload.nonce || undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = (data as { error_description?: string; msg?: string }).error_description
      || (data as { msg?: string }).msg
      || 'Apple sign-in failed';
    throw new Error(error);
  }

  session = data as SupabaseSession;
  return session;
}

export function getAccessToken() {
  return session?.access_token || null;
}

export function clearSession() {
  session = null;
}

export function isAuthenticated() {
  return Boolean(session?.access_token);
}
