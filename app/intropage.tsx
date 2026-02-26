import React from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Routes } from '@/types/navigation';
import { clearSession } from '@/lib/auth';

export default function IntroPage() {
  const handleDemo = () => {
    clearSession();
    router.push(Routes.DASHBOARD);
  };

  const handleLogin = () => {
    router.push(Routes.AUTH);
  };

  const handleSignUp = () => {
    router.push(Routes.AUTH);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.background} lightColor="#7BAEF9" darkColor="#7BAEF9">
        <View style={styles.panelContainer}>
          <ThemedView style={styles.panel} lightColor="#7BAEF9" darkColor="#7BAEF9">
            <View style={styles.avatarContainer}>
              <Image
                source={require('@/assets/images/default-face.png')}
                style={styles.avatar}
                contentFit="cover"
              />
            </View>

            <Text style={styles.name}>Khido</Text>
            <Text style={styles.tagline}>Your new friend</Text>

            <View style={styles.buttonContainer}>
              <Button title="Demo" onPress={handleDemo} variant="primary" style={styles.button} />
              <Button title="Log in" onPress={handleLogin} variant="primary" style={styles.button} />
              <Button title="Sign up" onPress={handleSignUp} variant="primary" style={styles.button} />
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
