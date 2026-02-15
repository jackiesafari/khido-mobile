/**
 * Navigation Utilities
 * 
 * Centralized navigation helpers for consistent navigation patterns
 * across the app. This makes it easier to:
 * - Update navigation logic in one place
 * - Add analytics or logging
 * - Handle navigation errors consistently
 * - Implement deep linking
 */

import { Href, router } from 'expo-router';
import { Routes } from '@/types/navigation';

/**
 * Navigate to a route with error handling
 */
export function navigateTo(route: Href, params?: Record<string, any>) {
  try {
    if (params) {
      router.push({ pathname: route, params } as Parameters<typeof router.push>[0]);
    } else {
      router.push(route);
    }
  } catch (error) {
    console.error(`Navigation error to ${route}:`, error);
  }
}

/**
 * Navigate back in the navigation stack
 */
export function navigateBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    // Fallback to intro page if can't go back
    router.replace(Routes.INTRO);
  }
}

/**
 * Replace current route (useful for auth flows)
 */
export function replaceRoute(route: Href, params?: Record<string, any>) {
  try {
    if (params) {
      router.replace({ pathname: route, params } as Parameters<typeof router.replace>[0]);
    } else {
      router.replace(route);
    }
  } catch (error) {
    console.error(`Navigation replace error to ${route}:`, error);
  }
}

/**
 * Navigation helpers for specific flows
 */
export const NavigationHelpers = {
  toIntro: () => navigateTo(Routes.INTRO),
  toDashboard: () => navigateTo(Routes.DASHBOARD),
  // Auth navigation (to be implemented)
  // toLogin: () => navigateTo(Routes.LOGIN),
  // toSignup: () => navigateTo(Routes.SIGNUP),
  // toForgotPassword: () => navigateTo(Routes.FORGOT_PASSWORD),
  back: navigateBack,
};






