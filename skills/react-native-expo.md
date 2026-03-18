# Skill: React Native + Expo

Stack tech. React Native 0.76, Expo 52, Expo Router 4. Referencia para desarrollo en este proyecto.

---

## Estructura de Routing (Expo Router)

File-based routing, similar a Next.js. Cada fichero en `app/` es una ruta.

```
app/
├── _layout.tsx          # Root layout (Stack navigator global)
├── (tabs)/              # Grupo de tabs (sin prefijo en URL)
│   ├── _layout.tsx      # Tab bar config
│   ├── index.tsx        # /  (home)
│   └── explore.tsx      # /explore
├── tour/
│   └── [id].tsx         # /tour/:id  (detalle de tour)
├── auth/
│   ├── login.tsx        # /auth/login
│   └── register.tsx     # /auth/register
├── profile.tsx          # /profile
└── +not-found.tsx       # 404
```

### Root Layout
```typescript
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="tour/[id]" options={{ title: 'Tour Detail' }} />
      <Stack.Screen name="auth/login" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
```

### Navegación
```typescript
import { useRouter, useLocalSearchParams } from 'expo-router';

// Push
const router = useRouter();
router.push('/tour/abc-123');
router.push({ pathname: '/tour/[id]', params: { id: tour.id } });

// Reemplazar (sin historial)
router.replace('/auth/login');

// Volver
router.back();

// Parámetros en la ruta
const { id } = useLocalSearchParams<{ id: string }>();
```

---

## Tabs Layout
```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#F59E0B' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explorar',
          headerShown: false,
          tabBarIcon: ({ color }) => <MaterialIcons name="explore" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Mi Perfil',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

---

## expo-image (preferido sobre Image de RN)

```typescript
import { Image } from 'expo-image';

<Image
  source={{ uri: 'https://...' }}
  style={{ width: 300, height: 200 }}
  contentFit="cover"        // object-fit
  placeholder={blurhash}    // blur placeholder
  transition={300}          // fade-in ms
  cachePolicy="memory-disk" // caché agresiva
/>
```

---

## FlatList para listas de performance

```typescript
<FlatList
  data={tours}
  keyExtractor={(item) => item.id}
  numColumns={cols}
  key={`grid-${cols}`}  // Forzar re-render al cambiar columnas
  columnWrapperStyle={cols > 1 ? { gap: 12, paddingHorizontal: 16 } : undefined}
  renderItem={({ item }) => <TourCard tour={item} />}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
  refreshControl={
    <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor="#F59E0B" />
  }
  ListHeaderComponent={<Header />}
  ListFooterComponent={hasMore ? <ActivityIndicator /> : null}
  ListEmptyComponent={<EmptyState />}
  contentContainerStyle={{ paddingBottom: 40 }}
  showsVerticalScrollIndicator={false}
/>
```

**Importante**: Cambiar `numColumns` en un FlatList existente requiere cambiar el `key` prop para re-renderizar completamente.

---

## Expo Location

```typescript
import * as Location from 'expo-location';

async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: location.coords.latitude, lon: location.coords.longitude };
}
```

---

## Animaciones con Reanimated 3

```typescript
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, FadeIn, SlideInDown
} from 'react-native-reanimated';

// Entering animation en componente
<Animated.View entering={FadeIn.duration(400)}>
  <TourCard />
</Animated.View>

// Animación interactiva
const scale = useSharedValue(1);
const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

const onPress = () => {
  scale.value = withSpring(0.95, {}, () => { scale.value = withSpring(1); });
};
```

---

## Expo Secure Store (credenciales)

```typescript
import * as SecureStore from 'expo-secure-store';

// Guardar (encriptado en keychain/keystore nativo)
await SecureStore.setItemAsync('auth_token', token);

// Leer
const token = await SecureStore.getItemAsync('auth_token');

// Borrar
await SecureStore.deleteItemAsync('auth_token');
```

Solo disponible en iOS/Android. En web usar `localStorage` con fallback.

---

## AsyncStorage (datos no sensibles)

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

await AsyncStorage.setItem('key', JSON.stringify(data));
const raw = await AsyncStorage.getItem('key');
const data = raw ? JSON.parse(raw) : null;
await AsyncStorage.removeItem('key');
```

---

## Platform-specific Code

```typescript
import { Platform } from 'react-native';

// Estilos por plataforma
const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'web' ? 14 : 50, // Safe area manual
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as any
      : { elevation: 3 }),
  }
});

// Código por plataforma
if (Platform.OS === 'ios') {
  // iOS specific
} else if (Platform.OS === 'android') {
  // Android specific
}
```

---

## useWindowDimensions — Responsive

```typescript
import { useWindowDimensions } from 'react-native';

function HomePage() {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const cols = isDesktop ? 4 : isTablet ? 3 : 2;
  const PADDING = isDesktop ? 32 : 16;
  const cardWidth = (width - PADDING * 2 - 12 * (cols - 1)) / cols;
}
```

---

## SVG con react-native-svg

```typescript
import Svg, { Path, Circle, G } from 'react-native-svg';

<Svg width={200} height={100}>
  <Circle cx="50" cy="50" r="40" stroke="#F59E0B" strokeWidth="2" fill="none" />
  <Path d="M10 50 L90 50" stroke="#F59E0B" strokeWidth="1.5" />
</Svg>
```

---

## app.json — Configuración Expo

```json
{
  "expo": {
    "name": "StepUp Tours",
    "slug": "stepuptours",
    "version": "1.0.0",
    "scheme": "stepuptours",
    "ios": {
      "bundleIdentifier": "com.stepuptours.app",
      "supportsTablet": true
    },
    "android": {
      "package": "com.stepuptours.app",
      "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png" }
    },
    "web": {
      "bundler": "metro"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-location", { "locationAlwaysAndWhenInUsePermission": "Allow location access" }]
    ]
  }
}
```

---

## Variables de Entorno

```
# .env (no commitear)
EXPO_PUBLIC_API_URL=https://stepuptours.ddev.site
```

En código:
```typescript
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';
```

Solo variables con `EXPO_PUBLIC_` prefix son accesibles en cliente. Sin proceso de build especial.

---

## Comandos Frecuentes

```bash
cd frontend/stepuptours
npx expo start            # Metro + QR code (Expo Go)
npx expo start --web      # Modo web
npx expo start --clear    # Limpiar caché de Metro
npx expo build:ios        # Build para App Store (EAS)
npx expo build:android    # Build para Play Store (EAS)
npx expo install          # Instalar deps compatible con versión de Expo
```
