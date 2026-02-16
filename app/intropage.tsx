import React from 'react';
import { StyleSheet, View, SafeAreaView, Text, Platform } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Routes } from '@/types/navigation';

/**
 * IntroPage - The first screen users see when opening the app
 * 
 * This page serves as the entry point and can be used to:
 * - Show app branding and character
 * - Provide navigation to demo, login, or signup flows
 * - Handle first-time user experience
 * 
 * Future enhancements:
 * - Add authentication state checking
 * - Add onboarding flow for new users
 * - Add skip/continue logic based on user state
 */
export default function IntroPage() {
  const handleDemo = () => {
    // Navigate to dashboard
    router.push(Routes.DASHBOARD);
  };

  const handleLogin = () => {
    // Navigate to login screen
    // TODO: Implement login navigation when auth is ready
    // router.push(Routes.LOGIN);
    console.log('Login pressed - auth flow to be implemented');
  };

  const handleSignUp = () => {
    // Navigate to signup screen
    // TODO: Implement signup navigation when auth is ready
    // router.push(Routes.SIGNUP);
    console.log('Sign up pressed - auth flow to be implemented');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.background} lightColor="#7BAEF9" darkColor="#7BAEF9">
        
        {/* Main content panel */}
        <View style={styles.panelContainer}>
          <ThemedView style={styles.panel} lightColor="#7BAEF9" darkColor="#7BAEF9">
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <Image
                source={require('@/assets/images/default-face.png')}
                style={styles.avatar}
                contentFit="cover"
              />
            </View>

            {/* Name - Using Text component for better font control */}
            <Text style={styles.name}>Khiddo</Text>

            {/* Tagline - Using same font as name */}
            <Text style={styles.tagline}>Your new friend</Text>

            {/* Action buttons */}
            <View style={styles.buttonContainer}>
              <Button
                title="Demo"
                onPress={handleDemo}
                variant="primary"
                style={styles.button}
              />
              <Button
                title="Log in"
                onPress={handleLogin}
                variant="primary"
                style={styles.button}
              />
              <Button
                title="Sign up"
                onPress={handleSignUp}
                variant="primary"
                style={styles.button}
              />
            </View>
          </ThemedView>
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
    position: 'relative',
  },
  headerLabel: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  headerLabelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  panelContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
    minHeight: 500,
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
    marginBottom: 32,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: 48,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 56,
    // TODO: Load Baloo Bhai font using expo-font
    // For now using system font with similar weight
    // Once font is loaded, use: fontFamily: 'BalooBhai2-Regular'
    ...Platform.select({
      ios: {
        fontFamily: 'system',
        fontWeight: '800',
      },
      android: {
        fontFamily: 'sans-serif-medium',
        fontWeight: '700',
      },
      default: {
        fontFamily: 'system',
        fontWeight: '800',
      },
    }),
  },
  tagline: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 48,
    // Using same font as name (Baloo Bhai)
    ...Platform.select({
      ios: {
        fontFamily: 'system',
        fontWeight: '600',
      },
      android: {
        fontFamily: 'sans-serif-medium',
        fontWeight: '600',
      },
      default: {
        fontFamily: 'system',
        fontWeight: '600',
      },
    }),
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 18,
    paddingTop: 8,
  },
  button: {
    width: 175,
  },
});
