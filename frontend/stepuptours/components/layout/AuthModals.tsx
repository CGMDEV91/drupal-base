// components/layout/AuthModals.tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/auth.store';

interface Props {
  visible: 'login' | 'register' | null;
  onClose: () => void;
  onSwitch: (mode: 'login' | 'register') => void;
}

// ── Campo de texto reutilizable ───────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, secureTextEntry, autoCapitalize, keyboardType, error,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address';
  error?: string;
}) {
  const [showPass, setShowPass] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1.5, borderColor: error ? '#EF4444' : '#E5E7EB',
        borderRadius: 12, backgroundColor: '#F9FAFB',
        paddingHorizontal: 14,
      }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={isPassword && !showPass}
          autoCapitalize={autoCapitalize ?? 'none'}
          keyboardType={keyboardType ?? 'default'}
          style={{
            flex: 1,
            fontSize: 14,
            color: '#111827',
            paddingVertical: Platform.OS === 'web' ? 12 : 10,
          }}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={{ padding: 4 }}>
            <Text style={{ fontSize: 16, color: '#9CA3AF' }}>{showPass ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>{error}</Text>
      ) : null}
    </View>
  );
}

// ── Modal Login ───────────────────────────────────────────────────────────────
function LoginModal({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const { signIn, isLoading, error, clearError } = useAuthStore();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});

  const validate = () => {
    const errors: typeof fieldErrors = {};
    if (!username.trim()) errors.username = t('auth.usernameRequired');
    if (!password) errors.password = t('auth.passwordRequired');
    setFieldErrors(errors);
    return !Object.keys(errors).length;
  };

  const handleSubmit = async () => {
    clearError();
    if (!validate()) return;
    await signIn({ username: username.trim(), password });
    if (!useAuthStore.getState().error) onClose();
  };

  return (
    <View style={modalStyles.sheet}>
      {/* Cabecera */}
      <View style={modalStyles.header}>
        <View>
          <Text style={modalStyles.title}>{t('auth.welcome')}</Text>
          <Text style={modalStyles.subtitle}>{t('auth.loginSubtitle')}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
          <Text style={modalStyles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Error global */}
      {error ? (
        <View style={modalStyles.errorBanner}>
          <Text style={modalStyles.errorBannerText}>⚠️ {error}</Text>
        </View>
      ) : null}

      {/* Campos */}
      <Field
        label={t('auth.username')}
        value={username}
        onChangeText={setUsername}
        placeholder={t('auth.usernamePlaceholder')}
        error={fieldErrors.username}
      />
      <Field
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.passwordPlaceholder')}
        secureTextEntry
        error={fieldErrors.password}
      />

      {/* Botón principal */}
      <TouchableOpacity
        style={[modalStyles.btnPrimary, isLoading && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={modalStyles.btnPrimaryText}>{t('auth.login')}</Text>
        )}
      </TouchableOpacity>

      {/* Link a registro */}
      <View style={modalStyles.switchRow}>
        <Text style={modalStyles.switchText}>{t('auth.noAccount')}</Text>
        <TouchableOpacity onPress={onSwitch}>
          <Text style={modalStyles.switchLink}>{t('auth.switchToRegister')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Modal Registro ────────────────────────────────────────────────────────────
function RegisterModal({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const { signUp, isLoading, error, clearError } = useAuthStore();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string; email?: string; password?: string; confirm?: string;
  }>({});

  const validate = () => {
    const errors: typeof fieldErrors = {};
    if (!username.trim()) errors.username = t('auth.usernameRequired');
    else if (username.trim().length < 3) errors.username = t('auth.usernameMinLength');
    if (!email.trim()) errors.email = t('auth.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = t('auth.emailInvalid');
    if (!password) errors.password = t('auth.passwordRequired');
    else if (password.length < 8) errors.password = t('auth.passwordMinLength');
    if (password !== confirm) errors.confirm = t('auth.passwordMismatch');
    setFieldErrors(errors);
    return !Object.keys(errors).length;
  };

  const handleSubmit = async () => {
    clearError();
    if (!validate()) return;
    await signUp({ username: username.trim(), email: email.trim(), password });
    if (!useAuthStore.getState().error) onClose();
  };

  return (
    <View style={modalStyles.sheet}>
      {/* Cabecera */}
      <View style={modalStyles.header}>
        <View>
          <Text style={modalStyles.title}>{t('auth.createAccount')}</Text>
          <Text style={modalStyles.subtitle}>{t('auth.joinSubtitle')}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
          <Text style={modalStyles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Error global */}
      {error ? (
        <View style={modalStyles.errorBanner}>
          <Text style={modalStyles.errorBannerText}>⚠️ {error}</Text>
        </View>
      ) : null}

      {/* Campos */}
      <Field
        label={t('auth.username')}
        value={username}
        onChangeText={setUsername}
        placeholder={t('auth.usernamePlaceholder')}
        error={fieldErrors.username}
      />
      <Field
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        error={fieldErrors.email}
      />
      <Field
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.passwordPlaceholder')}
        secureTextEntry
        error={fieldErrors.password}
      />
      <Field
        label={t('auth.confirmPassword')}
        value={confirm}
        onChangeText={setConfirm}
        placeholder={t('auth.confirmPasswordPlaceholder')}
        secureTextEntry
        error={fieldErrors.confirm}
      />

      {/* Botón principal */}
      <TouchableOpacity
        style={[modalStyles.btnPrimary, isLoading && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={modalStyles.btnPrimaryText}>{t('auth.register')}</Text>
        )}
      </TouchableOpacity>

      {/* Link a login */}
      <View style={modalStyles.switchRow}>
        <Text style={modalStyles.switchText}>{t('auth.hasAccount')}</Text>
        <TouchableOpacity onPress={onSwitch}>
          <Text style={modalStyles.switchLink}>{t('auth.switchToLogin')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function AuthModals({ visible, onClose, onSwitch }: Props) {
  const { clearError } = useAuthStore();

  const handleClose = () => {
    clearError();
    onClose();
  };

  return (
    <Modal
      visible={visible !== null}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={handleClose}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <Pressable style={{ width: '100%', maxWidth: 440 }} onPress={() => {}}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {visible === 'login' ? (
                <LoginModal
                  onClose={handleClose}
                  onSwitch={() => { clearError(); onSwitch('register'); }}
                />
              ) : (
                <RegisterModal
                  onClose={handleClose}
                  onSwitch={() => { clearError(); onSwitch('login'); }}
                />
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const modalStyles = {
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 20px 60px rgba(0,0,0,0.18)' } as any
      : { elevation: 16 }),
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '700' as const, color: '#111827', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6', alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  closeBtnText: { fontSize: 13, color: '#6B7280' },
  errorBanner: {
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorBannerText: { color: '#B91C1C', fontSize: 13 },
  btnPrimary: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14, borderRadius: 14,
    alignItems: 'center' as const, marginTop: 4, marginBottom: 16,
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
  switchRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  switchText: { fontSize: 14, color: '#6B7280' },
  switchLink: { fontSize: 14, color: '#F59E0B', fontWeight: '600' as const },
};
