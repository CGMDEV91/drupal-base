// components/tour/CompletionPopup.tsx
// Modal shown when a tour is completed

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StarRating } from './StarRating';

const AMBER = '#F59E0B';
const CONFETTI_COLORS = [
  '#F59E0B', '#22C55E', '#3B82F6', '#EF4444',
  '#8B5CF6', '#FCD34D', '#EC4899', '#14B8A6',
  '#F97316', '#06B6D4', '#84CC16', '#A855F7',
];
// Increased particle count for richer visual effect
const CONFETTI_COUNT = 100;
// Avoid useNativeDriver on web — transforms via JS thread are fine there
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// ---------------------------------------------------------------------------
// CSS confetti for web — injected once into <head>, rendered via DOM
// ---------------------------------------------------------------------------

const CSS_STYLE_ID = 'stepuptours-confetti-styles';
const CONFETTI_HOST_ID = 'stepuptours-confetti-host';

function injectConfettiCSS(): void {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  if (document.getElementById(CSS_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = CSS_STYLE_ID;
  style.textContent = `
    @keyframes confettiFall {
      0%   { transform: translateY(-20px) rotate(0deg);    opacity: 1; }
      100% { transform: translateY(110vh)  rotate(720deg); opacity: 0; }
    }
    @keyframes confettiSway {
      0%,  100% { margin-left: 0;    }
      25%        { margin-left: 15px; }
      75%        { margin-left: -15px;}
    }
    .confetti-piece {
      position: fixed;
      top: -10px;
      pointer-events: none;
      z-index: 9999;
      animation: confettiFall linear forwards, confettiSway ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

function mountWebConfetti(screenWidth: number): () => void {
  if (typeof document === 'undefined') return () => {};

  injectConfettiCSS();

  // Remove any previous instance so re-opening the modal re-triggers animation.
  const existing = document.getElementById(CONFETTI_HOST_ID);
  if (existing) existing.remove();

  const host = document.createElement('div');
  host.id = CONFETTI_HOST_ID;
  host.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:visible;';

  const pieces: string[] = [];
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const left = (Math.random() * screenWidth).toFixed(1);
    const size = 4 + Math.random() * 14;
    const width = size.toFixed(1);
    const height = (Math.random() < 0.4 ? size * 1.8 : size).toFixed(1);
    const borderRadius = Math.random() < 0.3 ? '50%' : '2px';
    const fallDuration = (1.8 + Math.random() * 2.2).toFixed(2);
    const swayDuration = (1.5 + Math.random() * 1.5).toFixed(2);
    const delay = (i * 0.018).toFixed(3);

    pieces.push(
      `<div class="confetti-piece" style="` +
        `left:${left}px;` +
        `width:${width}px;` +
        `height:${height}px;` +
        `background:${color};` +
        `border-radius:${borderRadius};` +
        `animation-duration:${fallDuration}s,${swayDuration}s;` +
        `animation-delay:${delay}s,${delay}s;` +
      `"></div>`
    );
  }

  host.innerHTML = pieces.join('');
  document.body.appendChild(host);

  // Auto-remove after max fall duration (~4s) + max delay (~1.8s) + buffer.
  const timer = setTimeout(() => {
    const el = document.getElementById(CONFETTI_HOST_ID);
    if (el) el.remove();
  }, 6200);

  return () => {
    clearTimeout(timer);
    const el = document.getElementById(CONFETTI_HOST_ID);
    if (el) el.remove();
  };
}

// ---------------------------------------------------------------------------
// WebConfetti component — mounts DOM confetti when visible, tears down on hide
// ---------------------------------------------------------------------------

interface WebConfettiProps {
  screenWidth: number;
}

function WebConfetti({ screenWidth }: WebConfettiProps) {
  useEffect(() => {
    const cleanup = mountWebConfetti(screenWidth);
    return cleanup;
  }, [screenWidth]);

  // No RN nodes needed — everything lives in the DOM layer.
  return null;
}

// ---------------------------------------------------------------------------
// Shape types for visual variety (native only)
// ---------------------------------------------------------------------------

type ConfettiShape = 'square' | 'rect' | 'circle' | 'thin';

function pickShape(): ConfettiShape {
  const r = Math.random();
  if (r < 0.3) return 'circle';
  if (r < 0.55) return 'rect';
  if (r < 0.75) return 'thin';
  return 'square';
}

function shapeStyle(shape: ConfettiShape, size: number) {
  switch (shape) {
    case 'circle':
      return { width: size, height: size, borderRadius: size / 2 };
    case 'rect':
      return { width: size * 0.7, height: size * 1.8, borderRadius: 2 };
    case 'thin':
      return { width: size * 0.4, height: size * 2.2, borderRadius: 1 };
    case 'square':
    default:
      return { width: size, height: size, borderRadius: 2 };
  }
}

