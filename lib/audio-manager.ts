import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Returns the audio directory path if available, null otherwise.
 */
export function getAudioDirectory(): string | null {
  if (Platform.OS === 'web') return null;
  const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!baseDir || baseDir.trim().length === 0) return null;
  return `${baseDir}audio/`;
}

/**
 * Ensures the audio directory exists. Call once on app startup.
 * Fixes "no storage directory for audio" by creating the directory before any TTS playback.
 */
export async function ensureAudioDirectory(): Promise<void> {
  const audioDir = getAudioDirectory();
  if (!audioDir) return;

  const dirInfo = await FileSystem.getInfoAsync(audioDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
    if (__DEV__) {
      console.log('[Khido] Audio directory created:', audioDir);
    }
  }
}

/**
 * Clears cached TTS audio files to free storage.
 */
export async function clearAudioCache(): Promise<void> {
  const audioDir = getAudioDirectory();
  if (!audioDir) return;
  try {
    await FileSystem.deleteAsync(audioDir, { idempotent: true });
    if (__DEV__) {
      console.log('[Khido] Audio cache cleared');
    }
  } catch {
    // Ignore
  }
}
