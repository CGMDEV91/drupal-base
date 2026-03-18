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
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
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

  const active = currentLanguage ?? FALLBACK_LANGUAGE;
  const list = languages?.length ? languages : [FALLBACK_LANGUAGE];

  const handleSelect = (language: Language) => {
    setLanguage(language);
    setOpen(false);
    // Reemplazar el primer segmento (langcode) en el pathname real con valores resueltos
    const newPath = pathname.replace(/^\/[^/]+/, `/${language.id}`);
    router.replace(newPath as any);
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor: '#E5E7EB',
          backgroundColor: '#fff',
        }}
      >
        <CountryFlag isoCode={langCodeToCountryCode(active.id)} size={12} />
        <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>{active.name}</Text>
        <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          <View
            style={{
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
            }}
          >
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#F3F4F6',
            }}>
              <Text style={{
                fontSize: 11,
                fontWeight: '600',
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}>
                Idioma
              </Text>
            </View>

            <FlatList
              data={list}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: active.id === item.id ? '#FFFBEB' : '#fff',
                  }}
                >
                  <CountryFlag isoCode={langCodeToCountryCode(item.id)} size={12} />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: active.id === item.id ? '600' : '400',
                    color: active.id === item.id ? '#D97706' : '#374151',
                    flex: 1,
                  }}>
                    {item.name}
                  </Text>
                  {active.id === item.id && (
                    <Text style={{ color: '#F59E0B', fontSize: 14 }}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}