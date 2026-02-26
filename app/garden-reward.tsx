import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { logGardenEvent } from '@/lib/garden-analytics';
import { Routes } from '@/types/navigation';

type RewardSource = {
  key: string;
  kind: 'stream' | 'youtube';
  title: string;
  uri: string;
};

const DEFAULT_STREAMING_REWARDS: RewardSource[] = [
  { key: 'stream-fallback-forest-waterfall', kind: 'stream', title: 'Forest Waterfall', uri: 'https://videos.pexels.com/video-files/854426/854426-hd_1920_1080_25fps.mp4' },
  { key: 'stream-fallback-mountain-lake', kind: 'stream', title: 'Mountain Lake Calm', uri: 'https://videos.pexels.com/video-files/3129977/3129977-hd_1920_1080_25fps.mp4' },
];

const DEFAULT_YOUTUBE_REWARDS: RewardSource[] = [
  { key: 'yt-waterfall-rainbow', kind: 'youtube', title: 'Waterfall + Rainbow', uri: 'https://www.youtube.com/watch?v=IS7Gn3id3us' },
  { key: 'yt-nature-calm', kind: 'youtube', title: 'Calm Nature Video', uri: 'https://www.youtube.com/watch?v=eKFTSSKCzWA' },
];

const FALLBACK_LOCAL_REWARD = require('@/assets/images/avatar-video.mp4');
let lastRewardKey: string | null = null;

type ExtraConfig = {
  supabaseUrl?: string | null;
  rewardVideoPaths?: string[];
  rewardYoutubeUrls?: string[];
};

