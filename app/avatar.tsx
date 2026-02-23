import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { ThemedView } from '@/components/themed-view';
import { MaterialIcons } from '@expo/vector-icons';
import { Routes } from '@/types/navigation';
import { resetPhase1Session, sendChatMessage, type ChatMessage } from '@/lib/chat-api';

type Message = { role: 'user' | 'avatar'; text: string };

const WELCOME_MESSAGE: Message = {
  role: 'avatar',
  text: "Hi there! I'm Khido, your new friend. I'm here to listen, support you, and help whenever you need it. What's on your mind today?",
};

// Fallback when API is unavailable
function getFallbackResponse(): string {
  return "I'd love to chat, but I'm having trouble connecting right now. Please make sure the API server is running (cd api && npm start) and try again!";
}

/**
 * AvatarScreen - Chat interface with kind, supportive avatar
 *
 * Features:
 * - Back button to return to dashboard
 * - Video avatar (looping)
 * - Conversation with real AI (OpenAI) via API
 * - Resources link for crisis support
 */
export default function AvatarScreen() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const videoRef = useRef<Video>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleBack = () => {
    router.push(Routes.DASHBOARD);
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setMessage('');
    setIsLoading(true);

    try {
      const chatMessages: ChatMessage[] = messages
        .concat([{ role: 'user', text: trimmed }])
        .map((m) => ({ role: m.role, text: m.text }));
      const reply = await sendChatMessage(chatMessages);
      setMessages((prev) => [...prev, { role: 'avatar', text: reply }]);
    } catch {
      const fallback = getFallbackResponse();
      setMessages((prev) => [...prev, { role: 'avatar', text: fallback }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    resetPhase1Session();
  }, []);

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
          {/* Header with Back Button */}
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
              onPress={() => {
                // TODO: Navigate to Resources modal/screen
                console.log('Resources pressed');
              }}
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
                <Video
                  ref={videoRef}
                  source={require('@/assets/images/avatar-video.mp4')}
                  style={styles.video}
                  shouldPlay
                  isLooping
                  isMuted
                  resizeMode={ResizeMode.CONTAIN}
                />
              </View>
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
                <ActivityIndicator size="small" color="#2D2D2D" />
                <Text style={[styles.messageText, styles.avatarMessageText, styles.typingText]}>
                  Khido is thinking...
                </Text>
              </View>
            )}
            </View>

            {/* Quick Prompts */}
            <View style={styles.quickPrompts}>
              <TouchableOpacity
                style={styles.quickPrompt}
                onPress={() => setMessage("I'd like to talk")}
                activeOpacity={0.7}>
                <Text style={styles.quickPromptText}>I&apos;d like to talk</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickPrompt}
                onPress={() => setMessage("I need help advocating")}
                activeOpacity={0.7}>
                <Text style={styles.quickPromptText}>I need help advocating</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickPrompt}
                onPress={() => setMessage("Play a game with me")}
                activeOpacity={0.7}>
                <Text style={styles.quickPromptText}>Play a game with me</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Input Bar */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, isFocused && styles.inputFocused]}
              placeholder="Type a message..."
              placeholderTextColor="#999"
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
                color={message.trim() && !isLoading ? '#FFFFFF' : '#999999'}
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
    marginBottom: 20,
  },
  videoWrapper: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  video: {
    width: '100%',
    height: '100%',
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
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomLeftRadius: 6,
    alignSelf: 'flex-start',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontStyle: 'italic',
    opacity: 0.8,
  },
  userBubble: {
    backgroundColor: 'rgba(45,45,45,0.95)',
    borderBottomRightRadius: 6,
    alignSelf: 'flex-end',
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
    color: '#2D2D2D',
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  quickPromptText: {
    fontSize: 14,
    color: '#2D2D2D',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    paddingTop: 12,
    fontSize: 16,
    color: '#2D2D2D',
    maxHeight: 100,
    minHeight: 48,
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2D2D2D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(45,45,45,0.5)',
  },
});
