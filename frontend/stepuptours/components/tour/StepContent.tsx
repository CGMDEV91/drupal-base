// components/tour/StepContent.tsx
// Expanded content for a single tour step — active / confirmed states + dark TTS player

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTTS } from '../../hooks/useTTS';
import { BusinessCard } from './BusinessCard';
import { NearbyPlaces } from './NearbyPlaces';
import type { TourStep } from '../../types';

const ORANGE = '#ea580c';
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const BAR_HEIGHTS = [5, 10, 7, 13, 6, 11, 8, 14, 5, 9, 12, 7, 10, 6];
const PREVIEW_LINES = 4;

// Allow-list for Google Maps WebView navigation
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

// JS injected into Street View WebView — availability detection only.
// CSS scaling removed: it was shifting touch hit targets and blocking panorama navigation arrows.
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

function GoogleEmbed({ uri, height, interactive = false, onUnavailable }: EmbedProps) {
  const wrapStyle = { height, overflow: 'hidden' as const };

  if (Platform.OS === 'web') {
    return (
      <View style={wrapStyle}>
        {/* @ts-ignore — iframe is valid in RN-web */}
        <iframe
          src={uri}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            pointerEvents: interactive ? 'auto' : 'none',
          }}
          loading="lazy"
          allowFullScreen
          allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; magnetometer; microphone; payment; usb; xr-spatial-tracking"
          referrerPolicy="no-referrer-when-downgrade"
        />
        {!interactive && <View style={StyleSheet.absoluteFill} />}
      </View>
    );
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
        onMessage={(e) => {
          if (e.nativeEvent.data === 'sv_unavailable') onUnavailable?.();
        }}
        onShouldStartLoadWithRequest={(req) => isGoogleMapsUrl(req.url)}
        style={{ flex: 1, backgroundColor: '#e8e8e8' }}
      />
      {!interactive && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-only" />
      )}
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
}

interface NavMode {
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  travelmode: string;   // Google Maps API travelmode
  dirflg: string;       // legacy embed URL dirflg
  androidMode: string;  // google.navigation: mode param
  iosDirMode: string;   // comgooglemaps directionsmode param
}

