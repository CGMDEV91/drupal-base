// components/layout/LanguageSelector.tsx
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Platform,
  Pressable,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguageStore } from '../../stores/language.store';
import { langCodeToCountryCode } from '../../services/language.service';
import type { Language } from '../../services/language.service';
import CountryFlag from 'react-native-country-flag';

const FALLBACK_LANGUAGE: Language = {
  id: 'es',
  name: 'Español',
  direction: 'ltr',
  isDefault: true,
};

export function LanguageSelector() {
  const [open, setOpen] = useState(false);
  const { languages, currentLanguage, setLanguage } = useLanguageStore();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const active = currentLanguage ?? FALLBACK_LANGUAGE;
  const list = languages?.length ? languages : [FALLBACK_LANGUAGE];

  const handleSelect = (language: Language) => {
    setLanguage(language);
    setOpen(false);
    const newPath = pathname.replace(/^\/[^/]+/, `/${language.id}`);
    router.replace(newPath as any);
  };

  return (
    <View>
      {/* ── Trigger ── */}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        style={styles.trigger}
      >
        <CountryFlag isoCode={langCodeToCountryCode(active.id)} size={12} />
        {!isMobile && (
          <Text style={styles.triggerLabel}>{active.name}</Text>
        )}
        <Text style={styles.triggerChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {isMobile ? (
        // ── Mobile: pantalla completa ──────────────────────────────────────
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.mobileFullscreen}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetHeaderText}>Idioma</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={list}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                  style={[styles.option, active.id === item.id && styles.optionActive]}
                >
                  <CountryFlag isoCode={langCodeToCountryCode(item.id)} size={18} />
                  <Text style={[styles.optionText, active.id === item.id && styles.optionTextActive]}>
                    {item.name}
                  </Text>
                  {active.id === item.id && <Text style={styles.optionCheck}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </Modal>
      ) : (
        // ── Desktop: dropdown flotante ─────────────────────────────────────
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable onPress={() => setOpen(false)} style={styles.backdrop}>
            <View style={styles.desktopDropdown}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetHeaderText}>Idioma</Text>
              </View>
              <FlatList
                data={list}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                    style={[styles.option, active.id === item.id && styles.optionActive]}
                  >
                    <CountryFlag isoCode={langCodeToCountryCode(item.id)} size={12} />
                    <Text style={[styles.optionText, active.id === item.id && styles.optionTextActive]}>
                      {item.name}
                    </Text>
                    {active.id === item.id && <Text style={styles.optionCheck}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Trigger ───────────────────────────────────────────────────────────────
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  triggerLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  triggerChevron: {
    fontSize: 10,
    color: '#9CA3AF',
  },

  // ── Backdrop ──────────────────────────────────────────────────────────────
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start', // sheet cae desde arriba
  },

  // ── Mobile fullscreen ─────────────────────────────────────────────────────
  mobileFullscreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
  },

  // ── Desktop dropdown ──────────────────────────────────────────────────────
  desktopDropdown: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 56 : 100,
    right: 16,
    minWidth: 190,
    maxHeight: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },

  // ── Shared header ─────────────────────────────────────────────────────────
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sheetClose: {
    fontSize: 16,
    color: '#6B7280',
    paddingHorizontal: 4,
  },

  // ── Options ───────────────────────────────────────────────────────────────
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  optionActive: {
    backgroundColor: '#FFFBEB',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#374151',
    flex: 1,
  },
  optionTextActive: {
    color: '#D97706',
    fontWeight: '600',
  },
  optionCheck: {
    color: '#F59E0B',
    fontSize: 14,
  },
});