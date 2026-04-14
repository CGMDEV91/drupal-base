// components/tour/StepContent.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTTS } from '../../hooks/useTTS';
import { BusinessCard } from './BusinessCard';
import { HtmlText, stripHtmlText } from '../ui/HtmlText';
import type { TourStep } from '../../types';
import { useWindowDimensions } from 'react-native';

const ORANGE        = '#ea580c';
const SPEEDS        = [0.75, 1, 1.25, 1.5, 2];
const BAR_HEIGHTS = [5, 10, 7, 13, 6, 11, 8, 14, 5, 9, 12, 7, 10, 6, 6, 11, 5, 9, 12, 7];
const PREVIEW_LINES = 4;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Idiomas sin soporte en el servicio TTS del servidor.
// Para estos se oculta el player y se muestra un aviso.
const NO_TTS_LANGS = new Set(['el']);

function isGoogleMapsUrl(url: string): boolean {
  return (
    url.startsWith('about:') ||
    url.includes('google.com/maps') ||
    url.includes('maps.google.com') ||
    url.includes('maps.googleapis.com') ||
    url.includes('maps.gstatic.com') ||
    url.includes('googleapis.com') ||
    url.includes('googleusercontent.com') ||
    url.includes('gstatic.com')
  );
}

const SV_INJECT_JS = `
(function() {
  setTimeout(function() {
    var canvasCount = document.querySelectorAll('canvas').length;
    if (canvasCount === 0) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('sv_unavailable');
    }
  }, 3000);
})();
true;
`;

// ─── Platform-aware Google embed ─────────────────────────────────────────────

interface EmbedProps {
  uri: string;
  height: number;
  interactive?: boolean;
  onUnavailable?: () => void;
}

// Web-only inner component so hooks are always called unconditionally.
function WebGoogleEmbed({ uri, height, interactive = false, onUnavailable }: EmbedProps) {
  // When Street View fails (503), the iframe still loads but shows an error state.
  // We can't inspect cross-origin iframe content, but we CAN detect whether the
  // user ever interacted with it: clicking/dragging in the iframe steals focus
  // from the parent window, firing a `blur` event.
  // If no interaction occurs within SV_WEB_TIMEOUT ms, we assume it failed.
  // Only applies when `onUnavailable` is provided (Street View mode).
  const SV_WEB_TIMEOUT = 7_000;

  React.useEffect(() => {
    if (!onUnavailable) return; // No-op for static/directions embeds

    let interacted = false;
    const onBlur = () => { interacted = true; };
    window.addEventListener('blur', onBlur);

    const timer = setTimeout(() => {
      if (!interacted) onUnavailable();
    }, SV_WEB_TIMEOUT);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('blur', onBlur);
    };
  }, [uri]); // Re-arm when URI changes (retry gives a fresh URI key)

  const wrapStyle = { height, overflow: 'hidden' as const, position: 'relative' as const };
  return (
    <View style={wrapStyle}>
      {/* @ts-ignore */}
      <iframe
        src={uri}
        style={{ width: '100%', height: '100%', border: 'none', pointerEvents: interactive ? 'auto' : 'none' }}
        loading="lazy"
        allowFullScreen
        allow="accelerometer *; gyroscope *; geolocation *; fullscreen *; xr-spatial-tracking *"
        referrerPolicy="no-referrer-when-downgrade"
      />
      {!interactive && <View style={StyleSheet.absoluteFill} />}
    </View>
  );
}

