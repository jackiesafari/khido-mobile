import React from 'react';
import { StyleSheet, View, SafeAreaView, ScrollView, Text, Platform, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { Routes } from '@/types/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function DashboardPage() {
  const handleProfilePress = () => {
    router.push(Routes.PROFILE);
  };

  const handleAvatarPress = () => {
    router.push(Routes.AVATAR);
  };

  const handleGamesPress = () => {
    router.push(Routes.GAMES);
  };

  const handleSoundsPress = () => {
    router.push(Routes.SOUNDS);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.background} lightColor="#7BAEF9" darkColor="#7BAEF9">
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <Text style={styles.headerTitle}>Hello Friend!</Text>
            <Text style={styles.headerSubtitle}>How would you like to feel calmer today?</Text>
          </View>

          <View style={styles.navigationGrid}>
            <TouchableOpacity style={styles.navCard} onPress={handleProfilePress} activeOpacity={0.75}>
              <View style={styles.navCardCircle}>
                <LinearGradient
                  colors={['#9D4EDD', '#4A90E2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientCircle}>
                  <MaterialIcons name="person" size={72} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <Text style={styles.navCardLabel}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navCard} onPress={handleAvatarPress} activeOpacity={0.75}>
              <View style={styles.navCardCircle}>
                <Image source={require('@/assets/images/wave.png')} style={styles.navCardImage} contentFit="cover" />
              </View>
              <Text style={styles.navCardLabel}>Avatar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navCard} onPress={handleGamesPress} activeOpacity={0.75}>
              <View style={styles.navCardCircle}>
                <Image
                  source={require('@/assets/images/superherogame.png')}
                  style={styles.navCardImage}
                  contentFit="cover"
                />
              </View>
              <Text style={styles.navCardLabel}>Games</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navCard} onPress={handleSoundsPress} activeOpacity={0.75}>
              <View style={[styles.navCardCircle, styles.soundCircle]}>
                <MaterialIcons name="graphic-eq" size={72} color="#1D4ED8" />
              </View>
              <Text style={styles.navCardLabel}>Sounds</Text>
            </TouchableOpacity>
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
    paddingBottom: 24,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 36,
    color: '#FFFFFF',
    textAlign: 'center',
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
  headerSubtitle: {
    marginTop: 8,
    fontSize: 17,
    color: '#F2F6FF',
    textAlign: 'center',
    ...Platform.select({
      ios: {
        fontFamily: 'system',
        fontWeight: '500',
      },
      android: {
        fontFamily: 'sans-serif',
        fontWeight: '500',
      },
      default: {
        fontFamily: 'system',
        fontWeight: '500',
      },
    }),
  },
  navigationGrid: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 24,
  },
  navCard: {
    width: '47%',
    alignItems: 'center',
  },
  navCardCircle: {
    width: 142,
    height: 142,
    borderRadius: 71,
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
    marginBottom: 12,
  },
  gradientCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 71,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navCardImage: {
    width: '100%',
    height: '100%',
  },
  soundCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ECF2FF',
  },
  navCardLabel: {
    fontSize: 20,
    color: '#000000',
    textAlign: 'center',
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
