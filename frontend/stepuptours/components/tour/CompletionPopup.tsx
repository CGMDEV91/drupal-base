// components/tour/CompletionPopup.tsx
// Modal shown when a tour is completed — no internal scroll, Stripe integrated, mobile fullscreen

import React, { useState, useRef, useEffect } from 'react';
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

// Stripe imports — web only (tree-shaken on native)
let Elements: any = null;
let CardElement: any = null;
let useStripe: any = null;
let useElements: any = null;

if (Platform.OS === 'web') {
  try {
    const stripeReact = require('@stripe/react-stripe-js');
    Elements = stripeReact.Elements;
    CardElement = stripeReact.CardElement;
    useStripe = stripeReact.useStripe;
    useElements = stripeReact.useElements;
  } catch {
    // Stripe not available
  }
}

const AMBER = '#F59E0B';
const CONFETTI_COLORS = [
  '#F59E0B', '#22C55E', '#3B82F6', '#EF4444',
  '#8B5CF6', '#FCD34D', '#EC4899', '#14B8A6',
  '#F97316', '#06B6D4', '#84CC16', '#A855F7',
];
const CONFETTI_COUNT = 100;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// ---------------------------------------------------------------------------
// CSS confetti for web
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
      `"></div>`,
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
    case 'rect':   return { width: size * 0.7, height: size * 1.8, borderRadius: 2 };
    case 'thin':   return { width: size * 0.4, height: size * 2.2, borderRadius: 1 };
    default:       return { width: size, height: size, borderRadius: 2 };
  }
}

function ConfettiPiece({ delay, screenWidth, screenHeight }: { delay: number; screenWidth: number; screenHeight: number }) {
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
      toValue: 1, duration, delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, []);

  const translateY = animValue.interpolate({ inputRange: [0, 1], outputRange: [startY, screenHeight + 60] });
  const translateX = animValue.interpolate({ inputRange: [0, 0.4, 0.7, 1], outputRange: [0, drift * 0.4, drift * 0.8, drift] });
  const opacity = animValue.interpolate({ inputRange: [0, 0.05, 0.75, 1], outputRange: [0, 1, 0.85, 0] });
  const rotate = animValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', endRotation] });

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: x, top: 0, backgroundColor: color, ...shapeStyle(shape, size) },
        { opacity, transform: [{ translateY }, { translateX }, { rotate }] },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Stripe donation form (web only)
// ---------------------------------------------------------------------------

interface DonationCardFormProps {
  tourId: string;
  amount: string;
  isDonationValid: boolean;
  guideRevenue: number;
  platformRevenue: number;
  onSuccess: (paidAmount: number) => void;
}

