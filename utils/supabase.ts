import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    storageKey: 'khido-auth-token',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // OTP only – no magic link redirect
  },
})

function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybeMessage = (error as { message?: unknown }).message
  return typeof maybeMessage === 'string' && maybeMessage.toLowerCase().includes('invalid refresh token')
}

async function clearLocalAuthState() {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // Ignore sign out failures when token is already invalid.
  }
  try {
    await AsyncStorage.removeItem('khido-auth-token')
  } catch {
    // Ignore storage cleanup failures.
  }
}

export async function recoverAuthSession() {
  try {
    await supabase.auth.getSession()
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearLocalAuthState()
      return
    }
    throw error
  }
}

// ─── Email OTP (6-digit code only, no redirect) ───────────────────────────────

export async function sendEmailOtp(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  })

  if (error) throw error
}

// ─── Verify OTP (6-digit code) ────────────────────────────────────────────────

export async function verifyEmailOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) throw error
  return data.session
}

// ─── Apple Sign In ────────────────────────────────────────────────────────────

export type AppleIdentityPayload = {
  identityToken: string
  authorizationCode?: string
  nonce?: string
}

export async function signInWithAppleIdentity(payload: AppleIdentityPayload) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: payload.identityToken,
    nonce: payload.nonce,
  })

  if (error) throw error
  return data.session
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearLocalAuthState()
      return null
    }
    throw error
  }
}

export async function clearSession() {
  await clearLocalAuthState()
}

export async function isAuthenticated() {
  try {
    const { data } = await supabase.auth.getSession()
    return Boolean(data.session?.access_token)
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearLocalAuthState()
      return false
    }
    throw error
  }
}