const NAV_MODES: NavMode[] = [
  { labelKey: 'step.walk',          icon: 'walk-outline',     travelmode: 'walking',   dirflg: 'w', androidMode: 'w', iosDirMode: 'walking' },
  { labelKey: 'step.bike',          icon: 'bicycle-outline',  travelmode: 'bicycling', dirflg: 'b', androidMode: 'b', iosDirMode: 'bicycling' },
  { labelKey: 'step.publicTransport',icon: 'bus-outline',      travelmode: 'transit',   dirflg: 'r', androidMode: 'r', iosDirMode: 'transit' },
  { labelKey: 'step.drive',         icon: 'car-outline',      travelmode: 'driving',   dirflg: 'd', androidMode: 'd', iosDirMode: 'driving' },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const MAP_HEIGHT = 220;

// ─── Component ────────────────────────────────────────────────────────────────

export function StepContent({
  step,
  isCompleted,
  isActive,
  isExpanded,
  onComplete,
  langcode,
}: StepContentProps) {
  const { t } = useTranslation();

  const [confirmed, setConfirmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [routeActive, setRouteActive] = useState(false);
  // Hide Street View if Google reports no panorama at this location
  const [svAvailable, setSvAvailable] = useState(true);

  const dirHeightAnim = useRef(new Animated.Value(0)).current;

  const descriptionText = step.description ?? '';
  const ttsLangcode = step.contentLangcode ?? langcode;
  const tts = useTTS(descriptionText, ttsLangcode);
  const isPlaying = tts.playState === 'playing';

  // Waveform animated bars
  const waveAnims = useRef(BAR_HEIGHTS.map(() => new Animated.Value(0.4))).current;
  const waveLoops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (isPlaying) {
      waveLoops.current = waveAnims.map((anim, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 280 + i * 35, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.25, duration: 280 + i * 35, useNativeDriver: true }),
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

  const prevExpandedRef = useRef(isExpanded);
  useEffect(() => {
    if (prevExpandedRef.current && !isExpanded) tts.handleStop();
    prevExpandedRef.current = isExpanded;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  useEffect(() => {
    if (confirmed) tts.prefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed]);

  useEffect(() => {
    if (isCompleted) {
      setConfirmed(false);
      setExpanded(false);
      setSelectedMode(null);
      setRouteActive(false);
      dirHeightAnim.setValue(0);
    }
  }, [isCompleted]);

  const hasLocation = !!step.location;

  // Street View panorama — output=svembed shows the actual 360° panorama
  const streetViewUrl = step.location
    ? `https://maps.google.com/maps?q=&layer=c&cbll=${step.location.lat},${step.location.lon}&cbp=12,0,0,0,0&output=svembed&hl=es`
    : null;

  // Static location map for confirmed state
  const staticMapUrl = step.location
    ? `https://maps.google.com/maps?q=${step.location.lat},${step.location.lon}&z=17&output=embed`
    : null;

  // Directions embed — static preview (non-interactive), shows route
  const activeMode = NAV_MODES.find((m) => m.travelmode === selectedMode);
  const directionsUrl = step.location && activeMode
    ? `https://maps.google.com/maps?saddr=My+Location&daddr=${step.location.lat},${step.location.lon}&dirflg=${activeMode.dirflg}&output=embed`
    : null;

  const handleModeSelect = (mode: NavMode) => {
    if (selectedMode === mode.travelmode) {
      // Collapse — reset route too
      setRouteActive(false);
      Animated.timing(dirHeightAnim, { toValue: 0, duration: 260, useNativeDriver: false }).start(
        () => setSelectedMode(null)
      );
    } else {
      setSelectedMode(mode.travelmode);
      setRouteActive(false);
      Animated.timing(dirHeightAnim, { toValue: MAP_HEIGHT, duration: 320, useNativeDriver: false }).start();
    }
  };

  const handleStopRoute = () => {
    setRouteActive(false);
    Animated.timing(dirHeightAnim, { toValue: 0, duration: 260, useNativeDriver: false }).start(
      () => setSelectedMode(null)
    );
  };

  const handleStartNavigation = async () => {
    if (!step.location || !activeMode) return;
    const { lat, lon } = step.location;

    // Request foreground location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Ubicación necesaria',
        'Para iniciar la navegación necesitamos acceder a tu ubicación actual.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir configuración', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    // Get current position
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude: uLat, longitude: uLon } = pos.coords;

    // Web fallback URL (opens in browser tab)
    const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${uLat},${uLon}&destination=${lat},${lon}&travelmode=${activeMode.travelmode}`;

    if (Platform.OS === 'ios') {
      const gmUrl = `comgooglemaps://?saddr=${uLat},${uLon}&daddr=${lat},${lon}&directionsmode=${activeMode.iosDirMode}`;
      const canGm = await Linking.canOpenURL(gmUrl).catch(() => false);
      if (canGm) {
        Linking.openURL(gmUrl);
      } else {
        // Fall back to Apple Maps
        Linking.openURL(
          `https://maps.apple.com/?saddr=${uLat},${uLon}&daddr=${lat},${lon}&dirflg=${activeMode.androidMode}`
        );
      }
    } else if (Platform.OS === 'android') {
      const gmUrl = `google.navigation:q=${lat},${lon}&mode=${activeMode.androidMode}`;
      const canGm = await Linking.canOpenURL(gmUrl).catch(() => false);
      Linking.openURL(canGm ? gmUrl : webUrl);
    } else {
      // Web — opens Google Maps in new tab
      Linking.openURL(webUrl);
    }

    setRouteActive(true);
  };

  // ── ACTIVE (not yet confirmed) ──────────────────────────────────────────────
  if (!confirmed && !isCompleted) {
    return (
      <View style={styles.container}>

        {/* Street View — shown only if a panorama is available */}
        {hasLocation && streetViewUrl && svAvailable ? (
          <View style={styles.svBlock}>
            {/* Badge ABOVE the embed so it never overlaps */}
            <View style={styles.svTagRow}>
              <View style={styles.svTag}>
                <View style={styles.svDot} />
                <Text style={styles.svTagText}>{t('step.locationView')}</Text>
              </View>
            </View>
            <View style={styles.mapOuter}>
              <GoogleEmbed
                uri={streetViewUrl}
                height={320}
                interactive
                onUnavailable={() => setSvAvailable(false)}
              />
            </View>
          </View>
        ) : null}

        {/* CÓMO LLEGAR section */}
        {hasLocation ? (
          <>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionLabelText}>{t('step.howToGet')}</Text>
              <View style={styles.sectionLine} />
            </View>

            {/* Transport chips */}
            <View style={styles.chipsRow}>
              {NAV_MODES.map((mode) => {
                const active = selectedMode === mode.travelmode;
                return (
                  <TouchableOpacity
                    key={mode.travelmode}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => handleModeSelect(mode)}
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

            {/* Directions map — animated height container */}
            <Animated.View
              style={[
                styles.directionsWrap,
                {
                  height: dirHeightAnim,
                  opacity: dirHeightAnim.interpolate({ inputRange: [0, 80], outputRange: [0, 1] }),
                },
              ]}
            >
              {directionsUrl ? (
                <GoogleEmbed uri={directionsUrl} height={MAP_HEIGHT} interactive={false} />
              ) : null}
            </Animated.View>

            {/* Iniciar / Parar — visible whenever a mode is selected */}
            {selectedMode ? (
              <View style={styles.routeActions}>
                {!routeActive ? (
                  <TouchableOpacity
                    style={styles.startRouteBtn}
                    onPress={handleStartNavigation}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="navigate" size={16} color="#ffffff" />
                    <Text style={styles.startRouteBtnText}>Iniciar navegación</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.stopRouteBtn}
                    onPress={handleStopRoute}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="stop-circle" size={16} color="#ffffff" />
                    <Text style={styles.stopRouteBtnText}>Parar navegación</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </>
        ) : null}

        {/* Geo-pop inline — always visible when active */}
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
              <View style={styles.geoPopBtns}>
                <TouchableOpacity
                  style={styles.geoPopYes}
                  onPress={() => setConfirmed(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  <Text style={styles.geoPopYesText}>{t('step.confirmYes')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.geoPopNo} activeOpacity={0.7}>
                  <Text style={styles.geoPopNoText}>{t('step.notYet')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  // ── CONFIRMED (or completed) ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Static location map */}
      {hasLocation && staticMapUrl ? (
        <View style={styles.mapOuter}>
          <GoogleEmbed uri={staticMapUrl} height={140} interactive={false} />
          <View style={styles.svTag}>
            <View style={styles.svDot} />
            <Text style={styles.svTagText}>{step.title}</Text>
          </View>
        </View>
      ) : null}

      {/* Dark TTS player */}
      {descriptionText ? (
        <View style={styles.playerCard}>
          <View style={styles.playerRow}>
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
                <View style={styles.waveDivider} />
                {[6, 11, 5, 9, 12, 7].map((h, i) => (
                  <View
                    key={`r${i}`}
                    style={[styles.waveBar, { height: h, backgroundColor: 'rgba(255,255,255,0.12)' }]}
                  />
                ))}
              </View>
              <View style={styles.playerTimes}>
                <Text style={styles.playerTimeActive}>{formatTime(tts.elapsed)}</Text>
                <Text style={styles.playerTimeDim}>{formatTime(tts.totalDuration)}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={tts.handleSpeedChange} style={styles.speedChip} activeOpacity={0.7}>
              <Text style={styles.speedChipText}>{SPEEDS[tts.speedIndex]}x</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Description */}
      {descriptionText ? (
        <View style={styles.descCard}>
          <View style={styles.descHeader}>
            <Text style={styles.descHeaderText}>{t('step.aboutStop')}</Text>
            <View style={styles.descHeaderLine} />
          </View>
          <Text style={styles.descText} numberOfLines={expanded ? undefined : PREVIEW_LINES}>
            {descriptionText}
          </Text>
          {descriptionText.length > 200 ? (
            <TouchableOpacity style={styles.readMoreBtn} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
              <Ionicons name={expanded ? 'remove-outline' : 'add-outline'} size={11} color={ORANGE} />
              <Text style={styles.readMoreText}>
                {expanded ? t('step.readLess') : t('step.readMore')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {step.featuredBusiness ? <BusinessCard business={step.featuredBusiness} /> : null}

      {hasLocation && step.location ? (
        <NearbyPlaces location={step.location} visible={confirmed || isCompleted} />
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

  // Street View block (badge + embed stacked vertically)
  svBlock: {
    gap: 6,
  },
  svTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Map/SV embed wrapper
  mapOuter: {
    position: 'relative',
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e1d8',
  },

  // Badge (used both in svTagRow above and overlaid on static map)
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
    // When used as absolute overlay (confirmed state):
    position: undefined,
  },
  svTagAbsolute: {
    position: 'absolute',
    top: 7,
    left: 8,
    zIndex: 10,
  },
  svDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ff4040',
  },
  svTagText: {
    fontSize: 9,
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
    fontSize: 9,
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
    fontSize: 9,
    fontWeight: '700',
    color: '#78716c',
    textAlign: 'center',
  },
  chipTextActive: {
    color: ORANGE,
  },

  // Directions animated container — map only, no overflow clipping issue
  directionsWrap: {
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e1d8',
  },

  // Start / Stop — outside animated container, always fully visible
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
  stopRouteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    backgroundColor: '#374151',
    borderRadius: 10,
  },
  stopRouteBtnText: {
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
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  geoPopSub: {
    fontSize: 10,
    color: '#a16207',
    marginBottom: 5,
  },
  geoPopBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  geoPopYes: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: ORANGE,
    borderRadius: 8,
    paddingVertical: 7,
  },
  geoPopYesText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  geoPopNo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e5e1d8',
    borderRadius: 8,
    paddingVertical: 7,
  },
  geoPopNoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78716c',
  },

  playerCard: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    padding: 11,
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
    fontSize: 11,
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
  waveDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 2,
  },
  playerTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  playerTimeActive: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.62)',
    fontVariant: ['tabular-nums'] as any,
  },
  playerTimeDim: {
    fontSize: 9,
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
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
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
    fontSize: 9,
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
    fontSize: 13,
    color: '#44403c',
    lineHeight: 20,
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: ORANGE,
  },

  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    backgroundColor: '#22c55e',
    borderRadius: 11,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  completeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