// ---------------------------------------------------------------------------
// ConfettiPiece — a single animated falling particle (native only)
// ---------------------------------------------------------------------------

interface ConfettiPieceProps {
  delay: number;
  screenWidth: number;
  screenHeight: number;
}

function ConfettiPiece({ delay, screenWidth, screenHeight }: ConfettiPieceProps) {
  const animValue = useRef(new Animated.Value(0)).current;

  const x = useRef(Math.random() * screenWidth).current;
  // Varied sizes: small (4-8), medium (8-14), occasional large (14-18)
  const rawSize = useRef(Math.random()).current;
  const size = useRef(rawSize < 0.6 ? 4 + rawSize * 13 : 4 + rawSize * 20).current;
  const color = useRef(CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]).current;
  // Wider horizontal drift range for a more dispersed look
  const drift = useRef((Math.random() - 0.5) * 180).current;
  const shape = useRef(pickShape()).current;
  const endRotation = useRef(`${Math.random() * 900 - 450}deg`).current;
  // Wider duration spread — some pieces fall faster, others lazily
  const duration = useRef(1800 + Math.random() * 2200).current;
  // Initial vertical spread so not all pieces start at exactly y=0
  const startY = useRef(-(Math.random() * 60)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, []);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [startY, screenHeight + 60],
  });
  const translateX = animValue.interpolate({
    inputRange: [0, 0.4, 0.7, 1],
    outputRange: [0, drift * 0.4, drift * 0.8, drift],
  });
  const opacity = animValue.interpolate({
    inputRange: [0, 0.05, 0.75, 1],
    outputRange: [0, 1, 0.85, 0],
  });
  const rotate = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', endRotation],
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x,
          top: 0,
          backgroundColor: color,
          ...shapeStyle(shape, size),
        },
        { opacity, transform: [{ translateY }, { translateX }, { rotate }] },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// CompletionPopup
// ---------------------------------------------------------------------------

interface CompletionPopupProps {
  visible: boolean;
  tourName: string;
  xp: number;
  isFirstCompletion: boolean;
  onRate: (rating: number) => void;
  onDonate: (amount: number) => void;
  onClose: () => void;
  langcode: string;
}

