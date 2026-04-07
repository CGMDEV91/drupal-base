// components/layout/BackButton.tsx
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface BackButtonProps {
  onPress?: () => void;
  color?: string;
  /** Background color of the circle. Defaults to rgba(255,255,255,0.15) (for dark backgrounds). */
  bgColor?: string;
  /** Fallback route when there is no navigation history (e.g. direct page load) */
  fallbackRoute?: string;
  /** Circle diameter. Defaults to 36. */
  size?: number;
}

export default function BackButton({
  onPress,
  color = '#FFFFFF',
  bgColor = 'rgba(255,255,255,0.15)',
  fallbackRoute,
  size = 36,
}: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (router.canGoBack()) {
      router.back();
    } else if (fallbackRoute) {
      router.replace(fallbackRoute as any);
    } else {
      router.back();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="arrow-back" size={20} color={color} />
    </TouchableOpacity>
  );
}
