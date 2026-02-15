import React from 'react';
import { StyleSheet, View, SafeAreaView, ScrollView, Text, Platform, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { Routes } from '@/types/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * DashboardPage - Main dashboard for the app
 * 
 * Features:
 * - Header with Dashboard title and user profile
 * - Three navigation cards: Profile, Avatar, and Games
 * - Clean circular card design with clear labels
 * - Navigation to different app sections
 */
export default function DashboardPage() {
  const handleProfilePress = () => {
    // TODO: Navigate to profile settings
    console.log('Navigate to Profile');
    // router.push('/profile');
  };

  const handleAvatarPress = () => {
    router.push(Routes.AVATAR);
  };

  const handleGamesPress = () => {
    // TODO: Navigate to games section
    console.log('Navigate to Games');
    // router.push('/games');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.background} lightColor="#7BAEF9" darkColor="#7BAEF9">
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text style={styles.headerTitle}>Hello Friend!</Text>
          </View>

          {/* Navigation Cards Section - Triangular Layout */}
          <View style={styles.navigationSection}>
            {/* Row 1: Profile Card (centered) */}
            <View style={styles.topRow}>
              <TouchableOpacity 
                style={[styles.navCard, styles.topNavCard]}
                onPress={handleProfilePress}
                activeOpacity={0.7}>
                <View style={styles.navCardImageContainer}>
                  <View style={styles.navCardCircle}>
                    <LinearGradient
                      colors={['#9D4EDD', '#4A90E2']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.gradientCircle}>
                      <MaterialIcons name="person" size={80} color="#FFFFFF" />
                    </LinearGradient>
                  </View>
                </View>
                <Text style={styles.navCardLabel}>Profile</Text>
              </TouchableOpacity>
            </View>

            {/* Row 2: Avatar (left) and Games (right) side by side */}
            <View style={styles.bottomRow}>
              {/* Avatar Card */}
              <TouchableOpacity 
                style={styles.navCard}
                onPress={handleAvatarPress}
                activeOpacity={0.7}>
                <View style={styles.navCardImageContainer}>
                  <View style={styles.navCardCircle}>
                    <Image
                      source={require('@/assets/images/wave.png')}
                      style={styles.navCardImage}
                      contentFit="cover"
                    />
                  </View>
                </View>
                <Text style={styles.navCardLabel}>Avatar</Text>
              </TouchableOpacity>

              {/* Games Card */}
              <TouchableOpacity 
                style={styles.navCard}
                onPress={handleGamesPress}
                activeOpacity={0.7}>
                <View style={styles.navCardImageContainer}>
                  <View style={styles.navCardCircle}>
                    <Image
                      source={require('@/assets/images/superherogame.png')}
                      style={styles.navCardImage}
                      contentFit="cover"
                    />
                  </View>
                </View>
                <Text style={styles.navCardLabel}>Games</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerSection: {
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 36,
    color: '#FFFFFF',
    textAlign: 'center',
    // Using same font styling as intropage
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
  navigationSection: {
    paddingHorizontal: 40,
    paddingTop: 20,
    alignItems: 'center',
  },
  topRow: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  bottomRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  navCard: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 160,
  },
  topNavCard: {
    width: '100%',
    maxWidth: '100%',
  },
  navCardImageContainer: {
    marginBottom: 12,
  },
  navCardCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    backgroundColor: '#E5E5E5',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  gradientCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navCardImage: {
    width: '100%',
    height: '100%',
  },
  navCardLabel: {
    fontSize: 20,
    color: '#000000',
    textAlign: 'center',
    // Using same font styling
    ...Platform.select({
      ios: {
        fontFamily: 'system',
        fontWeight: '700',
      },
      android: {
        fontFamily: 'sans-serif-medium',
        fontWeight: '700',
      },
      default: {
        fontFamily: 'system',
        fontWeight: '700',
      },
    }),
  },
});
