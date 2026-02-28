import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  Text,
  Platform,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { ThemedView } from '@/components/themed-view';
import { MaterialIcons } from '@expo/vector-icons';
import { Routes } from '@/types/navigation';
import { resetPhase1Session, sendChatMessage, fetchTTSAudio, type ChatMessage, type TTSVoice } from '@/lib/chat-api';
import { getProfileSnapshot } from '@/lib/profile-store';

type Message = { role: 'user' | 'avatar'; text: string };

const WELCOME_MESSAGES = [
  "Oh hey! So glad you're here. I'm Khido! Think of me as your available friend. So... how are you actually doing today?",
  "Hi there! I'm Khido, hoping to bring you some good vibes today. You can talk to me about anything. What's going on in your world today?",
  "Oh hey, you showed up! That already took courage. I'm Khido. I'm here for you, no judgment, just good energy. How's your heart feeling today?",
  "Hello, friend! I'm Khido. Tell me, how are you really doing? I actually want to know.",
];

function buildWelcomeMessage(): Message {
  const idx = Math.floor(Math.random() * WELCOME_MESSAGES.length);
  return { role: 'avatar', text: WELCOME_MESSAGES[idx] };
}

function getQuickPrompts(): string[] {
  return ['Help advocate for me', 'I need to vent', 'Guide me with breathing'];
}

// Fallback when API is unavailable
function getFallbackResponse(): string {
  return "I'd love to chat, but I'm having trouble connecting right now. Please make sure the API server is running (cd api && npm start) and try again!";
}

/**
 * AvatarScreen - Chat interface with kind, supportive avatar
 *
 * Features:
 * - Back button to return to dashboard
 * - Video avatar (snow leopard)
 * - Conversation with real AI (OpenAI) via API
 * - Optional voice (TTS) for avatar messages
 * - Resources link for crisis support
 * - Calming UI
 */