function normalizeSupabasePublicUrl(baseUrl: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = pathOrUrl.replace(/^\//, '');
  return `${normalizedBase}/storage/v1/object/public/${normalizedPath}`;
}

function uniqueByKey(items: RewardSource[]): RewardSource[] {
  const seen = new Set<string>();
  const out: RewardSource[] = [];
  for (const item of items) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}

function buildConfiguredRewards(): { streams: RewardSource[]; youtubes: RewardSource[] } {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
  const supabaseUrl = extra.supabaseUrl ?? '';
  const configuredStreamPaths = Array.isArray(extra.rewardVideoPaths) ? extra.rewardVideoPaths : [];
  const configuredYoutubeUrls = Array.isArray(extra.rewardYoutubeUrls) ? extra.rewardYoutubeUrls : [];

  const configuredStreams: RewardSource[] = [];
  configuredStreamPaths.forEach((path, idx) => {
    if (!path) return;
    const uri = supabaseUrl ? normalizeSupabasePublicUrl(supabaseUrl, path) : path;
    configuredStreams.push({
      key: `stream-config-${idx}-${path}`,
      kind: 'stream',
      title: `Conservation Reward ${idx + 1}`,
      uri,
    });
  });

  const configuredYoutubes: RewardSource[] = [];
  configuredYoutubeUrls.forEach((uri, idx) => {
    if (!uri) return;
    configuredYoutubes.push({
      key: `youtube-config-${idx}-${uri}`,
      kind: 'youtube',
      title: `Nature Story ${idx + 1}`,
      uri,
    });
  });

  const streams = uniqueByKey([...configuredStreams, ...DEFAULT_STREAMING_REWARDS]);
  const youtubes = uniqueByKey([...configuredYoutubes, ...DEFAULT_YOUTUBE_REWARDS]);

  return { streams, youtubes };
}

function chooseNonRepeating(candidates: RewardSource[]): RewardSource {
  if (candidates.length === 0) {
    return DEFAULT_STREAMING_REWARDS[0];
  }
  if (candidates.length === 1) {
    lastRewardKey = candidates[0].key;
    return candidates[0];
  }

  let selected = candidates[Math.floor(Math.random() * candidates.length)];
  let guard = 0;
  while (selected.key === lastRewardKey && guard < 12) {
    selected = candidates[Math.floor(Math.random() * candidates.length)];
    guard += 1;
  }
  lastRewardKey = selected.key;
  return selected;
}

export default function GardenRewardScreen() {
  const videoRef = useRef<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [didFinish, setDidFinish] = useState(false);
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);
  const [hasTriedYoutubeFallback, setHasTriedYoutubeFallback] = useState(false);
  const affirmationOpacity = useRef(new Animated.Value(0)).current;

  const rewardPools = useMemo(() => buildConfiguredRewards(), []);
  const selectedStream = useMemo(() => chooseNonRepeating(rewardPools.streams), [rewardPools.streams]);
  const backupYoutube = useMemo(() => chooseNonRepeating(rewardPools.youtubes), [rewardPools.youtubes]);
  const affirmation = useMemo(() => {
    const base = [
      'Take this moment in.',
      'You made space for yourself.',
      'You stayed with the journey.',
      'Breathe. You have arrived.',
      'You chose yourself today.',
      'Growth happens step by step.',
      'Rest here for a while.',
      'You honored yourself.',
      'You followed your path.',
      'This moment is yours.',
    ];

    const lowerTitle = selectedStream.title.toLowerCase();
    if (lowerTitle.includes('waterfall') || lowerTitle.includes('river')) {
      base.push('Let the water carry the noise away.');
      base.push('You are allowed to flow at your own pace.');
    }
    if (lowerTitle.includes('forest') || lowerTitle.includes('woodland')) {
      base.push('Quiet growth is still growth.');
      base.push('You are grounded, steady, and safe.');
    }
    const nextIndex = Math.floor(Math.random() * base.length);
    return base[nextIndex];
  }, [selectedStream.title]);

  const animateAffirmation = useCallback(() => {
    Animated.sequence([
      Animated.timing(affirmationOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(affirmationOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [affirmationOpacity]);

  useEffect(() => {
    animateAffirmation();
  }, [animateAffirmation]);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsLoading(false);
    if (status.didJustFinish) {
      setDidFinish(true);
      logGardenEvent({
        sessionSeed: 0,
        levelId: 14,
        eventType: 'tile_tap_pattern',
        payload: { source: 'reward_video_finished', rewardKey: selectedStream.key },
      });
    }
  };

  const handleStreamError = () => {
    if (usingLocalFallback) return;
    setUsingLocalFallback(true);
    setIsLoading(true);
    logGardenEvent({
      sessionSeed: 0,
      levelId: 14,
      eventType: 'tile_tap_pattern',
      payload: {
        source: 'reward_video_fallback_local',
        failedStreamKey: selectedStream.key,
      },
    });
  };

  const openYoutubeBackup = async () => {
    if (hasTriedYoutubeFallback) return;
    try {
      setHasTriedYoutubeFallback(true);
      await openBrowserAsync(backupYoutube.uri, {
        presentationStyle: WebBrowserPresentationStyle.FULL_SCREEN,
      });
      setDidFinish(true);
      logGardenEvent({
        sessionSeed: 0,
        levelId: 14,
        eventType: 'tile_tap_pattern',
        payload: {
          source: 'reward_video_opened_youtube',
          youtubeKey: backupYoutube.key,
          youtubeUrl: backupYoutube.uri,
        },
      });
    } finally {
      // Keep hidden fallback silent.
    }
  };

  const handleLocalVideoError = () => {
    openYoutubeBackup().catch(() => undefined);
  };

  const handleContinue = () => {
    router.replace(Routes.GAMES);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.background} lightColor="#0B1C2C" darkColor="#0B1C2C">
        <View style={styles.videoWrap}>
          <Video
            ref={videoRef}
            source={usingLocalFallback ? FALLBACK_LOCAL_REWARD : { uri: selectedStream.uri }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping={false}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            onError={usingLocalFallback ? handleLocalVideoError : handleStreamError}
          />
          <View style={styles.affirmationWrap} pointerEvents="none">
            <Animated.View style={[styles.affirmationCloud, { opacity: affirmationOpacity }]}>
              <View style={styles.affirmationFogLayer} />
              <View style={styles.affirmationTextWrap}>
                <Text style={styles.affirmationText}>{affirmation}</Text>
              </View>
            </Animated.View>
          </View>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingText}>
                {usingLocalFallback ? 'Loading offline reward video...' : 'Loading your reward video...'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.title}>Great job finishing all 14 levels</Text>
          <Text style={styles.subtitle}>
            {usingLocalFallback
              ? 'Network unavailable: playing local fallback.'
              : selectedStream.title}
          </Text>

          {didFinish ? (
            <TouchableOpacity style={styles.continueButton} activeOpacity={0.8} onPress={handleContinue}>
              <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.waitingWrap}>
              <MaterialIcons name="hourglass-top" size={18} color="#D8E8FF" />
              <Text style={styles.waitingText}>Continue unlocks after video ends (or after YouTube returns)</Text>
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
    backgroundColor: '#0B1C2C',
  },
  background: {
    flex: 1,
    justifyContent: 'space-between',
  },
  videoWrap: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  affirmationWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  affirmationCloud: {
    width: '96%',
    maxWidth: 460,
    minHeight: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: 'rgba(9, 24, 37, 0.24)',
    shadowColor: '#061423',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  affirmationFogLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 25, 40, 0.22)',
    borderRadius: 36,
  },
  affirmationTextWrap: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  affirmationText: {
    color: '#F5FBFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: '#12283D',
    borderTopWidth: 1,
    borderTopColor: '#2A4562',
    gap: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#C8DCF5',
    fontSize: 14,
  },
  continueButton: {
    marginTop: 4,
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  waitingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waitingText: {
    color: '#D8E8FF',
    fontSize: 13,
    fontWeight: '600',
  },
});
