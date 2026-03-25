// components/shared/ImagePickerField.tsx
// Reusable image pick + preview component for forms.
// Web:    hidden <input type="file"> triggered by a styled button
// Native: expo-image-picker launchImageLibraryAsync

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

export interface ImagePickerFieldProps {
  /** Existing image URL shown in edit mode before a new file is selected */
  currentImageUrl?: string | null;
  /** Called when the user picks a new image */
  onImageSelected: (uri: string, filename: string) => void;
  /** Called when the user removes the current/selected image */
  onImageCleared: () => void;
  label?: string;
}

const AMBER = '#F59E0B';

export function ImagePickerField({
  currentImageUrl,
  onImageSelected,
  onImageCleared,
  label = 'Image',
}: ImagePickerFieldProps) {
  // Web: reference to the hidden <input type="file"> element
  const fileInputRef = useRef<any>(null);

  const handlePickWeb = useCallback(() => {
    if (Platform.OS !== 'web') return;

    // Create a temporary file input and trigger it
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file: File = e.target?.files?.[0];
      if (!file) return;
      const uri = URL.createObjectURL(file);
      onImageSelected(uri, file.name);
    };
    input.click();
  }, [onImageSelected]);

  const handlePickNative = useCallback(async () => {
    try {
      // Dynamically import expo-image-picker to avoid web bundle issues
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      // Derive filename from URI or use a safe fallback
      const filename = asset.fileName ?? uri.split('/').pop() ?? 'photo.jpg';
      onImageSelected(uri, filename);
    } catch {
      // expo-image-picker not available — silently skip
    }
  }, [onImageSelected]);

  const handlePick = Platform.OS === 'web' ? handlePickWeb : handlePickNative;

  const previewUri = currentImageUrl ?? null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      {previewUri ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: previewUri }}
            style={styles.preview}
            contentFit="cover"
          />
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={handlePick}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal-outline" size={14} color={AMBER} />
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={onImageCleared}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={14} color="#EF4444" />
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.pickBtn}
          onPress={handlePick}
          activeOpacity={0.8}
        >
          <Ionicons name="image-outline" size={22} color="#9CA3AF" />
          <Text style={styles.pickBtnText}>Select image</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  pickBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pickBtnText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  previewContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  preview: {
    width: '100%',
    height: 160,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AMBER,
  },
  changeBtnText: {
    fontSize: 13,
    color: AMBER,
    fontWeight: '600',
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  removeBtnText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
});