export default function AvatarScreen() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([buildWelcomeMessage()]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const VOICE = 'shimmer' as TTSVoice;
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [quickPrompts] = useState<string[]>(getQuickPrompts());
  const scrollViewRef = useRef<ScrollView>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  const videoPlayer = useVideoPlayer(
    require('@/assets/images/avatar-video.mp4'),
    (player) => {
      player.loop = true;
      player.muted = true;
      player.play();
    }
  );

  const playTTS = useCallback(async (text: string, opts?: { skipHumanize?: boolean }) => {
    if (!voiceEnabled || !text.trim()) return;
    playerRef.current?.release();
    playerRef.current = null;
    try {
      setIsPlayingVoice(true);
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
      const uri = await fetchTTSAudio(text, VOICE, opts);
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
      player.addListener('playbackStatusUpdate', (e) => {
        if (e.didJustFinish) onFinish();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Voice playback failed';
      console.warn('[Khido TTS]', msg);
      setIsPlayingVoice(false);
      if (__DEV__) {
        Alert.alert('Voice error', msg);
      }
    }
  }, [voiceEnabled]);

  const handleBack = () => {
    playerRef.current?.release();
    playerRef.current = null;
    router.push(Routes.DASHBOARD);
  };

  const handleResources = () => {
    router.push(Routes.RESOURCES);
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setMessage('');
    setIsLoading(true);

    try {
      const chatMessages: ChatMessage[] = messages
        .concat([{ role: 'user', text: trimmed }])
        .map((m) => ({ role: m.role, text: m.text }));
      const reply = await sendChatMessage(chatMessages);
      const newMessages: Message[] = [...messages, { role: 'user', text: trimmed }, { role: 'avatar', text: reply }];
      setMessages(newMessages);
      playTTS(reply, { skipHumanize: true });
    } catch {
      const fallback = getFallbackResponse();
      setMessages((prev) => [...prev, { role: 'avatar', text: fallback }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setMessage(prompt);
  };

  useEffect(() => {
    resetPhase1Session();
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    return () => {
      playerRef.current?.release();
    };
  }, []);

  const hasPlayedWelcome = useRef(false);
  useEffect(() => {
    if (hasPlayedWelcome.current || messages.length === 0) return;
    hasPlayedWelcome.current = true;
    playTTS(messages[0].text, { skipHumanize: true });
  }, [playTTS, messages]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.background} lightColor="#7BAEF9" darkColor="#7BAEF9">
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
          {/* Header */}
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
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
            {/* Video Avatar */}
            <View style={styles.avatarContainer}>
              <View style={styles.videoWrapper}>
                <VideoView style={styles.video} player={videoPlayer} contentFit="contain" />
              </View>
            </View>

            {/* Voice toggle */}
            <View style={styles.voiceRow}>
              <TouchableOpacity
                style={[styles.voiceToggle, voiceEnabled && styles.voiceToggleOn]}
                onPress={() => setVoiceEnabled((v) => !v)}
                activeOpacity={0.8}>
                <MaterialIcons name={voiceEnabled ? 'volume-up' : 'volume-off'} size={22} color={voiceEnabled ? '#0F766E' : '#64748B'} />
                <Text style={[styles.voiceLabel, voiceEnabled && styles.voiceLabelOn]}>
                  {voiceEnabled ? 'Voice on' : 'Voice off'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Conversation Area */}
            <View style={styles.conversationArea}>
              {messages.map((msg, i) => (
                <View
                  key={i}
                  style={[
                    styles.messageBubble,
                    msg.role === 'user' ? styles.userBubble : styles.avatarBubble,
                    i < messages.length - 1 && styles.messageSpacing,
                  ]}>
                  <Text
                    style={[
                      styles.messageText,
                      msg.role === 'user' ? styles.userMessageText : styles.avatarMessageText,
                    ]}>
                    {msg.text}
                  </Text>
                </View>
              ))}
              {isLoading && (
                <View style={[styles.messageBubble, styles.avatarBubble, styles.typingBubble]}>
                  <ActivityIndicator size="small" color="#334155" />
                  <Text style={[styles.messageText, styles.avatarMessageText, styles.typingText]}>
                    Khido is thinking...
                  </Text>
                </View>
              )}
              {isPlayingVoice && (
                <View style={[styles.messageBubble, styles.avatarBubble, styles.typingBubble]}>
                  <MaterialIcons name="volume-up" size={16} color="#14B8A6" />
                  <Text style={[styles.messageText, styles.avatarMessageText, styles.typingText]}>
                    Speaking...
                  </Text>
                </View>
              )}
            </View>

            {/* Quick Prompts */}
            <View style={styles.quickPrompts}>
              {quickPrompts.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  style={styles.quickPrompt}
                  onPress={() => handleQuickPrompt(prompt)}
                  activeOpacity={0.7}>
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Input Bar */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, isFocused && styles.inputFocused]}
              placeholder="Type a message..."
              placeholderTextColor="#94A3B8"
              value={message}
              onChangeText={setMessage}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              multiline
              maxLength={500}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!message.trim() || isLoading) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!message.trim() || isLoading}
              activeOpacity={0.7}>
              <MaterialIcons
                name="send"
                size={22}
                color={message.trim() && !isLoading ? '#FFFFFF' : '#64748B'}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backLabel: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  resourcesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resourcesLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  videoWrapper: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 3,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
    justifyContent: 'center',
  },
  voiceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  voiceToggleOn: {
    borderColor: '#14B8A6',
    backgroundColor: 'rgba(20, 184, 166, 0.25)',
  },
  voiceLabel: {
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  voiceLabelOn: {
    color: '#0F766E',
  },
  conversationArea: {
    marginBottom: 16,
  },
  messageSpacing: {
    marginBottom: 12,
  },
  messageBubble: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxWidth: '85%',
  },
  avatarBubble: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderBottomLeftRadius: 6,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontStyle: 'italic',
    opacity: 0.85,
  },
  userBubble: {
    backgroundColor: 'rgba(29, 78, 216, 0.9)',
    borderBottomRightRadius: 6,
    alignSelf: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    ...Platform.select({
      ios: { fontFamily: 'system', fontWeight: '400' },
      android: { fontFamily: 'sans-serif', fontWeight: '400' },
      default: { fontFamily: 'system', fontWeight: '400' },
    }),
  },
  avatarMessageText: {
    color: '#1E293B',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  quickPrompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickPrompt: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  quickPromptText: {
    fontSize: 14,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    gap: 12,
    backgroundColor: 'transparent',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    paddingTop: 12,
    fontSize: 16,
    color: '#1E293B',
    maxHeight: 100,
    minHeight: 48,
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: 'rgba(20, 184, 166, 0.5)',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#14B8A6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(20, 184, 166, 0.4)',
  },
});
