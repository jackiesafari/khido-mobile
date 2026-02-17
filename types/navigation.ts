/**
 * Navigation Types
 * 
 * Centralized type definitions for navigation routes.
 * This helps maintain type safety as the app grows.
 * 
 * Usage:
 * - Import these types when defining navigation params
 * - Update this file when adding new routes
 * - Use with expo-router's typed navigation
 */

export type RootStackParamList = {
  index: undefined;
  intropage: undefined;
  auth: undefined;
  dashboard: undefined;
  avatar: undefined;
  // Auth routes (to be implemented)
  // 'auth/signup': undefined;
  // 'auth/forgot-password': undefined;
};

/**
 * Navigation route names
 * Use these constants instead of string literals for better maintainability
 */
export const Routes = {
  INDEX: '/',
  INTRO: '/intropage',
  AUTH: '/auth',
  DASHBOARD: '/dashboard',
  AVATAR: '/avatar',
  // Auth routes (to be implemented)
  // SIGNUP: '/auth/signup',
} as const;

