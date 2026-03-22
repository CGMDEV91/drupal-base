// components/tour/CompletionPopup.tsx
// Modal shown when a tour is completed — compact card + separate DonationModal

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StarRating } from './StarRating';
import { createDonationIntent, activateDonation } from '../../services/payment.service';
import { getStripePromise } from '../../lib/stripe';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const AMBER = '#F59E0B';
const CONFETTI_COLORS = [
  '#F59E0B', '#22C55E', '#3B82F6', '#EF4444',
  '#8B5CF6', '#FCD34D', '#EC4899', '#14B8A6',
  '#F97316', '#06B6D4', '#84CC16', '#A855F7',
];
const CONFETTI_COUNT = 100;
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
// WebConfetti — mounts DOM confetti, returns null from RN tree
// ---------------------------------------------------------------------------

function WebConfetti({ screenWidth }: { screenWidth: number }) {
  useEffect(() => {
    const cleanup = mountWebConfetti(screenWidth);
    return cleanup;
  }, [screenWidth]);
  return null;
}

// ---------------------------------------------------------------------------
// Native confetti particles
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
    case 'circle': return { width: size, height: size, borderRadius: size / 2 };
    case 'rect': return { width: size * 0.7, height: size * 1.8, borderRadius: 2 };
    case 'thin': return { width: size * 0.4, height: size * 2.2, borderRadius: 1 };
    case 'square':
    default: return { width: size, height: size, borderRadius: 2 };
  }
}

function ConfettiPiece({
  delay,
  screenWidth,
  screenHeight,
}: {
  delay: number;
  screenWidth: number;
  screenHeight: number;
}) {
  const animValue = useRef(new Animated.Value(0)).current;
  const x = useRef(Math.random() * screenWidth).current;
  const rawSize = useRef(Math.random()).current;
  const size = useRef(rawSize < 0.6 ? 4 + rawSize * 13 : 4 + rawSize * 20).current;
  const color = useRef(CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]).current;
  const drift = useRef((Math.random() - 0.5) * 180).current;
  const shape = useRef(pickShape()).current;
  const endRotation = useRef(`${Math.random() * 900 - 450}deg`).current;
  const duration = useRef(1800 + Math.random() * 2200).current;
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
// DonationCheckout — Stripe form (web) or simple form (native)
// ---------------------------------------------------------------------------

interface DonationCheckoutProps {
  tourId: string;
  amount: string;
  onAmountChange: (v: string) => void;
  isDonationValid: boolean;
  onSuccess: (amount: number) => void;
  t: (key: string) => string;
}

function DonationCheckout(props: DonationCheckoutProps) {
  if (Platform.OS !== 'web') {
    return <NativeDonationForm {...props} />;
  }
  return (
    <Elements stripe={getStripePromise()}>
      <CardDonationForm {...props} />
    </Elements>
  );
}