function DonationCardForm({ tourId, amount, isDonationValid, guideRevenue, platformRevenue, onSuccess }: DonationCardFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe ? useStripe() : null;
  const elements = useElements ? useElements() : null;
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements || !isDonationValid) return;
    setProcessing(true);
    setError(null);
    try {
      const parsedAmount = parseFloat(amount);
      const intent = await createDonationIntent(tourId, parsedAmount);
      const cardElement = CardElement ? elements.getElement(CardElement) : null;
      if (!cardElement) { setError(t('donation.error')); return; }
      const { error: stripeError } = await stripe.confirmCardPayment(intent.clientSecret, {
        payment_method: { card: cardElement },
      });
      if (stripeError) {
        setError(stripeError.message ?? t('donation.error'));
        return;
      }
      await activateDonation(intent.paymentIntentId);
      onSuccess(parsedAmount);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? t('donation.error'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={donationStyles.wrap}>
      {/* Split preview */}
      <View style={donationStyles.splitRow}>
        <Text style={donationStyles.splitText}>
          {guideRevenue.toFixed(2)}€ → {t('donation.split.guide')}
        </Text>
        <Text style={donationStyles.splitSep}>·</Text>
        <Text style={donationStyles.splitText}>
          {platformRevenue.toFixed(2)}€ → {t('donation.split.platform')}
        </Text>
      </View>

      {/* Stripe CardElement */}
      {CardElement && (
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
      )}

      {/* Error */}
      {error && (
        <View style={donationStyles.errorRow}>
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text style={donationStyles.errorText}>{error}</Text>
        </View>
      )}

      {/* Pay button + Stripe badge */}
      <View style={donationStyles.payRow}>
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
              <Ionicons name="heart" size={14} color="#FFFFFF" />
              <Text style={donationStyles.payBtnText}>
                {t('donation.payWithCard')} €{parseFloat(amount).toFixed(2)}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Stripe trust badge */}
        <View style={donationStyles.stripeBadge}>
          <Ionicons name="lock-closed" size={10} color="#9CA3AF" />
          <Text style={donationStyles.stripeBadgeText}>Stripe</Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CompletionPopup
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

// Stripe promise initialised once at module level (web only)
const stripePromise = Platform.OS === 'web' ? getStripePromise() : null;

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
  const [donationAmount, setDonationAmount] = useState('1');
  const [donationSuccess, setDonationSuccess] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const isMobile = screenWidth < 640;

  // Parse amount for validation + split preview
  const parsedAmount = parseFloat(donationAmount);
  const isDonationValid = !isNaN(parsedAmount) && parsedAmount > 0.5;
  // Rough split preview (70/30 — actual split comes from the backend on real payment)
  const guideRevenue = isDonationValid ? parsedAmount * 0.7 : 0;
  const platformRevenue = isDonationValid ? parsedAmount * 0.3 : 0;

  const handleRate = (value: number) => {
    setRating(value);
    onRate(value);
  };

  const handleDonationSuccess = (paidAmount: number) => {
    setDonationSuccess(true);
    setTimeout(() => {
      onDonate(paidAmount);
    }, 2200);
  };

  // Native-only donate (no Stripe Elements)
  const handleNativeDonate = () => {
    if (!isDonationValid) return;
    onDonate(parsedAmount);
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setRating(0);
      setDonationAmount('1');
      setDonationSuccess(false);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isMobile ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      {/* Overlay — on web overflow:auto lets browser handle vertical scroll if needed */}
      <View
        style={[
          styles.overlay,
          isMobile ? styles.overlayMobile : styles.overlayDesktop,
        ]}
      >
        {/* Backdrop — pressable to close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
        />

        {/* Confetti */}
        {visible && (
          Platform.OS === 'web'
            ? <WebConfetti screenWidth={screenWidth} />
            : (
              <View style={[StyleSheet.absoluteFill, styles.confettiLayer]} pointerEvents="none">
                {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
                  <ConfettiPiece key={i} delay={i * 18} screenWidth={screenWidth} screenHeight={screenHeight} />
                ))}
              </View>
            )
        )}

        {/* Card */}
        <View style={[styles.card, isMobile ? styles.cardMobile : styles.cardDesktop]}>

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <View style={styles.closeBtnInner}>
              <Ionicons name="close" size={18} color="#6B7280" />
            </View>
          </TouchableOpacity>

          {/* ── Header ── */}
          <View style={styles.header}>
            {isFirstCompletion && (
              <View style={styles.iconCircle}>
                <Ionicons name="ribbon" size={28} color="#FFFFFF" />
              </View>
            )}
            <Text style={styles.title}>
              {isFirstCompletion ? t('popup.congratulations') : t('popup.alreadyCompleted')}
            </Text>
            <Text style={styles.subtitle}>
              {t('popup.completedTourOf')}{' '}
              <Text style={styles.subtitleBold}>{tourName}</Text>
            </Text>
            {isFirstCompletion && xp > 0 && (
              <View style={styles.xpBadge}>
                <Ionicons name="flash" size={13} color={AMBER} />
                <Text style={styles.xpText}>+{xp} XP</Text>
              </View>
            )}
          </View>

          {/* ── Rating (first completion only) ── */}
          {isFirstCompletion && (
            <>
              <View style={styles.divider} />
              <View style={styles.ratingSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="star" size={13} color={AMBER} />
                  <Text style={styles.ratingPrompt}>{t('popup.rateExperience')}</Text>
                </View>
                <StarRating value={rating} interactive onRate={handleRate} size={30} />
              </View>
            </>
          )}

          {/* ── Donation section ── */}
          <View style={styles.divider} />
          <View style={styles.donationSection}>
            <View style={styles.donationHeader}>
              <Ionicons name="heart" size={14} color={AMBER} />
              <Text style={styles.donationLabel}>{t('popup.donateLabel')}</Text>
            </View>

            {donationSuccess ? (
              /* Success state */
              <View style={styles.successSection}>
                <Ionicons name="checkmark-circle" size={36} color="#22C55E" />
                <Text style={styles.successTitle}>{t('donation.thankYou')}</Text>
                <Text style={styles.successSub}>
                  {t('donation.donated', { amount: parseFloat(donationAmount).toFixed(2), tour: tourName })}
                </Text>
              </View>
            ) : (
              <>
                {/* Amount input */}
                <View style={styles.amountRow}>
                  <Text style={styles.currencySymbol}>€</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={donationAmount}
                    onChangeText={setDonationAmount}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    placeholder="1.00"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Web: Stripe Elements form */}
                {Platform.OS === 'web' && Elements && (
                  <Elements stripe={stripePromise}>
                    <DonationCardForm
                      tourId={tourId}
                      amount={donationAmount}
                      isDonationValid={isDonationValid}
                      guideRevenue={guideRevenue}
                      platformRevenue={platformRevenue}
                      onSuccess={handleDonationSuccess}
                    />
                  </Elements>
                )}

                {/* Native: simple donate button */}
                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    style={[styles.payBtn, !isDonationValid && styles.payBtnDisabled]}
                    onPress={handleNativeDonate}
                    disabled={!isDonationValid}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="heart" size={14} color="#FFFFFF" />
                    <Text style={styles.payBtnText}>
                      {t('popup.donate')} €{donationAmount}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* ── Back to home ── */}
          <View style={styles.divider} />
          <TouchableOpacity style={styles.homeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={15} color="#6B7280" />
            <Text style={styles.homeBtnText}>{t('popup.goHome')}</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Donation section styles
// ---------------------------------------------------------------------------

const donationStyles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  splitText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  splitSep: {
    fontSize: 11,
    color: '#D1D5DB',
  },
  cardWrap: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    flex: 1,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: AMBER,
    paddingVertical: 13,
    borderRadius: 10,
  },
  payBtnDisabled: {
    opacity: 0.45,
  },
  payBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stripeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stripeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.3,
  },
});

