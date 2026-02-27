import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const RESOURCES = [
  {
    id: '988',
    title: '988 Suicide & Crisis Lifeline',
    subtitle: 'US – Call or text 988',
    url: 'tel:988',
    icon: 'phone' as const,
  },
  {
    id: 'crisis-text',
    title: 'Crisis Text Line',
    subtitle: 'Text HOME to 741741',
    url: 'sms:741741',
    icon: 'message' as const,
  },
  {
    id: 'samhsa',
    title: 'SAMHSA National Helpline',
    subtitle: '1-800-662-4357',
    url: 'tel:18006624357',
    icon: 'phone' as const,
  },
  {
    id: 'kids-helpline',
    title: 'Kids Helpline',
    subtitle: 'Australia – 1800 55 1800',
    url: 'tel:1800551800',
    icon: 'phone' as const,
  },
];

const GROUNDING_TIPS = [
  'Take 5 deep breaths: inhale for 4, hold for 4, exhale for 6.',
  'Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste.',
  'Hold something cold (ice, cold water) or warm (tea, blanket).',
  'Reach out to a trusted friend, family member, or professional.',
];

export default function ResourcesScreen() {
  const handleOpen = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resources</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.disclaimer}>
          You deserve support. Khido is here to listen, but these resources connect you with real people when you need
          them.
        </Text>

        <Text style={styles.sectionTitle}>Crisis & support hotlines</Text>
        {RESOURCES.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={styles.resourceCard}
            onPress={() => handleOpen(r.url)}
            activeOpacity={0.8}>
            <View style={styles.resourceIcon}>
              <MaterialIcons name={r.icon} size={24} color="#14B8A6" />
            </View>
            <View style={styles.resourceText}>
              <Text style={styles.resourceTitle}>{r.title}</Text>
              <Text style={styles.resourceSubtitle}>{r.subtitle}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#94A3B8" />
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>Grounding techniques</Text>
        <View style={styles.tipsCard}>
          {GROUNDING_TIPS.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footerNote}>
          If you&apos;re in immediate danger, please call emergency services (911 in the US) or go to your nearest
          emergency room.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backLabel: {
    fontSize: 17,
    color: '#0F172A',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSpacer: {
    width: 80,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  disclaimer: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resourceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  resourceText: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  resourceSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  tipsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  tipBullet: {
    fontSize: 16,
    color: '#14B8A6',
    marginRight: 8,
    fontWeight: '700',
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  footerNote: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 24,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
