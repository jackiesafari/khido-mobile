import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { Routes } from '@/types/navigation';

type SoundId = 'rain' | 'waterfall' | 'birds' | 'frogs' | 'generalNature';

type SoundOption = {
  id: SoundId;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  note: string;
};

const SOUND_OPTIONS: SoundOption[] = [
  { id: 'rain', label: 'Rain', icon: 'water-drop', note: 'Soft rain over leaves' },
  { id: 'waterfall', label: 'Waterfall', icon: 'landscape', note: 'Steady flowing cascade' },
  { id: 'birds', label: 'Birds', icon: 'wb-sunny', note: 'Morning birds in the trees' },
  { id: 'frogs', label: 'Frogs', icon: 'filter-vintage', note: 'Nighttime pond ambience' },
  { id: 'generalNature', label: 'General Nature', icon: 'park', note: 'Wide ambient forest texture' },
];

const SOUND_SOURCES: Record<SoundId, number> = {
  rain: require('@/assets/sounds/rain.mp3'),
  waterfall: require('@/assets/sounds/waterfall.mp3'),
  birds: require('@/assets/sounds/birds.mp3'),
  frogs: require('@/assets/sounds/frogs.m4a'),
  generalNature: require('@/assets/sounds/general_nature.mp3'),
};

export default function SoundsScreen() {
  const [activeSound, setActiveSound] = useState<SoundId | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<Audio.Sound | null>(null);

  const barA = useRef(new Animated.Value(0.3)).current;
  const barB = useRef(new Animated.Value(0.5)).current;
  const barC = useRef(new Animated.Value(0.4)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const activeOption = useMemo(
    () => SOUND_OPTIONS.find((option) => option.id === activeSound) || null,
    [activeSound]
  );

  const startVisualizer = () => {
    loopRef.current?.stop();

    const one = Animated.loop(
      Animated.sequence([
        Animated.timing(barA, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(barA, { toValue: 0.3, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    const two = Animated.loop(
      Animated.sequence([
        Animated.timing(barB, { toValue: 0.7, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(barB, { toValue: 0.2, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    const three = Animated.loop(
      Animated.sequence([
        Animated.timing(barC, { toValue: 0.9, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(barC, { toValue: 0.35, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );

    loopRef.current = Animated.parallel([one, two, three]);
    loopRef.current.start();
  };

  const stopVisualizer = () => {
    loopRef.current?.stop();
    loopRef.current = null;
    barA.setValue(0.3);
    barB.setValue(0.5);
    barC.setValue(0.4);
  };

  const unloadAudio = async () => {
    if (!audioRef.current) return;
    await audioRef.current.unloadAsync();
    audioRef.current = null;
  };

  const playSound = async (soundId: SoundId) => {
    setIsLoading(true);
    setAudioError(null);
    try {
      await unloadAudio();
      const { sound } = await Audio.Sound.createAsync(
        SOUND_SOURCES[soundId],
        {
          shouldPlay: true,
          isLooping: true,
          volume: 0.9,
        }
      );
      audioRef.current = sound;
      setActiveSound(soundId);
      setIsPlaying(true);
      startVisualizer();
    } catch {
      setAudioError('Unable to play sound on this device right now.');
      setIsPlaying(false);
      stopVisualizer();
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (soundId: SoundId) => {
    if (isLoading) return;

    if (activeSound === soundId && audioRef.current) {
      if (isPlaying) {
        await audioRef.current.pauseAsync();
        setIsPlaying(false);
        stopVisualizer();
      } else {
        await audioRef.current.playAsync();
        setIsPlaying(true);
        startVisualizer();
      }
      return;
    }

    await playSound(soundId);
  };

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    }).catch(() => undefined);

    return () => {
      loopRef.current?.stop();
      if (audioRef.current) {
        audioRef.current.unloadAsync().catch(() => undefined);
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.background} lightColor="#7BAEF9" darkColor="#7BAEF9">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push(Routes.DASHBOARD)} style={styles.backButton} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Nature Sounds</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>Pick rain, waterfall, bird, frog, or general nature and let it run as a seamless ambient loop.</Text>

          <View style={styles.visualizerCard}>
            <Text style={styles.visualizerTitle}>{activeOption ? activeOption.label : 'No sound selected'}</Text>
            <Text style={styles.visualizerNote}>{activeOption?.note || 'Choose one sound option below to begin.'}</Text>
            {audioError && <Text style={styles.errorText}>{audioError}</Text>}
            <View style={styles.visualizerBars}>
              <Animated.View style={[styles.bar, { height: barA.interpolate({ inputRange: [0, 1], outputRange: [20, 74] }) }]} />
              <Animated.View style={[styles.bar, { height: barB.interpolate({ inputRange: [0, 1], outputRange: [20, 74] }) }]} />
              <Animated.View style={[styles.bar, { height: barC.interpolate({ inputRange: [0, 1], outputRange: [20, 74] }) }]} />
            </View>
          </View>

          {SOUND_OPTIONS.map((option) => {
            const selected = option.id === activeSound;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.card, selected && styles.cardSelected]}
                activeOpacity={0.75}
                onPress={() => handleToggle(option.id)}>
                <View style={styles.cardIconWrap}>
                  <MaterialIcons name={option.icon} size={30} color={selected ? '#2C5EE7' : '#1D4ED8'} />
                </View>
                <View style={styles.cardTextWrap}>
                  <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>{option.label}</Text>
                  <Text style={[styles.cardDescription, selected && styles.cardDescriptionSelected]}>
                    {selected && isPlaying ? 'Active calming loop (10m+ by continuous looping)' : option.note}
                  </Text>
                </View>
                <MaterialIcons
                  name={selected && isPlaying ? 'pause-circle-filled' : 'play-circle-fill'}
                  size={34}
                  color={selected ? '#FFFFFF' : '#1D4ED8'}
                />
              </TouchableOpacity>
            );
          })}
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  backLabel: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 34,
    color: '#FFFFFF',
    ...Platform.select({
      ios: { fontWeight: '800' },
      android: { fontFamily: 'sans-serif-medium', fontWeight: '700' },
      default: { fontWeight: '800' },
    }),
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  subtitle: {
    color: '#F3F7FF',
    fontSize: 16,
    marginBottom: 6,
  },
  visualizerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  visualizerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#15356F',
  },
  visualizerNote: {
    fontSize: 14,
    color: '#4868A8',
  },
  errorText: {
    color: '#B42318',
    fontSize: 13,
    marginTop: 2,
  },
  visualizerBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 80,
    paddingTop: 8,
  },
  bar: {
    width: 18,
    borderRadius: 9,
    backgroundColor: '#2C5EE7',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardSelected: {
    backgroundColor: '#2C5EE7',
  },
  cardIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ECF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 20,
    color: '#102A5C',
    fontWeight: '700',
  },
  cardTitleSelected: {
    color: '#FFFFFF',
  },
  cardDescription: {
    fontSize: 14,
    color: '#35528E',
  },
  cardDescriptionSelected: {
    color: '#E3ECFF',
  },
});
