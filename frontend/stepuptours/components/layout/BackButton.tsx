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
}

export default function BackButton({
  onPress,
  color = '#FFFFFF',
  bgColor = 'rgba(255,255,255,0.15)',
  fallbackRoute,
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
      style={[styles.button, { backgroundColor: bgColor }]}
    >
      <Ionicons name="arrow-back" size={20} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