// ---------------------------------------------------------------------------
// Main styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { overflow: 'auto' as any } : {}),
  },
  overlayDesktop: {
    padding: 20,
  },
  overlayMobile: {
    justifyContent: 'flex-end',
    padding: 0,
  },

  confettiLayer: {
    zIndex: 1,
  },

  card: {
    backgroundColor: '#FFFFFF',
    zIndex: 2,
    padding: 28,
  },
  cardDesktop: {
    borderRadius: 20,
    maxWidth: 460,
    width: '100%',
  },
  cardMobile: {
    flex: 1,
    width: '100%',
    paddingTop: 52,
    paddingHorizontal: 24,
    paddingBottom: 32,
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

  // ── Header ──
  header: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: AMBER,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: AMBER,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
  },
  subtitleBold: {
    fontWeight: '700',
    color: '#374151',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  xpText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D97706',
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 16,
  },

  // ── Rating ──
  ratingSection: {
    alignItems: 'center',
    gap: 8,
  },
  ratingPrompt: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Donation section ──
  donationSection: {
    gap: 10,
  },
  donationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  donationLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    overflow: 'hidden',
    height: 46,
  },
  currencySymbol: {
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    height: '100%',
    textAlignVertical: 'center',
    lineHeight: 46,
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    height: '100%',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: AMBER,
    paddingVertical: 13,
    borderRadius: 10,
  },
  payBtnDisabled: {
    opacity: 0.45,
  },
  payBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Donation success ──
  successSection: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Home button ──
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  homeBtnText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
});
