# Skill: Responsive Design — NativeWind + React Native

Stack tech. Diseño responsive multi-plataforma: iOS, Android, Web.

---

## NativeWind (Tailwind en React Native)

NativeWind convierte clases Tailwind en estilos de React Native.

### Setup en el proyecto
```
frontend/stepuptours/tailwind.config.js  ✓
package.json: nativewind, tailwindcss    ✓
babel.config.js: plugin de NativeWind    ✓
```

### Uso básico
```typescript
import { View, Text } from 'react-native';

<View className="flex-1 bg-gray-50 p-4">
  <Text className="text-2xl font-bold text-gray-900">Título</Text>
  <Text className="text-sm text-gray-500 mt-1">Subtítulo</Text>
</View>
```

### Clases más usadas en React Native

| CSS | NativeWind | Efecto |
|-----|-----------|--------|
| `flex: 1` | `flex-1` | Ocupa espacio disponible |
| `flex-direction: row` | `flex-row` | Layout horizontal |
| `align-items: center` | `items-center` | Centrar vertical |
| `justify-content: between` | `justify-between` | Espacio entre items |
| `gap: 8px` | `gap-2` | Espacio entre children |
| `border-radius: 12px` | `rounded-xl` | Bordes redondeados |
| `overflow: hidden` | `overflow-hidden` | Clip de contenido |
| `position: absolute` | `absolute` | Posición absoluta |

---

## Sistema de Breakpoints Responsivos

NativeWind soporta breakpoints, pero en RN el enfoque recomendado es `useWindowDimensions`:

```typescript
import { useWindowDimensions } from 'react-native';

function useBreakpoints() {
  const { width } = useWindowDimensions();
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    cols: width >= 1024 ? 4 : width >= 768 ? 3 : 2,
    padding: width >= 1024 ? 32 : 16,
  };
}
```

---

## Layout de Grid Responsivo

```typescript
function TourGrid({ tours }: { tours: Tour[] }) {
  const { width } = useWindowDimensions();
  const cols = width >= 1024 ? 4 : width >= 768 ? 3 : 2;
  const PADDING = width >= 1024 ? 32 : 16;
  const GAP = 12;
  const cardWidth = (width - PADDING * 2 - GAP * (cols - 1)) / cols;

  return (
    <FlatList
      data={tours}
      numColumns={cols}
      key={`grid-${cols}`}  // CRÍTICO: re-render al cambiar columnas
      columnWrapperStyle={cols > 1 ? { gap: GAP, paddingHorizontal: PADDING } : undefined}
      renderItem={({ item }) => <TourCard tour={item} width={cardWidth} />}
    />
  );
}
```

---

## Paleta de Colores del Proyecto

```typescript
// Colores principales (StepUp Tours brand)
const colors = {
  primary: '#F59E0B',      // Amber 400 — botones, accents
  primaryDark: '#D97706',  // Amber 600 — texto sobre claro
  primaryLight: '#FEF3C7', // Amber 100 — fondos suaves
  primaryBg: '#FFFBEB',    // Amber 50 — banner, cards fondo

  // Neutros
  bg: '#F9FAFB',           // Gray 50 — fondo app
  surface: '#FFFFFF',      // White — cards, header
  border: '#F3F4F6',       // Gray 100 — borders suaves
  borderMedium: '#E5E7EB', // Gray 200 — borders normales
  text: '#111827',         // Gray 900 — texto principal
  textSecondary: '#6B7280',// Gray 500 — texto secundario
  textMuted: '#9CA3AF',    // Gray 400 — placeholders

  // Estado
  error: '#EF4444',        // Red 500
  success: '#10B981',      // Emerald 500
  warning: '#F59E0B',      // Amber 400 (= primary)
};
```

---

## Sombras Cross-Platform

```typescript
const shadowStyle = Platform.OS === 'web'
  ? { boxShadow: '0 2px 12px rgba(0,0,0,0.08)' } as any
  : { elevation: 3 };  // Android

// iOS usa shadow* props
const iosShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
};
```

---

## Safe Area (Notch, Home Indicator)

```bash
npx expo install react-native-safe-area-context
```