function CardDonationForm({
  tourId,
  amount,
  onAmountChange,
  isDonationValid,
  onSuccess,
  t,
}: DonationCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [splitPreview, setSplitPreview] = useState<{ guide: number; platform: number } | null>(null);
  const parsedAmount = parseFloat(amount);

  const handlePay = async () => {
    if (!stripe || !elements || !isDonationValid) return;
    setProcessing(true);
    setError('');
    try {
      const intent = await createDonationIntent(tourId, parsedAmount);
      setSplitPreview({ guide: intent.guideRevenue, platform: intent.platformRevenue });

      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error('Card element not mounted');

      const { error: stripeError } = await stripe.confirmCardPayment(intent.clientSecret, {
        payment_method: { card: cardEl },
      });

      if (stripeError) {
        setError(stripeError.message ?? t('donation.error'));
        setProcessing(false);
        return;
      }

      await activateDonation(intent.paymentIntentId);
      onSuccess(parsedAmount);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? t('donation.error'));
      setProcessing(false);
    }
  };

  return (
    <View style={donationStyles.wrap}>
      <View style={donationStyles.amountRow}>
        <Text style={donationStyles.currency}>€</Text>
        <TextInput
          style={donationStyles.amountInput}
          value={amount}
          onChangeText={onAmountChange}
          keyboardType="decimal-pad"
          selectTextOnFocus
          placeholder="0.00"
          placeholderTextColor="#9CA3AF"
          editable={!processing}
        />
      </View>

      {splitPreview && (
        <View style={donationStyles.splitRow}>
          <Text style={donationStyles.splitGuide}>
            {splitPreview.guide.toFixed(2)}€ → {t('donation.split.guide')}
          </Text>
          <Text style={donationStyles.splitPlatform}>
            {splitPreview.platform.toFixed(2)}€ → {t('donation.split.platform')}
          </Text>
        </View>
      )}

      <View style={donationStyles.cardWrap}>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '15px',
                color: '#111827',
                fontFamily: 'system-ui, sans-serif',
                '::placeholder': { color: '#9CA3AF' },
              },
              invalid: { color: '#EF4444' },
            },
          }}
        />
      </View>

      {error ? <Text style={donationStyles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[donationStyles.payBtn, (!isDonationValid || processing) && donationStyles.payBtnDisabled]}
        onPress={handlePay}
        disabled={!isDonationValid || processing}
        activeOpacity={0.85}
      >
        {processing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
            <Text style={donationStyles.payBtnText}>{t('donation.payWithCard')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

function NativeDonationForm({
  amount,
  onAmountChange,
  isDonationValid,
  tourId,
  onSuccess,
  t,
}: DonationCheckoutProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const parsedAmount = parseFloat(amount);

  const handlePay = async () => {
    if (!isDonationValid) return;
    setProcessing(true);
    setError('');
    try {
      await createDonationIntent(tourId, parsedAmount);
      onSuccess(parsedAmount);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? t('donation.error'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={donationStyles.wrap}>
      <View style={donationStyles.amountRow}>
        <Text style={donationStyles.currency}>€</Text>
        <TextInput
          style={donationStyles.amountInput}
          value={amount}
          onChangeText={onAmountChange}
          keyboardType="decimal-pad"
          selectTextOnFocus
          placeholder="0.00"
          placeholderTextColor="#9CA3AF"
          editable={!processing}
        />
        <TouchableOpacity
          style={[donationStyles.payBtnCompact, (!isDonationValid || processing) && donationStyles.payBtnDisabled]}
          onPress={handlePay}
          disabled={!isDonationValid || processing}
          activeOpacity={0.85}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="heart" size={14} color="#FFFFFF" />
              <Text style={donationStyles.payBtnText}>{t('popup.donate')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      {error ? <Text style={donationStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

const donationStyles = StyleSheet.create({
  wrap: { width: '100%', gap: 12 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  currency: {
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    height: '100%',
    textAlignVertical: 'center',
    lineHeight: 48,
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    height: '100%',
  },
  splitRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  splitGuide: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  splitPlatform: { fontSize: 12, color: '#059669', fontWeight: '600' },
  cardWrap: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
  },
  errorText: { fontSize: 12, color: '#DC2626' },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 14,
  },
  payBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    height: '100%',
  },
  payBtnDisabled: { opacity: 0.45 },
  payBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});

// ---------------------------------------------------------------------------
// DonationModal — opens when user taps "Donate" in CompletionPopup
// ---------------------------------------------------------------------------

interface DonationModalProps {
  visible: boolean;
  tourId: string;
  tourName: string;
  onClose: () => void;
}

function DonationModal({ visible, tourId, tourName, onClose }: DonationModalProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('1');
  const [successAmount, setSuccessAmount] = useState<number | null>(null);

  // Success animation values
  const checkScaleAnim = useRef(new Animated.Value(0)).current;
  const successOpacityAnim = useRef(new Animated.Value(0)).current;
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setAmount('1');
      setSuccessAmount(null);
      checkScaleAnim.setValue(0);
      successOpacityAnim.setValue(0);
    }
    return () => {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    };
  }, [visible]);

  const parsedAmount = parseFloat(amount);
  const isDonationValid = !isNaN(parsedAmount) && parsedAmount > 0;

  const handleSuccess = useCallback(
    (amt: number) => {
      setSuccessAmount(amt);

      // Checkmark scale pop: 0 → 1.3 → 1
      Animated.sequence([
        Animated.spring(checkScaleAnim, {
          toValue: 1.3,
          friction: 4,
          tension: 300,
          useNativeDriver: true,
        }),
        Animated.spring(checkScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Text fade in
      Animated.timing(successOpacityAnim, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }).start();

      // Auto-close after 3s
      autoCloseTimer.current = setTimeout(() => {
        onClose();
      }, 3000);
    },
    [checkScaleAnim, successOpacityAnim, onClose],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={dmStyles.backdrop}>
        <View style={dmStyles.card}>
          {/* Close button */}
          <TouchableOpacity style={dmStyles.closeBtn} onPress={onClose} hitSlop={8}>
            <View style={dmStyles.closeBtnInner}>
              <Ionicons name="close" size={18} color="#6B7280" />
            </View>
          </TouchableOpacity>

          {successAmount !== null ? (
            // ─── Success screen ───
            <View style={dmStyles.successContainer}>
              <Animated.View style={{ transform: [{ scale: checkScaleAnim }] }}>
                <View style={dmStyles.successIcon}>
                  <Ionicons name="checkmark-circle" size={56} color="#059669" />
                </View>
              </Animated.View>

              <Animated.View style={{ opacity: successOpacityAnim, alignItems: 'center', gap: 6 }}>
                <Text style={dmStyles.successTitle}>{t('donation.thankYou')}</Text>
                <Text style={dmStyles.successSubtitle}>
                  {t('donation.donated', {
                    amount: successAmount.toFixed(2),
                    tour: tourName,
                  })}
                </Text>
                <TouchableOpacity style={dmStyles.closeSuccessBtn} onPress={onClose}>
                  <Text style={dmStyles.closeSuccessBtnText}>{t('popup.goHome')}</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : (
            // ─── Donation form ───
            <>
              <View style={dmStyles.header}>
                <Ionicons name="heart" size={22} color={AMBER} />
                <Text style={dmStyles.title}>{t('popup.donateLabel')}</Text>
              </View>
              <Text style={dmStyles.tourName} numberOfLines={2}>{tourName}</Text>
              <DonationCheckout
                tourId={tourId}
                amount={amount}
                onAmountChange={setAmount}
                isDonationValid={isDonationValid}
                onSuccess={handleSuccess}
                t={t}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const dmStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    position: 'relative',
    gap: 16,
  },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  tourName: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: -8,
  },
  // Success
  successContainer: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingTop: 32,
  },
  successIcon: {
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#059669',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  closeSuccessBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: AMBER,
    borderRadius: 12,
  },
  closeSuccessBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

// ---------------------------------------------------------------------------
// CompletionPopup — compact main card
// ---------------------------------------------------------------------------

interface CompletionPopupProps {
  visible: boolean;
  tourName: string;
  tourId: string;
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
  tourId,
  xp,
  isFirstCompletion,
  onRate,
  onDonate,
  onClose,
  langcode,
}: CompletionPopupProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const isMobile = screenWidth < 640;

  // XP animation values
  const xpScaleAnim = useRef(new Animated.Value(0)).current;
  const xpFloatAnim = useRef(new Animated.Value(0)).current;
  const xpOpacityAnim = useRef(new Animated.Value(1)).current;

  // Run XP animation when popup first opens (first completion only)
  useEffect(() => {
    if (visible && isFirstCompletion && xp > 0) {
      xpScaleAnim.setValue(0);
      xpFloatAnim.setValue(0);
      xpOpacityAnim.setValue(1);

      // Badge scale pop
      Animated.spring(xpScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 300,
        useNativeDriver: true,
      }).start();

      // Floating "+XP" text: float up then fade
      Animated.parallel([
        Animated.timing(xpFloatAnim, {
          toValue: -60,
          duration: 1200,
          delay: 400,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(xpOpacityAnim, {
            toValue: 0,
            duration: 800,
            delay: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [visible]);

  const handleRate = (value: number) => {
    setRating(value);
    onRate(value);
  };

  const handleDonationSuccess = useCallback(
    (amt: number) => {
      onDonate(amt);
    },
    [onDonate],
  );

  const cardStyle = isMobile
    ? { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
    : { maxWidth: 420, width: '100%' as const, borderRadius: 24 };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.root}>
          {/* Backdrop */}
          <View style={styles.backdropTint} />

          {/* Confetti — always shown on completion (both first and repeat) */}
          {visible && (
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

          {/* Card */}
          <View
            style={[
              styles.cardWrapper,
              isMobile ? styles.cardWrapperMobile : styles.cardWrapperDesktop,
            ]}
            pointerEvents="box-none"
          >
            <View
              style={[
                styles.cardShell,
                isMobile ? styles.cardShellMobile : styles.cardShellDesktop,
                cardStyle,
              ]}
            >
              {/* Close button */}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                <View style={styles.closeBtnInner}>
                  <Ionicons name="close" size={18} color="#6B7280" />
                </View>
              </TouchableOpacity>

              {/* Content — no scroll needed with compact layout */}
              <View style={styles.content}>
                {/* Party icon — first completion only */}
                {isFirstCompletion && (
                  <View style={styles.iconCircle}>
                    <Text style={styles.iconEmoji}>🎉</Text>
                  </View>
                )}

                {/* Title */}
                <Text style={styles.title}>
                  {isFirstCompletion ? t('popup.congratulations') : t('popup.alreadyCompleted')}
                </Text>

                {/* Subtitle */}
                <Text style={styles.subtitle}>
                  {t('popup.completedTourOf')}{' '}
                  <Text style={styles.subtitleBold}>{tourName}</Text>
                </Text>

                {/* XP badge with animations — first completion only */}
                {isFirstCompletion && xp > 0 && (
                  <View style={styles.xpContainer}>
                    {/* Floating +XP text */}
                    <Animated.Text
                      style={[
                        styles.xpFloat,
                        {
                          transform: [{ translateY: xpFloatAnim }],
                          opacity: xpOpacityAnim,
                        },
                      ]}
                    >
                      +{xp} XP
                    </Animated.Text>

                    {/* XP badge (scale pop) */}
                    <Animated.View
                      style={[styles.xpBadge, { transform: [{ scale: xpScaleAnim }] }]}
                    >
                      <Ionicons name="flash" size={15} color={AMBER} />
                      <Text style={styles.xpText}>+{xp} XP</Text>
                    </Animated.View>
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

                <View style={styles.divider} />

                {/* Action buttons */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.donateButton}
                    onPress={() => setShowDonationModal(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="heart" size={16} color="#FFFFFF" />
                    <Text style={styles.donateButtonText}>{t('popup.donate')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.homeButton}
                    onPress={onClose}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.homeButtonText}>{t('popup.goHome')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Donation modal — rendered outside the main modal to avoid stacking issues */}
      <DonationModal
        visible={showDonationModal}
        tourId={tourId}
        tourName={tourName}
        onClose={() => {
          setShowDonationModal(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  confettiLayer: { zIndex: 1 },
  cardWrapper: { flex: 1, zIndex: 2 },
  cardWrapperMobile: { justifyContent: 'flex-end' },
  cardWrapperDesktop: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  cardShell: {
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
  },
  cardShellMobile: { maxHeight: '70%' },
  cardShellDesktop: { maxHeight: '80%' },
  closeBtn: { position: 'absolute', top: 14, right: 14, zIndex: 10 },
  closeBtnInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    gap: 10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AMBER,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AMBER,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  iconEmoji: { fontSize: 34 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  subtitleBold: { fontWeight: '700', color: '#111827' },
  // XP container: positions float text above badge
  xpContainer: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'flex-end',
  },
  xpFloat: {
    position: 'absolute',
    top: 0,
    fontSize: 18,
    fontWeight: '900',
    color: AMBER,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  xpText: { fontSize: 15, fontWeight: '800', color: '#D97706' },
  ratingSection: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  ratingPrompt: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
  },
  donateButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  homeButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: AMBER,
  },
  homeButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