export function CompletionPopup({
  visible,
  tourName,
  xp,
  isFirstCompletion,
  onRate,
  onDonate,
  onClose,
  langcode,
}: CompletionPopupProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [donationAmount, setDonationAmount] = useState('1');
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const isMobile = screenWidth < 640;

  const handleRate = (value: number) => {
    setRating(value);
    onRate(value);
  };

  const handleDonate = () => {
    const amount = parseFloat(donationAmount);
    if (!isNaN(amount) && amount > 0) {
      onDonate(amount);
    }
  };

  const parsedAmount = parseFloat(donationAmount);
  const isDonationValid = !isNaN(parsedAmount) && parsedAmount > 0;

  // Card style: mobile sticks to bottom with maxHeight, desktop centers as a box
  const cardStyle = isMobile
    ? {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }
    : {
        maxWidth: 420,
        width: '100%' as const,
        borderRadius: 24,
      };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/*
        Root fills the entire screen so confetti has full canvas.
        Confetti layer stays behind the card via z-index layering.
      */}
      <View style={styles.root}>
        {/* Backdrop tint — sits behind everything */}
        <View style={styles.backdropTint} />

        {/*
          Confetti:
          - Web: CSS keyframe divs appended to document.body (escapes Modal stacking context,
            fully visible over the viewport). WebConfetti returns null from the RN tree.
          - Native: React Native Animated particles rendered inside the Modal root View.
        */}
        {isFirstCompletion && visible && (
          Platform.OS === 'web'
            ? <WebConfetti screenWidth={screenWidth} />
            : (
              <View
                style={[StyleSheet.absoluteFill, styles.confettiLayer]}
                pointerEvents="none"
              >
                {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
                  <ConfettiPiece
                    key={i}
                    delay={i * 18}
                    screenWidth={screenWidth}
                    screenHeight={screenHeight}
                  />
                ))}
              </View>
            )
        )}

        {/* Card container — aligns to bottom on mobile, centers on desktop */}
        <View
          style={[
            styles.cardWrapper,
            isMobile ? styles.cardWrapperMobile : styles.cardWrapperDesktop,
          ]}
          pointerEvents="box-none"
        >
          {/*
            Outer shell provides the constrained height + border radius on mobile.
            On mobile: maxHeight 85% + flex-end keeps the sheet pinned to bottom.
            On desktop: the card itself handles sizing.
          */}
          <View
            style={[
              styles.cardShell,
              isMobile ? styles.cardShellMobile : styles.cardShellDesktop,
              cardStyle,
            ]}
          >
            {/* Close button — zIndex 10 so always accessible above scroll */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <View style={styles.closeBtnInner}>
                <Ionicons name="close" size={18} color="#6B7280" />
              </View>
            </TouchableOpacity>

            {/* ScrollView allows content to scroll on small screens */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Party icon circle — only on first completion */}
              {isFirstCompletion && (
                <View style={styles.iconCircle}>
                  <Text style={styles.iconEmoji}>🎉</Text>
                </View>
              )}

              {/* Title */}
              <Text style={styles.title}>
                {isFirstCompletion
                  ? t('popup.congratulations')
                  : t('popup.alreadyCompleted')}
              </Text>

              {/* Subtitle */}
              <Text style={styles.subtitle}>
                {t('popup.completedTourOf')}{' '}
                <Text style={styles.subtitleBold}>{tourName}</Text>
              </Text>

              {/* XP badge — first completion only */}
              {isFirstCompletion && xp > 0 && (
                <View style={styles.xpBadge}>
                  <Ionicons name="flash" size={15} color={AMBER} />
                  <Text style={styles.xpText}>+{xp} XP</Text>
                </View>
              )}

              {/* Star rating — first completion only */}
              {isFirstCompletion && (
                <View style={styles.ratingSection}>
                  <Text style={styles.ratingPrompt}>
                    {'\u2728'} {t('popup.rateExperience')}
                  </Text>
                  <StarRating
                    value={rating}
                    interactive
                    onRate={handleRate}
                    size={32}
                  />
                </View>
              )}

              {/* Divider */}
              <View style={styles.divider} />

              {/* Donation section */}
              <View style={styles.donationSection}>
                <Text style={styles.donationLabel}>{t('popup.donateLabel')}</Text>
                <View style={styles.donationInputRow}>
                  <Text style={styles.currencySymbol}>€</Text>
                  <TextInput
                    style={styles.donationInput}
                    value={donationAmount}
                    onChangeText={setDonationAmount}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity
                    style={[
                      styles.donateInlineBtn,
                      !isDonationValid && styles.donateButtonDisabled,
                    ]}
                    onPress={handleDonate}
                    activeOpacity={0.8}
                    disabled={!isDonationValid}
                  >
                    <Ionicons name="heart" size={14} color="#FFFFFF" />
                    <Text style={styles.donateInlineBtnText}>{t('popup.donate')}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Go home button */}
              <TouchableOpacity
                style={styles.homeButton}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.homeButtonText}>{t('popup.goHome')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Full-screen root — contains all layers
  root: {
    flex: 1,
  },

  // Semi-transparent backdrop
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },

  // Confetti sits above backdrop (zIndex 1) but below card (zIndex 2) — native only
  confettiLayer: {
    zIndex: 1,
  },

  // Card wrapper fills screen; on mobile it aligns to bottom, on desktop it centers
  cardWrapper: {
    flex: 1,
    zIndex: 2,
  },
  cardWrapperMobile: {
    justifyContent: 'flex-end',
  },
  cardWrapperDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Card shell: provides overflow clipping and height constraints
  cardShell: {
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
  },
  cardShellMobile: {
    // Constrain to 85% of screen height so it never covers the full screen
    maxHeight: '85%',
  },
  cardShellDesktop: {
    // Desktop uses natural height up to the viewport via the wrapper padding
    maxHeight: '90%',
  },

  // Close button — absolute-positioned above the ScrollView
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  closeBtnInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ScrollView fills the card shell
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },

  // Icon circle
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AMBER,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    // Subtle glow
    shadowColor: AMBER,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  iconEmoji: {
    fontSize: 38,
  },

  // Title & subtitle
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  subtitleBold: {
    fontWeight: '700',
    color: '#111827',
  },

  // XP badge — centered, clear bottom margin
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 8,
  },
  xpText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#D97706',
  },

  // Rating — extra vertical breathing room
  ratingSection: {
    alignItems: 'center',
    gap: 10,
    marginVertical: 12,
    width: '100%',
  },
  ratingPrompt: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Divider — clear vertical margin on both sides
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 16,
  },

  // Donation section
  donationSection: {
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  donationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Fixed height row with centered children and rounded border
  donationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  currencySymbol: {
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    // Full height fill inside the 48px row
    height: '100%',
    textAlignVertical: 'center',
    lineHeight: 48,
  },
  donationInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    height: '100%',
  },
  donateInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: AMBER,
    gap: 6,
    height: '100%',
  },
  donateInlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  donateButtonDisabled: {
    opacity: 0.45,
  },

  // Home button
  homeButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: AMBER,
    marginBottom: 16,
    shadowColor: AMBER,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