```typescript
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Envolver en _layout.tsx
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack />
    </SafeAreaProvider>
  );
}

// En componente
function Header() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
      ...
    </View>
  );
}
```

---

## Typography Responsiva

```typescript
// utils/typography.ts
import { useWindowDimensions } from 'react-native';

export function useResponsiveFont() {
  const { width } = useWindowDimensions();
  const scale = Math.min(width / 375, 1.4); // 375 = base width (iPhone)
  return {
    title: Math.round(24 * scale),    // 24–34px
    heading: Math.round(18 * scale),  // 18–25px
    body: Math.round(14 * scale),     // 14–20px
    caption: Math.round(12 * scale),  // 12–17px
  };
}
```

---

## Componente Card Responsivo

```typescript
function TourCard({ tour, width }: { tour: Tour; width: number }) {
  const isCompact = width < 160;

  return (
    <View style={[styles.card, { width }]}>
      <View style={[styles.image, { height: isCompact ? 120 : 160 }]}>
        {tour.image
          ? <Image source={{ uri: tour.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <View style={styles.imagePlaceholder}><Text>🗺️</Text></View>
        }
        <View style={styles.overlay}>
          <Text style={styles.title} numberOfLines={isCompact ? 1 : 2}>{tour.title}</Text>
          {tour.city && !isCompact && (
            <Text style={styles.location} numberOfLines={1}>📍 {tour.city.name}</Text>
          )}
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.meta}>⏱ {tour.duration} min</Text>
        <StarRating value={tour.averageRate} />
      </View>
    </View>
  );
}
```

---

## Header Responsivo con Auth

```typescript
function AppHeader() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { user } = useAuthStore();
  const router = useRouter();

  return (
    <View style={[styles.header, { paddingHorizontal: isTablet ? 24 : 16 }]}>
      <Logo />

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <LanguageSelector />

        {user ? (
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <Text>{user.publicName}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button variant="outline" onPress={() => router.push('/auth/login')}>
              Iniciar Sesión
            </Button>
            {isTablet && (
              <Button variant="primary" onPress={() => router.push('/auth/register')}>
                Registrarse
              </Button>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
```

---

## Scroll Horizontal (Pills/Chips)

```typescript
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: 'row' }}
>
  {countries.map((c) => (
    <TouchableOpacity
      key={c.id}
      style={[
        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB' },
        filters.country === c.name && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
      ]}
      onPress={() => onSelectCountry(c.name)}
    >
      <Text style={[{ fontSize: 13, color: '#6B7280' }, filters.country === c.name && { color: '#fff' }]}>
        {c.name}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>
```

---

## Banner con SVG Background

```typescript
import Svg, { G, Circle, Path } from 'react-native-svg';

function Banner() {
  const { width } = useWindowDimensions();
  return (
    <View style={{ height: 280, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* Pattern de fondo */}
      <Svg width={width} height={280} style={StyleSheet.absoluteFillObject}>
        {/* Iconos decorativos con baja opacidad */}
      </Svg>
      {/* Contenido */}
      <View style={{ alignItems: 'center', zIndex: 1, paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 36, fontWeight: '800', color: '#D97706' }}>StepUp Tours</Text>
        <SearchBar />
      </View>
    </View>
  );
}
```

---

## Botones — Sistema de Variantes

```typescript
interface ButtonProps {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

const buttonStyles = {
  primary: { bg: '#F59E0B', text: '#fff', border: 'transparent' },
  outline: { bg: 'transparent', text: '#374151', border: '#E5E7EB' },
  ghost: { bg: 'transparent', text: '#F59E0B', border: 'transparent' },
};

const buttonSizes = {
  sm: { px: 12, py: 6, fontSize: 12, radius: 16 },
  md: { px: 16, py: 8, fontSize: 13, radius: 20 },
  lg: { px: 24, py: 12, fontSize: 15, radius: 24 },
};
```

---

## Web-specific CSS en React Native

Solo disponible con `Platform.OS === 'web'`:
```typescript
// Requiere casteo as any
const webStyle = Platform.OS === 'web' ? {
  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  backdropFilter: 'blur(8px)',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'transform 0.2s ease',
  ':hover': { transform: 'scale(1.02)' },
} as any : {};
```
