// styles/theme.ts
// Colores, sombras y estilos globales reutilizables

import { Platform, StyleSheet } from 'react-native';

// ── Paleta de colores ─────────────────────────────────────────────────────────
export const COLORS = {
  // Primary (amber)
  amber: '#F59E0B',
  amberDark: '#D97706',
  amberLight: '#FEF3C7',
  amberBg: '#FFFBEB',

  // Success (green)
  green: '#22C55E',
  greenLight: '#DCFCE7',
  greenBg: '#F0FFF4',
  greenBorder: '#BBF7D0',

  // Error (red)
  red: '#EF4444',
  redLight: '#FEE2E2',

  // Neutrals
  white: '#FFFFFF',
  bg: '#F9FAFB',
  text: '#111827',
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Overlays
  overlay: 'rgba(0,0,0,0.45)',
  overlayLight: 'rgba(0,0,0,0.35)',
  overlaySubtle: 'rgba(0,0,0,0.15)',
} as const;

// ── Breakpoints ───────────────────────────────────────────────────────────────
export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const;

// ── Sombras reutilizables ────────────────────────────────────────────────────
export const SHADOWS = {
  card: Platform.select({
    web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' } as any,
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
  }),
  elevated: Platform.select({
    web: { boxShadow: '0 4px 16px rgba(0,0,0,0.12)' } as any,
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
  }),
  subtle: Platform.select({
    web: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' } as any,
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
  }),
};

// ── Estilos de botones reutilizables ──────────────────────────────────────────
export const BUTTON_STYLES = StyleSheet.create({
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.amber,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  outline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  outlineText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  green: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.green,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  greenText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

// ── Action circle (back, heart, share buttons on images) ──────────────────────
export const ACTION_CIRCLE = StyleSheet.create({
  base: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});

// ── Layout constraints ───────────────────────────────────────────────────────
export const CONTENT_MAX_WIDTH = 900;

export const LAYOUT = StyleSheet.create({
  contentWrapper: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});

// ── Stat card (tour detail) ──────────────────────────────────────────────────
export const STAT_CARD = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
});
