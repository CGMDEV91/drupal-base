// components/tour/NearbyPlaces.tsx
// Nearby POIs via Overpass API (OpenStreetMap) — free, no API key

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { GeoLocation } from '../../types';

// ─── Mirrors — se lanzan en PARALELO, gana el primero que responda ────────────
const OVERPASS_MIRRORS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const FETCH_TIMEOUT_MS = 10000;

interface NearbyPlacesProps {
  location: GeoLocation;
  visible: boolean;
}

interface OsmPlace {
  id:       number;
  lat:      number;
  lon:      number;
  name:     string;
  type:     string;
  distance: number;
  city?:    string;
  country?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function buildQuery(lat: number, lon: number): string {
  return `[out:json][timeout:8];(node(around:300,${lat},${lon})[name][amenity];node(around:300,${lat},${lon})[name][tourism];node(around:300,${lat},${lon})[name][shop];);out 8;`;
}

async function fetchFromMirror(mirror: string, query: string): Promise<any[]> {
  const url = `${mirror}?data=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const elements = data.elements ?? [];
    if (!Array.isArray(elements)) throw new Error('Invalid response');
    return elements;
  } finally {
    clearTimeout(timer);
  }
}

// Lanza todos los mirrors en paralelo — devuelve el más rápido
async function fetchWithRace(query: string): Promise<any[]> {
  return Promise.any(
    OVERPASS_MIRRORS.map((mirror) => fetchFromMirror(mirror, query))
  );
}

function mapElements(elements: any[], lat: number, lon: number): OsmPlace[] {
  return elements
    .map((el) => ({
      id:       el.id as number,
      lat:      el.lat as number,
      lon:      el.lon as number,
      name:     (el.tags?.name as string) ?? '',
      type:     (el.tags?.amenity || el.tags?.tourism || el.tags?.shop || 'place') as string,
      distance: haversineM(lat, lon, el.lat, el.lon),
      city:     (el.tags?.['addr:city'] || el.tags?.['addr:town'] || '') as string,
      country:  (el.tags?.['addr:country'] || '') as string,
    }))
    .filter((p) => p.name)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);
}

function categoryIcon(type: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    restaurant:       'restaurant-outline',
    cafe:             'cafe-outline',
    bar:              'wine-outline',
    fast_food:        'fast-food-outline',
    pharmacy:         'medical-outline',
    hospital:         'medkit-outline',
    bank:             'card-outline',
    atm:              'cash-outline',
    museum:           'library-outline',
    hotel:            'bed-outline',
    supermarket:      'cart-outline',
    convenience:      'storefront-outline',
    attraction:       'telescope-outline',
    place_of_worship: 'business-outline',
    park:             'leaf-outline',
    viewpoint:        'eye-outline',
    artwork:          'color-palette-outline',
    bakery:           'cafe-outline',
    clothes:          'shirt-outline',
    shoe_shop:        'footsteps-outline',
    bookshop:         'book-outline',
  };
  return map[type] ?? 'location-outline';
}

function categoryLabel(type: string): string {
  const labels: Record<string, string> = {
    restaurant:       'Restaurant',
    cafe:             'Café',
    bar:              'Bar',
    fast_food:        'Fast Food',
    pharmacy:         'Pharmacy',
    hospital:         'Hospital',
    bank:             'Bank',
    atm:              'ATM',
    museum:           'Museum',
    hotel:            'Hotel',
    supermarket:      'Supermarket',
    convenience:      'Shop',
    attraction:       'Attraction',
    place_of_worship: 'Monument',
    park:             'Park',
    viewpoint:        'Viewpoint',
    artwork:          'Artwork',
    bakery:           'Bakery',
    clothes:          'Clothing',
    bookshop:         'Bookshop',
  };
  return labels[type] ?? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function NearbyPlaces({ location, visible }: NearbyPlacesProps) {
  const { t } = useTranslation();
  const [places,  setPlaces]  = useState<OsmPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!visible || fetched) return;
    setFetched(true);
    setLoading(true);

    const query = buildQuery(location.lat, location.lon);

    fetchWithRace(query)
      .then((elements) => {
        setPlaces(mapElements(elements, location.lat, location.lon));
      })
      .catch(() => {
        // Todos los mirrors fallaron — silencioso, el componente no se muestra
      })
      .finally(() => {
        setLoading(false);
      });

    // Sin cleanup que aborte — evita el "aborted without reason" en Strict Mode
  }, [visible, fetched, location.lat, location.lon]);

  if (!visible || (!loading && places.length === 0)) return null;

  const openGoogleMaps = (p: OsmPlace) => {
    const context    = [p.city, p.country].filter(Boolean).join(', ');
    const searchTerm = context ? `${p.name}, ${context}` : p.name;
    const query      = encodeURIComponent(searchTerm);

    const url = Platform.select({
      ios:     `maps://?q=${query}&ll=${p.lat},${p.lon}`,
      android: `geo:${p.lat},${p.lon}?q=${query}`,
      default: `https://www.google.com/maps/search/${query}/@${p.lat},${p.lon},18z`,
    });

    Linking.openURL(url!).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>{t('step.nearby')}</Text>
        <View style={styles.headerLine} />
        <View style={styles.osmBadge}>
          <View style={styles.osmDot} />
          <Text style={styles.osmText}>{t('step.nearbyOsmBadge')}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#9CA3AF" />
          <Text style={styles.loadingText}>{t('step.nearbyLoading')}</Text>
        </View>
      ) : (
        places.map((place, index) => (
          <TouchableOpacity
            key={place.id}
            style={[styles.placeRow, index < places.length - 1 && styles.placeRowBorder]}
            onPress={() => openGoogleMaps(place)}
            activeOpacity={0.7}
          >
            <View style={styles.placeIcon}>
              <Ionicons name={categoryIcon(place.type)} size={16} color="#6B7280" />
            </View>
            <View style={styles.placeInfo}>
              <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
              <Text style={styles.placeType}>{categoryLabel(place.type)}</Text>
            </View>
            <View style={styles.placeRight}>
              <Text style={styles.placeDistance}>{place.distance}m</Text>
              <Ionicons name="chevron-forward" size={12} color="#D1D5DB" />
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  osmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    flexShrink: 0,
  },
  osmDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  osmText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#15803D',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
  },
  loadingText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  placeRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  placeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  placeInfo: {
    flex: 1,
    gap: 1,
  },
  placeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1917',
  },
  placeType: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  placeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  placeDistance: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
});
