import React, { useEffect, useState } from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { completeAuthFromUrl, sendEmailOtp, signInWithAppleIdentity, verifyEmailOtp } from '@/lib/auth';
import { Routes } from '@/types/navigation';

let AppleAuthentication: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AppleAuthentication = require('expo-apple-authentication');
} catch {
  AppleAuthentication = null;
}

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canUseAppleSignIn = Platform.OS === 'ios' && Boolean(AppleAuthentication?.AppleAuthenticationButton);
  const incomingUrl = Linking.useURL();

  useEffect(() => {
    let mounted = true;
    const handleInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (!mounted || !initialUrl) return;
      try {
        const completed = await completeAuthFromUrl(initialUrl);
        if (completed) {
          router.replace(Routes.DASHBOARD);
        }
      } catch {
        // Keep user on code flow if link handling fails.
      }
    };
    handleInitialUrl();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!incomingUrl) return;
    const handleIncomingUrl = async () => {
      try {
        const completed = await completeAuthFromUrl(incomingUrl);
        if (completed) {
          router.replace(Routes.DASHBOARD);
        }
      } catch {
        setError('Sign-in link could not be completed. You can still use the 6-digit code.');
      }
    };
    handleIncomingUrl();
  }, [incomingUrl]);

  const handleSendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Please enter your email.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await sendEmailOtp(normalizedEmail);
      setStep('verify');
      setMessage('Check your email. You can either tap the sign-in link or enter the 6-digit code here.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    if (!normalizedEmail || !normalizedCode) {
      setError('Please enter both email and code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await verifyEmailOtp(normalizedEmail, normalizedCode);
      router.replace(Routes.DASHBOARD);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (!AppleAuthentication) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple sign-in did not return an identity token.');
      }
      await signInWithAppleIdentity({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode || undefined,
      });
      router.replace(Routes.DASHBOARD);
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') {
        setMessage('Apple sign-in was canceled.');
      } else {
        setError(err instanceof Error ? err.message : 'Apple sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.background} lightColor="#7BAEF9" darkColor="#7BAEF9">
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>Use your email for a one-time sign-in.</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#8A8A8A"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {step === 'verify' && (
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor="#8A8A8A"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          {message && <Text style={styles.message}>{message}</Text>}

          {step === 'email' ? (
            <Button title="Send Code" onPress={handleSendCode} loading={loading} style={styles.button} />
          ) : (
            <>
              <Button title="Verify & Continue" onPress={handleVerifyCode} loading={loading} style={styles.button} />
              <TouchableOpacity
                onPress={handleSendCode}
                disabled={loading}
                style={styles.linkButton}
                activeOpacity={0.7}>
                <Text style={styles.linkButtonText}>Resend code</Text>
              </TouchableOpacity>
            </>
          )}

          {canUseAppleSignIn && (
            <View style={styles.appleButtonWrapper}>
              <Text style={styles.orText}>or</Text>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={8}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            </View>
          )}
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backText: {
    color: '#1D3557',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1D3557',
  },
  subtitle: {
    fontSize: 15,
    color: '#445',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D8D8D8',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#FAFAFA',
  },
  error: {
    color: '#B42318',
    fontSize: 14,
  },
  message: {
    color: '#1D6F42',
    fontSize: 14,
  },
  button: {
    marginTop: 8,
  },
  linkButton: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  linkButtonText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '600',
  },
  appleButtonWrapper: {
    marginTop: 8,
    alignItems: 'center',
    gap: 10,
  },
  orText: {
    color: '#555',
    fontSize: 14,
  },
  appleButton: {
    width: '100%',
    height: 44,
  },
});
