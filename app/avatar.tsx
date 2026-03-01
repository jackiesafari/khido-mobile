import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { ThemedView } from '@/components/themed-view';
import { resetPhase1Session, sendChatMessage, fetchTTSAudio, type ChatMessage } from '@/lib/chat-api';
import { markFeatureUsed, recordChatSession } from '@/lib/profile-sync';
import { Routes } from '@/types/navigation';

import {
  API_UNAVAILABLE_FALLBACK,
  AVATAR_TTS_VOICE,
  createWelcomeMessage,
  KEYBOARD_SCROLL_DELAY_MS,
  QUICK_PROMPTS,
  type AvatarChatMessage,
} from './avatar.constants';
import { styles } from './avatar.styles';

export default function AvatarScreen() {
  const insets = useSafeAreaInsets();

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<AvatarChatMessage[]>([createWelcomeMessage()]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const hasRecordedChatSessionRef = useRef(false);
  const hasPlayedWelcomeRef = useRef(false);

  const videoPlayer = useVideoPlayer(require('@/assets/images/avatar-video.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  const scrollToLatest = useCallback((animated = true) => {
    scrollViewRef.current?.scrollToEnd({ animated });
  }, []);

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      scrollToLatest(true);
    });
  }, [scrollToLatest]);

  const playTTS = useCallback(
    async (text: string, opts?: { skipHumanize?: boolean }) => {
      if (!voiceEnabled || !text.trim()) return;

      playerRef.current?.release();
      playerRef.current = null;

      try {
        setIsPlayingVoice(true);
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        });

        const uri = await fetchTTSAudio(text, AVATAR_TTS_VOICE, opts);
        const player = createAudioPlayer(uri);
        playerRef.current = player;
        player.setPlaybackRate(1.0, 'high');
        player.play();

        const onFinish = () => {
          player.removeListener('playbackStatusUpdate', onFinish);
          player.release();
          playerRef.current = null;
          setIsPlayingVoice(false);
        };

        player.addListener('playbackStatusUpdate', (event) => {
          if (event.didJustFinish) onFinish();
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Voice playback failed';
        console.warn('[Khido TTS]', message);
        setIsPlayingVoice(false);
        if (__DEV__) {
          Alert.alert('Voice error', message);
        }
      }
    },
    [voiceEnabled]
  );

  const handleBack = () => {
    playerRef.current?.release();
    playerRef.current = null;
    router.push(Routes.DASHBOARD);
  };

  const handleResources = () => {
    router.push(Routes.RESOURCES);
  };

  const handleQuickPrompt = (prompt: string) => {
    setMessage(prompt);
    focusComposer();
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmedMessage }]);
    setMessage('');
    focusComposer();
    setIsLoading(true);

    try {
      const chatMessages: ChatMessage[] = messages
        .concat([{ role: 'user', text: trimmedMessage }])
        .map((item) => ({ role: item.role, text: item.text }));

      const reply = await sendChatMessage(chatMessages);
      const nextMessages: AvatarChatMessage[] = [...messages, { role: 'user', text: trimmedMessage }, { role: 'avatar', text: reply }];
      setMessages(nextMessages);
      playTTS(reply, { skipHumanize: true });

      if (!hasRecordedChatSessionRef.current) {
        hasRecordedChatSessionRef.current = true;
        void recordChatSession().catch(() => undefined);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'avatar', text: API_UNAVAILABLE_FALLBACK }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    resetPhase1Session();
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
    void markFeatureUsed('avatar').catch(() => undefined);

    return () => {
      playerRef.current?.release();
    };
  }, []);

  useEffect(() => {
    if (hasPlayedWelcomeRef.current || messages.length === 0) return;
    hasPlayedWelcomeRef.current = true;
    void playTTS(messages[0].text, { skipHumanize: true });
  }, [messages, playTTS]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToLatest(true);
    }
  }, [messages, scrollToLatest]);

  useEffect(() => {
    const eventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(eventName, () => {
      setTimeout(() => scrollToLatest(true), KEYBOARD_SCROLL_DELAY_MS);
    });

    return () => sub.remove();
  }, [scrollToLatest]);

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.background} lightColor="#7BAEF9" darkColor="#7BAEF9">
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 6 : 0}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
              <Text style={styles.backLabel}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resourcesButton}
              onPress={handleResources}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialIcons name="help-outline" size={22} color="#FFFFFF" />
              <Text style={styles.resourcesLabel}>Resources</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onContentSizeChange={() => scrollToLatest(true)}>
            <View style={styles.avatarContainer}>
              <View style={styles.videoWrapper}>
                <VideoView style={styles.video} player={videoPlayer} contentFit="contain" />
              </View>
            </View>

            <View style={styles.voiceRow}>
              <TouchableOpacity
                style={[styles.voiceToggle, voiceEnabled && styles.voiceToggleOn]}
                onPress={() => setVoiceEnabled((current) => !current)}
                activeOpacity={0.8}>
                <MaterialIcons name={voiceEnabled ? 'volume-up' : 'volume-off'} size={22} color={voiceEnabled ? '#0F766E' : '#64748B'} />
                <Text style={[styles.voiceLabel, voiceEnabled && styles.voiceLabelOn]}>{voiceEnabled ? 'Voice on' : 'Voice off'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.conversationArea}>
              {messages.map((item, index) => (
                <View
                  key={`${item.role}-${index}`}
                  style={[
                    styles.messageBubble,
                    item.role === 'user' ? styles.userBubble : styles.avatarBubble,
                    index < messages.length - 1 && styles.messageSpacing,
                  ]}>
                  <Text style={[styles.messageText, item.role === 'user' ? styles.userMessageText : styles.avatarMessageText]}>{item.text}</Text>
                </View>
              ))}

              {isLoading && (
                <View style={[styles.messageBubble, styles.avatarBubble, styles.typingBubble]}>
                  <ActivityIndicator size="small" color="#334155" />
                  <Text style={[styles.messageText, styles.avatarMessageText, styles.typingText]}>Khido is thinking...</Text>
                </View>
              )}

              {isPlayingVoice && (
                <View style={[styles.messageBubble, styles.avatarBubble, styles.typingBubble]}>
                  <MaterialIcons name="volume-up" size={16} color="#14B8A6" />
                  <Text style={[styles.messageText, styles.avatarMessageText, styles.typingText]}>Speaking...</Text>
                </View>
              )}
            </View>

            <View style={styles.quickPrompts}>
              {QUICK_PROMPTS.map((prompt) => (
                <TouchableOpacity key={prompt} style={styles.quickPrompt} onPress={() => handleQuickPrompt(prompt)} activeOpacity={0.7}>
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.inputContainer}>
            <View style={[styles.inputShell, isFocused && styles.inputShellFocused]}>
              <TextInput
                ref={inputRef}
                style={[styles.input, isFocused && styles.inputFocused]}
                placeholder="Type a message..."
                placeholderTextColor="#8EA7CF"
                value={message}
                onChangeText={setMessage}
                onFocus={() => {
                  setIsFocused(true);
                  setTimeout(() => scrollToLatest(true), 60);
                }}
                onBlur={() => setIsFocused(false)}
                multiline
                maxLength={500}
                returnKeyType="default"
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, (!message.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!message.trim() || isLoading}
              activeOpacity={0.7}>
              <MaterialIcons name="send" size={22} color={message.trim() && !isLoading ? '#FFFFFF' : '#9DB8D8'} />
            </TouchableOpacity>
          </View>
          <View style={{ height: Math.max(insets.bottom, 8) }} />
        </KeyboardAvoidingView>
      </ThemedView>
    </SafeAreaView>
  );
}
