import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  type AvatarSpirit,
  type CheckInWindow,
  type CopingStyle,
  getProfileSnapshot,
  updateProfile,
  type UserProfile,
} from '@/lib/profile-store';
import {
  calculateProfileCompletion,
  loadProfileFromSupabase,
  markFeatureUsed,
  saveProfileToSupabase,
} from '@/lib/profile-sync';

type AvatarCard = {
  id: AvatarSpirit;
  title: string;
  subtitle: string;
  accent: string;
  gradient: [string, string];
  image: number;
  imageScale: number;
  imageOffsetY: number;
};

const AVATAR_CHOICES: AvatarCard[] = [
  {
    id: 'snowleopard',
    title: 'Snow Leopard',
    subtitle: 'Perceptive and resilient',
    accent: '#38BDF8',
    gradient: ['#5D7992', '#A6C7D9'],
    image: require('@/assets/images/snowleopardcasualillustration.png'),
    imageScale: 0.98,
    imageOffsetY: -8,
  },
  {
    id: 'lizard',
    title: 'Lizard',
    subtitle: 'Adaptable and observant',
    accent: '#22C55E',
    gradient: ['#1F7A37', '#7AD14B'],
    image: require('@/assets/images/greenlizardillustration.png'),
    imageScale: 0.98,
    imageOffsetY: -8,
  },
  {
    id: 'bear',
    title: 'Bear',
    subtitle: 'Grounded and protective',
    accent: '#F59E0B',
    gradient: ['#6B3F1D', '#B66A3C'],
    image: require('@/assets/images/bearillustration.png'),
    imageScale: 0.98,
    imageOffsetY: -8,
  },
  {
    id: 'bird',
    title: 'Bird',
    subtitle: 'Bright and uplifting',
    accent: '#F43F5E',
    gradient: ['#8C1D40', '#E11D48'],
    image: require('@/assets/images/redcardinalillustration.png'),
    imageScale: 0.98,
    imageOffsetY: -8,
  },
];

const COPING_STYLES: { id: CopingStyle; label: string }[] = [
  { id: 'breathing', label: 'Breathing' },
  { id: 'movement', label: 'Movement' },
  { id: 'sound', label: 'Sound' },
  { id: 'journaling', label: 'Journaling' },
  { id: 'talking', label: 'Talking' },
];

const CHECK_IN_WINDOWS: { id: CheckInWindow; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'flexible', label: 'Flexible' },
];

function MascotBubble({ option, size = 94 }: { option: AvatarCard; size?: number }) {
  return (
    <View style={[styles.mascotBubbleWrap, { width: size, height: size }]}>
      <View style={[styles.mascotGlow, { borderColor: option.accent }]} />
      <LinearGradient colors={option.gradient} style={[styles.mascotBubble, { borderColor: option.accent }]}>
        <View style={styles.imageViewport}>
          <Image
            source={option.image}
            contentFit="cover"
            contentPosition="top"
            style={[
              styles.mascotImage,
              {
                transform: [{ scale: option.imageScale }, { translateY: option.imageOffsetY }],
              },
            ]}
          />
        </View>
      </LinearGradient>
    </View>
  );
}