function GoogleEmbed({ uri, height, interactive = false, onUnavailable }: EmbedProps) {
  const wrapStyle = { height, overflow: 'hidden' as const, position: 'relative' as const };

  if (Platform.OS === 'web') {
    return <WebGoogleEmbed uri={uri} height={height} interactive={interactive} onUnavailable={onUnavailable} />;
  }

  return (
    <View style={wrapStyle}>
      <WebView
        source={{ uri }}
        scrollEnabled={interactive}
        javaScriptEnabled
        geolocationEnabled={interactive}
        allowsInlineMediaPlayback
        injectedJavaScript={onUnavailable ? SV_INJECT_JS : undefined}
        onMessage={(e) => { if (e.nativeEvent.data === 'sv_unavailable') onUnavailable?.(); }}
        onShouldStartLoadWithRequest={(req) => isGoogleMapsUrl(req.url)}
        style={{ flex: 1, backgroundColor: '#e8e8e8' }}
      />
      {!interactive && <View style={StyleSheet.absoluteFill} pointerEvents="box-only" />}
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface StepContentProps {
  step: TourStep;
  isCompleted: boolean;
  isActive: boolean;
  isExpanded: boolean;
  onComplete: () => void;
  langcode: string;
  tourTitle?: string;
}

interface NavMode {
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  travelmode: string;
  dirflg: string;
  androidMode: string;
  iosDirMode: string;
}

const NAV_MODES: NavMode[] = [
  { labelKey: 'step.walk',            icon: 'walk-outline',    travelmode: 'walking',   dirflg: 'w', androidMode: 'w', iosDirMode: 'walking'   },
  { labelKey: 'step.bike',            icon: 'bicycle-outline', travelmode: 'bicycling', dirflg: 'b', androidMode: 'b', iosDirMode: 'bicycling' },
  { labelKey: 'step.publicTransport', icon: 'bus-outline',     travelmode: 'transit',   dirflg: 'r', androidMode: 'r', iosDirMode: 'transit'   },
  { labelKey: 'step.drive',           icon: 'car-outline',     travelmode: 'driving',   dirflg: 'd', androidMode: 'd', iosDirMode: 'driving'   },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const MAP_HEIGHT = 220;

// ─── Bloque de navegación (DRY — evita duplicar JSX) ─────────────────────────

interface NavBlockProps {
  step: TourStep;
  selectedMode: string | null;
  dirHeightAnim: Animated.Value;
  directionsUrl: string | null;
  onModeSelect: (mode: NavMode) => void;
  onGoToSite: () => void;
  t: (key: string) => string;
}

function NavBlock({
                    step,
                    selectedMode,
                    dirHeightAnim,
                    directionsUrl,
                    onModeSelect,
                    onGoToSite,
                    t,
                  }: NavBlockProps) {
  if (!step.location) return null;

  return (
    <>
      <View style={styles.sectionLabel}>
        <Text style={styles.sectionLabelText}>{t('step.howToGet')}</Text>
        <View style={styles.sectionLine} />
      </View>

      <View style={styles.chipsRow}>
        {NAV_MODES.map((mode) => {
          const active = selectedMode === mode.travelmode;
          return (
            <TouchableOpacity
              key={mode.travelmode}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onModeSelect(mode)}
              activeOpacity={0.7}
            >
              <Ionicons name={mode.icon} size={17} color={active ? ORANGE : '#57534e'} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t(mode.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Animated.View
        style={[
          styles.directionsWrap,
          {
            height:  dirHeightAnim,
            opacity: dirHeightAnim.interpolate({ inputRange: [0, 80], outputRange: [0, 1] }),
          },
        ]}
      >
        {directionsUrl ? (
          <GoogleEmbed uri={directionsUrl} height={MAP_HEIGHT} interactive={false} />
        ) : null}
      </Animated.View>

      {selectedMode ? (
        <View style={styles.routeActions}>
          <TouchableOpacity style={styles.startRouteBtn} onPress={onGoToSite} activeOpacity={0.85}>
            <Ionicons name="navigate" size={16} color="#ffffff" />
            <Text style={styles.startRouteBtnText}>{t('step.goToSite')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepContent({
                              step,
                              isCompleted,
                              isActive,
                              isExpanded,
                              onComplete,
                              langcode,
                              tourTitle,
                            }: StepContentProps) {
  const { t } = useTranslation();

  const [confirmed, setConfirmed]       = useState(false);
  const [expanded, setExpanded]         = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [svAvailable, setSvAvailable]   = useState(true);
  // svKey forces a full remount of GoogleEmbed on each retry attempt.
  const [svKey, setSvKey]               = useState(0);
  const svRetriesRef                    = useRef(0);
  const MAX_SV_RETRIES                  = 1; // retry once, then fall back to static map

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const dirHeightAnim = useRef(new Animated.Value(0)).current;

  const descriptionText = step.description ?? '';
  const ttsText         = stripHtmlText(descriptionText);
  const ttsLangcode     = step.contentLangcode ?? langcode;
  const tts             = useTTS(ttsText, ttsLangcode, { tourTitle, stepTitle: step.title });
  const isPlaying       = tts.playState === 'playing';

  const waveAnims = useRef(BAR_HEIGHTS.map(() => new Animated.Value(0.4))).current;
  const waveLoops = useRef<Animated.CompositeAnimation[]>([]);

  // ── Waveform animation ────────────────────────────────────────────────────

  useEffect(() => {
    if (isPlaying) {
      waveLoops.current = waveAnims.map((anim, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1,    duration: 280 + i * 35, useNativeDriver: USE_NATIVE_DRIVER }),
            Animated.timing(anim, { toValue: 0.25, duration: 280 + i * 35, useNativeDriver: USE_NATIVE_DRIVER }),
          ])
        );
        loop.start();
        return loop;
      });
    } else {
      waveLoops.current.forEach((l) => l.stop());
      waveAnims.forEach((a) => a.setValue(0.4));
    }
    return () => waveLoops.current.forEach((l) => l.stop());
  }, [isPlaying]);

  // ── Prefetch adelantado: en cuanto el step se expande ────────────────────
  // Antes esperábamos a `confirmed`, ahora lo hacemos al abrir el acordeón,
  // ganando varios segundos de ventaja antes de que el usuario pulse play.

  // Prefetch en cuanto el step es activo (antes de que el usuario lo abra),
  // así el audio ya está pre-cargado cuando pulse play → primer click funciona.
  useEffect(() => {
    if (isActive && ttsText) tts.prefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const prevExpandedRef = useRef(isExpanded);
  useEffect(() => {
    if (isExpanded && !prevExpandedRef.current) {
      // Step recién abierto → segundo prefetch por si acaso (ya tiene cache-hit)
      if (ttsText) tts.prefetch();
    }
    if (prevExpandedRef.current && !isExpanded) {
      tts.handleStop();
    }
    prevExpandedRef.current = isExpanded;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  // ── Street View retry / fallback ─────────────────────────────────────────
  // Called by GoogleEmbed when Street View is unavailable (503, no coverage…).
  // We retry once (re-mounting the embed) before falling back to static map.

  const handleSvUnavailable = useCallback(() => {
    if (svRetriesRef.current < MAX_SV_RETRIES) {
      svRetriesRef.current += 1;
      setSvKey((k) => k + 1); // triggers GoogleEmbed remount → fresh iframe/WebView
    } else {
      svRetriesRef.current = 0;
      setSvAvailable(false);
    }
  }, []);

  // ── Reset al completar ────────────────────────────────────────────────────

  useEffect(() => {
    if (isCompleted) {
      setConfirmed(false);
      setExpanded(false);
      setSelectedMode(null);
      dirHeightAnim.setValue(0);
    }
  }, [isCompleted]);

  // ── URLs ──────────────────────────────────────────────────────────────────

  const hasLocation = !!step.location;

  const streetViewUrl = step.location
    ? `https://maps.google.com/maps?q=&layer=c&cbll=${step.location.lat},${step.location.lon}&cbp=12,0,0,0,0&output=svembed&hl=es`
    : null;

  const staticMapUrl = step.location
    ? `https://maps.google.com/maps?q=${step.location.lat},${step.location.lon}&z=17&output=embed`
    : null;

  const activeMapUrl = svAvailable && streetViewUrl ? streetViewUrl : staticMapUrl;
  const activeMapH   = svAvailable && streetViewUrl ? 320 : 140;

  const activeMode    = NAV_MODES.find((m) => m.travelmode === selectedMode);
  const directionsUrl = step.location && activeMode
    ? `https://maps.google.com/maps?saddr=My+Location&daddr=${step.location.lat},${step.location.lon}&dirflg=${activeMode.dirflg}&output=embed`
    : null;

  // ── Nav handlers ──────────────────────────────────────────────────────────

  const handleModeSelect = (mode: NavMode) => {
    if (selectedMode === mode.travelmode) {
      Animated.timing(dirHeightAnim, { toValue: 0, duration: 260, useNativeDriver: false }).start(
        () => setSelectedMode(null)
      );
    } else {
      setSelectedMode(mode.travelmode);
      Animated.timing(dirHeightAnim, { toValue: MAP_HEIGHT, duration: 320, useNativeDriver: false }).start();
    }
  };

  const resetNavState = () => {
    Animated.timing(dirHeightAnim, { toValue: 0, duration: 260, useNativeDriver: false }).start(
      () => setSelectedMode(null)
    );
  };

  const openNearbyMaps = async (query: string) => {
    if (!step.location) return;
    const { lat, lon } = step.location;
    const encodedQuery = encodeURIComponent(query);

    if (Platform.OS === 'ios') {
      const googleUrl = `comgooglemaps://?q=${encodedQuery}&center=${lat},${lon}`;
      const canGm = await Linking.canOpenURL(googleUrl).catch(() => false);
      Linking.openURL(canGm ? googleUrl : `maps://?q=${encodedQuery}&ll=${lat},${lon}`);
    } else if (Platform.OS === 'android') {
      Linking.openURL(`geo:${lat},${lon}?q=${encodedQuery}`);
    } else {
      Linking.openURL(`https://www.google.com/maps/search/${encodedQuery}/@${lat},${lon},16z`);
    }
  };

  const handleGoToSite = async () => {
    if (!step.location || !activeMode) return;
    const { lat, lon } = step.location;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=${activeMode.travelmode}`;

    if (Platform.OS === 'ios') {
      const gmUrl = `comgooglemaps://?daddr=${lat},${lon}&directionsmode=${activeMode.iosDirMode}`;
      const canGm = await Linking.canOpenURL(gmUrl).catch(() => false);
      Linking.openURL(canGm ? gmUrl : `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=${activeMode.androidMode}`);
    } else if (Platform.OS === 'android') {
      const gmUrl = `google.navigation:q=${lat},${lon}&mode=${activeMode.androidMode}`;
      const canGm = await Linking.canOpenURL(gmUrl).catch(() => false);
      Linking.openURL(canGm ? gmUrl : webUrl);
    } else {
      Linking.openURL(webUrl);
    }
  };

  // ── Shared map block ──────────────────────────────────────────────────────

  const mapBlock = hasLocation && activeMapUrl ? (
    <View style={styles.svBlock}>
      <View style={styles.svTagRow}>
        <View style={styles.svTag}>
          <View style={styles.svDot} />
          <Text style={styles.svTagText}>
            {svAvailable ? t('step.locationView') : step.title}
          </Text>
        </View>
      </View>
      <View style={styles.mapOuter}>
        <GoogleEmbed
          key={svKey}
          uri={activeMapUrl}
          height={activeMapH}
          interactive={svAvailable}
          onUnavailable={svAvailable ? handleSvUnavailable : undefined}
        />
      </View>
    </View>
  ) : null;

  // ── ACTIVE (no confirmado) ────────────────────────────────────────────────

  if (!confirmed && !isCompleted) {
    return (
      <View style={styles.container}>
        {mapBlock}

        {hasLocation ? (
          <NavBlock
            step={step}
            selectedMode={selectedMode}
            dirHeightAnim={dirHeightAnim}
            directionsUrl={directionsUrl}
            onModeSelect={handleModeSelect}
            onGoToSite={handleGoToSite}
            t={t}
          />
        ) : null}

        {isActive && (
          <View style={styles.geoPop}>
            <View style={styles.geoPopIcon}>
              <Ionicons name="location-outline" size={15} color="#D97706" />
            </View>
            <View style={styles.geoPopBody}>
              <Text style={styles.geoPopTitle} numberOfLines={2}>
                {t('step.alreadyHere', { title: step.title })}
              </Text>
              <Text style={styles.geoPopSub}>{t('step.confirmSubtitle')}</Text>
              <TouchableOpacity
                style={styles.geoPopYes}
                onPress={() => {
                  resetNavState();
                  setConfirmed(true);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                <Text style={styles.geoPopYesText}>{t('step.confirmYes')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  // ── CONFIRMED / COMPLETED ─────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {mapBlock}

      {hasLocation ? (
        <NavBlock
          step={step}
          selectedMode={selectedMode}
          dirHeightAnim={dirHeightAnim}
          directionsUrl={directionsUrl}
          onModeSelect={handleModeSelect}
          onGoToSite={handleGoToSite}
          t={t}
        />
      ) : null}

      {/* ── Reproductor TTS / Warning sin soporte ───────────────────────── */}
      {descriptionText && NO_TTS_LANGS.has(langcode) ? (
        <View style={styles.ttsWarning}>
          <Ionicons name="information-circle-outline" size={16} color="#664d03" />
          <Text style={styles.ttsWarningText}>{t('step.ttsUnavailable')}</Text>
        </View>
      ) : descriptionText ? (
        <View style={[styles.playerCard, isDesktop && styles.playerCardDesktop]}>
          <View style={styles.playerRow}>
            {/* Play / Pause */}
            <TouchableOpacity style={styles.playBtn} onPress={tts.handlePlayPause} activeOpacity={0.8}>
              {tts.playState === 'loading' ? (
                <Ionicons name="ellipsis-horizontal" size={14} color="#FFFFFF" />
              ) : (
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={15} color="#FFFFFF" />
              )}
            </TouchableOpacity>

            <View style={styles.playerMeta}>
              <Text style={styles.playerTitle} numberOfLines={1}>{step.title}</Text>
              <View style={styles.waveform}>
                {waveAnims.map((anim, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height: BAR_HEIGHTS[i],
                        backgroundColor: isPlaying ? ORANGE : 'rgba(255,255,255,0.16)',
                        transform: [{ scaleY: anim }],
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.playerTimes}>
                <Text style={styles.playerTimeActive}>{formatTime(tts.elapsed)}</Text>
                <Text style={styles.playerTimeDim}>{formatTime(tts.totalDuration)}</Text>
              </View>
            </View>

            {/* Velocidad */}
            <TouchableOpacity onPress={tts.handleSpeedChange} style={styles.speedChip} activeOpacity={0.7}>
              <Text style={styles.speedChipText}>{SPEEDS[tts.speedIndex]}x</Text>
            </TouchableOpacity>

            {/* Stop */}
            <TouchableOpacity onPress={tts.handleStop} style={styles.stopChip} activeOpacity={0.7}>
              <Ionicons name="stop" size={12} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}


      {/* ── Descripción ─────────────────────────────────────────────────── */}
      {descriptionText ? (
        <View style={styles.descCard}>
          <View style={styles.descHeader}>
            <Text style={styles.descHeaderText}>{t('step.aboutStop')}</Text>
            <View style={styles.descHeaderLine} />
          </View>
          <HtmlText
            html={descriptionText}
            style={styles.descText}
            numberOfLines={expanded ? undefined : PREVIEW_LINES}
          />
          {ttsText.length > 200 ? (
            <TouchableOpacity
              style={styles.readMoreBtn}
              onPress={() => setExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Ionicons name={expanded ? 'remove-outline' : 'add-outline'} size={11} color={ORANGE} />
              <Text style={styles.readMoreText}>
                {expanded ? t('step.readLess') : t('step.readMore')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {step.featuredBusiness ? <BusinessCard business={step.featuredBusiness} /> : null}

      {hasLocation && step.location && (confirmed || isCompleted) ? (
        <View style={styles.nearbyContainer}>
          <Text style={styles.nearbyTitle}>{t('step.nearbyTitle')}</Text>
          <View style={styles.nearbyChips}>
            {[
              { key: 'step.nearbyRestaurants', query: 'restaurants',        icon: 'restaurant-outline' },
              { key: 'step.nearbyCafes',       query: 'cafes',              icon: 'cafe-outline' },
              { key: 'step.nearbyAttractions', query: 'tourist attractions', icon: 'camera-outline' },
            ].map(({ key, query, icon }) => (
              <TouchableOpacity
                key={key}
                style={styles.nearbyChip}
                onPress={() => openNearbyMaps(query)}
                activeOpacity={0.75}
              >
                <Ionicons name={icon as any} size={15} color={ORANGE} />
                <Text style={styles.nearbyChipText}>{t(key)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {isActive && !isCompleted ? (
        <TouchableOpacity style={styles.completeBtn} onPress={onComplete} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.completeBtnText}>{t('step.markCompleted')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    gap: 10,
    paddingBottom: 4,
  },
  svBlock: {
    gap: 6,
  },
  svTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapOuter: {
    position: 'relative',
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e1d8',
  },
  svTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  svDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ff4040',
  },
  svTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 2,
  },
  sectionLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b0a898',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    flexShrink: 0,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ede9e2',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 4,
    backgroundColor: '#f5f4f0',
    borderWidth: 1.5,
    borderColor: '#e5e1d8',
    borderRadius: 10,
  },
  chipActive: {
    backgroundColor: '#fff7ed',
    borderColor: ORANGE,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78716c',
    textAlign: 'center',
  },
  chipTextActive: {
    color: ORANGE,
  },
  directionsWrap: {
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e1d8',
  },
  routeActions: {
    flexDirection: 'row',
  },
  startRouteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    backgroundColor: ORANGE,
    borderRadius: 10,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  startRouteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  geoPop: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fbbf24',
    borderRadius: 12,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  geoPopIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#fbbf24',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  geoPopBody: {
    flex: 1,
    gap: 3,
  },
  geoPopTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  geoPopSub: {
    fontSize: 12,
    color: '#a16207',
    marginBottom: 5,
  },
  geoPopYes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: ORANGE,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  geoPopYesText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playerCard: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    padding: 11,
  },
  playerCardDesktop: {
    alignSelf: 'flex-start',
    minWidth: 340,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  playerMeta: {
    flex: 1,
    gap: 3,
  },
  playerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 16,
  },
  waveBar: {
    width: 2,
    borderRadius: 2,
    transformOrigin: 'center',
  },
  playerTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  playerTimeActive: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
    fontVariant: ['tabular-nums'] as any,
  },
  playerTimeDim: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.28)',
    fontVariant: ['tabular-nums'] as any,
  },
  speedChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  speedChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  stopChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  descCard: {
    backgroundColor: '#faf9f6',
    borderRadius: 11,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ece9e3',
    gap: 7,
  },
  descHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  descHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b0a898',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    flexShrink: 0,
  },
  descHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ece9e3',
  },
  descText: {
    fontSize: 15,
    color: '#44403c',
    lineHeight: 23,
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: ORANGE,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    backgroundColor: '#22c55e',
    borderRadius: 11,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 6,
  },
  completeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  nearbyContainer: {
    marginTop: 6,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  nearbyTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  nearbyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nearbyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF5EE',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#FDDBC8',
  },
  nearbyChipText: {
    fontSize: 13,
    color: ORANGE,
    fontWeight: '500',
  },
  ttsWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffc107',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ttsWarningText: {
    fontSize: 13,
    color: '#664d03',
    flex: 1,
    lineHeight: 19,
  },
});
