// components/layout/ContactModal.tsx
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ContactModal({ visible, onClose }: ContactModalProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const subjectRef = useRef<TextInput>(null);
  const messageRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [success, onClose]);

  useEffect(() => {
    if (visible) {
      setEmail('');
      setSubject('');
      setMessage('');
      setError('');
      setSuccess(false);
    }
  }, [visible]);

  const handleSend = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subject, message }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isMobile ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      {isMobile ? (
        // ── Mobile: sheet desde abajo, ancho completo ──────────────────────
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.mobileWrapper}
        >
          <Pressable style={styles.mobileBackdrop} onPress={onClose} />
          <Pressable style={styles.mobileSheet} onPress={(e) => e.stopPropagation()}>
            {/* Handle */}
            <View style={styles.handle} />

            <ScrollView
              keyboardShouldPersistTaps="handled"
            >
              {/* Close */}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>

              <Text style={styles.title}>{t('contact.title')}</Text>

              {success ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{t('contact.success')}</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>{t('contact.email')}</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder={t('contact.email')}
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="next"
                    onSubmitEditing={() => subjectRef.current?.focus()}
                    blurOnSubmit={false}
                  />

                  <Text style={styles.label}>{t('contact.subject')}</Text>
                  <TextInput
                    ref={subjectRef}
                    style={styles.input}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder={t('contact.subject')}
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="next"
                    onSubmitEditing={() => messageRef.current?.focus()}
                    blurOnSubmit={false}
                  />

                  <Text style={styles.label}>{t('contact.message')}</Text>
                  <TextInput
                    ref={messageRef}
                    style={[styles.input, styles.textArea]}
                    value={message}
                    onChangeText={setMessage}
                    placeholder={t('contact.message')}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity
                    style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.sendButtonText}>{t('contact.send')}</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      ) : (
        // ── Desktop: modal centrado ────────────────────────────────────────
        <Pressable style={styles.overlay} onPress={onClose}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.centeredView}
          >
            <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>

                <Text style={styles.title}>{t('contact.title')}</Text>

                {success ? (
                  <View style={styles.successBox}>
                    <Text style={styles.successText}>{t('contact.success')}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.label}>{t('contact.email')}</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder={t('contact.email')}
                      placeholderTextColor="#9CA3AF"
                    />

                    <Text style={styles.label}>{t('contact.subject')}</Text>
                    <TextInput
                      style={styles.input}
                      value={subject}
                      onChangeText={setSubject}
                      placeholder={t('contact.subject')}
                      placeholderTextColor="#9CA3AF"
                    />

                    <Text style={styles.label}>{t('contact.message')}</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={message}
                      onChangeText={setMessage}
                      placeholder={t('contact.message')}
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity
                      style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                      onPress={handleSend}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.sendButtonText}>{t('contact.send')}</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ── Desktop ───────────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredView: {
    width: '100%',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 480,
    position: 'relative',
  },

  // ── Mobile ────────────────────────────────────────────────────────────────
  mobileWrapper: {
    flex: 1,
    justifyContent: 'flex-start', // ← cambia flex-end
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  mobileBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent', // el color ya está en mobileWrapper
  },
  mobileSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20, // ← todos los bordes redondeados
    margin: 16,       // ← margen lateral y separa del nav
    marginTop: 56 + 16, // ← altura navbar + espacio
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    width: undefined, // ← quita width 100% para que respete el margin
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },

  // ── Shared ────────────────────────────────────────────────────────────────
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  textArea: {
    minHeight: 100,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 8,
  },
  sendButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  successBox: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  successText: {
    color: '#065F46',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
    zIndex: 1,
  },
});