export default function ProfileScreen() {
  const [draft, setDraft] = useState<UserProfile>(getProfileSnapshot());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const completion = useMemo(() => {
    return calculateProfileCompletion(draft);
  }, [draft]);

  const selectedAvatar = AVATAR_CHOICES.find((choice) => choice.id === draft.avatarSpirit) ?? AVATAR_CHOICES[0];

  const updateDraft = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const remote = await loadProfileFromSupabase();
        if (active && remote) {
          setDraft(remote);
          updateProfile(remote);
        }
      } catch (error) {
        console.warn('[profile] failed to load profile', error);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    void markFeatureUsed('profile').catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const saved = await saveProfileToSupabase(draft);
      if (saved) {
        updateProfile(saved);
      } else {
        updateProfile(draft);
      }
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save profile right now.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#081B34', '#0C355F', '#0E5C80']} style={styles.background}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.iconButton} activeOpacity={0.75}>
              <MaterialIcons name="arrow-back" size={22} color="#F8FAFC" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveButton} activeOpacity={0.85}>
              {isSaving ? <ActivityIndicator size="small" color="#042F2E" /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>

          {isLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#E2E8F0" />
              <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
          )}

          <View style={styles.heroCard}>
            <MascotBubble option={selectedAvatar} />
            <Text style={styles.heroName}>{draft.displayName || 'Friend'}</Text>
            <Text style={styles.heroSubtitle}>{selectedAvatar.title} interpretation</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{draft.streakDays}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{draft.currentBadge}</Text>
                <Text style={styles.statLabel}>Badge</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{draft.calmPoints}</Text>
                <Text style={styles.statLabel}>Calm Points</Text>
              </View>
            </View>
            <View style={styles.completionContainer}>
              <Text style={styles.completionLabel}>Profile completion</Text>
              <Text style={styles.completionValue}>{completion}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completion}%` }]} />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Choose your inner character</Text>
          <View style={styles.avatarGrid}>
            {AVATAR_CHOICES.map((choice) => {
              const selected = choice.id === draft.avatarSpirit;
              return (
                <TouchableOpacity
                  key={choice.id}
                  style={[styles.avatarChoice, selected && { borderColor: choice.accent }]}
                  onPress={() => updateDraft('avatarSpirit', choice.id)}
                  activeOpacity={0.8}>
                  <MascotBubble option={choice} size={74} />
                  <Text style={styles.avatarChoiceTitle}>{choice.title}</Text>
                  <Text style={styles.avatarChoiceSubtitle}>{choice.subtitle}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Personal details</Text>
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              style={styles.input}
              value={draft.displayName}
              onChangeText={(value) => updateDraft('displayName', value)}
              placeholder="What should we call you?"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Calm alias</Text>
            <TextInput
              style={styles.input}
              value={draft.calmAlias}
              onChangeText={(value) => updateDraft('calmAlias', value)}
              placeholder="Explorer of calm, steady friend..."
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Favorite animal</Text>
            <TextInput
              style={styles.input}
              value={draft.favoriteAnimal}
              onChangeText={(value) => updateDraft('favoriteAnimal', value)}
              placeholder="Animal that makes you feel safe"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Comfort phrase</Text>
            <TextInput
              style={styles.input}
              value={draft.comfortPhrase}
              onChangeText={(value) => updateDraft('comfortPhrase', value)}
              placeholder="A phrase Khido can use with you"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Main support goal</Text>
            <TextInput
              style={styles.input}
              value={draft.supportGoal}
              onChangeText={(value) => updateDraft('supportGoal', value)}
              placeholder="How should your avatar help most?"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Sensory reset preference</Text>
            <TextInput
              style={styles.input}
              value={draft.sensoryReset}
              onChangeText={(value) => updateDraft('sensoryReset', value)}
              placeholder="Nature sounds, dim lights, quiet room..."
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Celebration style</Text>
            <TextInput
              style={styles.input}
              value={draft.celebrationStyle}
              onChangeText={(value) => updateDraft('celebrationStyle', value)}
              placeholder="How should progress be celebrated?"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Triggers to avoid (optional)</Text>
            <TextInput
              style={[styles.input, styles.multiLine]}
              value={draft.triggerNotes}
              onChangeText={(value) => updateDraft('triggerNotes', value)}
              placeholder="Words or topics you want Khido to avoid"
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
            />
          </View>

          <Text style={styles.sectionTitle}>How you regulate best</Text>
          <View style={styles.chipRow}>
            {COPING_STYLES.map((style) => {
              const active = draft.copingStyle === style.id;
              return (
                <TouchableOpacity
                  key={style.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => updateDraft('copingStyle', style.id)}
                  activeOpacity={0.8}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{style.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Preferred check-in window</Text>
          <View style={styles.chipRow}>
            {CHECK_IN_WINDOWS.map((window) => {
              const active = draft.checkInWindow === window.id;
              return (
                <TouchableOpacity
                  key={window.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => updateDraft('checkInWindow', window.id)}
                  activeOpacity={0.8}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{window.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={handleSave} style={styles.footerButton} activeOpacity={0.85}>
            <Text style={styles.footerButtonText}>{isSaving ? 'Saving...' : 'Save profile'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  header: {
    marginTop: 8,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#14B8A6',
  },
  saveButtonText: {
    color: '#042F2E',
    fontWeight: '800',
    fontSize: 14,
  },
  loadingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  mascotBubbleWrap: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 2,
    opacity: 0.34,
    transform: [{ scale: 1.1 }],
  },
  mascotBubble: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  imageViewport: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  mascotImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  heroName: {
    marginTop: 14,
    color: '#F8FAFC',
    fontSize: 28,
    textAlign: 'center',
    fontWeight: '800',
  },
  heroSubtitle: {
    marginTop: 4,
    color: '#7DD3FC',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
  statsRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.6)',
  },
  statValue: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  completionContainer: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  completionLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  completionValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#334155',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#14B8A6',
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 10,
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  avatarChoice: {
    width: '48.6%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    padding: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    alignItems: 'center',
  },
  avatarChoiceTitle: {
    color: '#E2E8F0',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
  avatarChoiceSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    padding: 14,
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderColor: 'rgba(100, 116, 139, 0.7)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#F8FAFC',
    fontSize: 15,
  },
  multiLine: {
    minHeight: 80,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
  },
  chipActive: {
    borderColor: '#2DD4BF',
    backgroundColor: '#042F2E',
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#5EEAD4',
  },
  footerButton: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#14B8A6',
  },
  footerButtonText: {
    color: '#052E2B',
    fontSize: 16,
    fontWeight: '800',
  },
});
