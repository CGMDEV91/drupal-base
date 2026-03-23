// components/layout/AuthModals.tsx
import { useState, useRef } from 'react';
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
  StyleSheet,
  useWindowDimensions,
  TextInput as RNTextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/auth.store';

interface Props {
  visible: 'login' | 'register' | null;
  onClose: () => void;
  onSwitch: (mode: 'login' | 'register') => void;
}

// ── Campo de texto reutilizable ───────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, secureTextEntry, autoCapitalize,
  keyboardType, error, onSubmitEditing, returnKeyType, inputRef,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address';
  error?: string;
  onSubmitEditing?: () => void;
  returnKeyType?: 'next' | 'go' | 'done';
  inputRef?: React.RefObject<RNTextInput>;
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
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={isPassword && !showPass}
          autoCapitalize={autoCapitalize ?? 'none'}
          keyboardType={keyboardType ?? 'default'}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType ?? 'done'}
          blurOnSubmit={returnKeyType !== 'next'}
          style={{
            flex: 1,
            fontSize: 14,
            color: '#111827',
            paddingVertical: Platform.OS === 'web' ? 12 : 10,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
          }}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={{ padding: 4 }}>
            <Ionicons
              name={showPass ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color="#9CA3AF"
            />
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
function LoginModal({ onClose, onSwitch, fullscreen }: { onClose: () => void; onSwitch: () => void; fullscreen?: boolean }) {
  const { signIn, isLoading, error, clearError } = useAuthStore();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const passwordRef = useRef<RNTextInput>(null);

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
    <View style={[modalStyles.sheet, fullscreen && modalStyles.sheetFullscreen]}>
      {/* Cabecera */}
      <View style={modalStyles.header}>
        <View>
          <Text style={modalStyles.title}>{t('auth.welcome')}</Text>
          <Text style={modalStyles.subtitle}>{t('auth.loginSubtitle')}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
          <Ionicons name="close" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Error global */}
      {error ? (
        <View style={modalStyles.errorBanner}>
          <Ionicons name="alert-circle" size={14} color="#B91C1C" style={{ marginRight: 6 }} />
          <Text style={modalStyles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {/* Campos */}
      <Field
        label={t('auth.username')}
        value={username}
        onChangeText={setUsername}
        placeholder={t('auth.usernamePlaceholder')}
        error={fieldErrors.username}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Field
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.passwordPlaceholder')}
        secureTextEntry
        error={fieldErrors.password}
        inputRef={passwordRef}
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
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
function RegisterModal({ onClose, onSwitch, fullscreen }: { onClose: () => void; onSwitch: () => void; fullscreen?: boolean }) {
  const { signUp, isLoading, error, clearError } = useAuthStore();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [publicName, setPublicName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<'traveller' | 'professional'>('traveller');
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string; publicName?: string; email?: string; password?: string; confirm?: string;
  }>({});
  const publicNameRef = useRef<RNTextInput>(null);
  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);
  const confirmRef = useRef<RNTextInput>(null);

  const validate = () => {
    const errors: typeof fieldErrors = {};
    const trimmedUsername = username.trim();
    if (!trimmedUsername) errors.username = t('auth.usernameRequired');
    else if (trimmedUsername.length < 3) errors.username = t('auth.usernameMinLength');
    else if (/\s/.test(trimmedUsername)) errors.username = t('auth.usernameNoSpaces');
    else if (!/^[a-zA-Z0-9@.\-_]+$/.test(trimmedUsername)) errors.username = t('auth.usernameInvalidChars');
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
    await signUp({
      username: username.trim(),
      publicName: publicName.trim() || undefined,
      email: email.trim(),
      password,
      role: role === 'professional' ? 'professional' : undefined,
    });
    if (!useAuthStore.getState().error) onClose();
  };

  return (
    <View style={[modalStyles.sheet, fullscreen && modalStyles.sheetFullscreen]}>
      {/* Cabecera */}
      <View style={modalStyles.header}>
        <View>
          <Text style={modalStyles.title}>{t('auth.createAccount')}</Text>
          <Text style={modalStyles.subtitle}>{t('auth.joinSubtitle')}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
          <Ionicons name="close" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Error global */}
      {error ? (
        <View style={modalStyles.errorBanner}>
          <Ionicons name="alert-circle" size={14} color="#B91C1C" style={{ marginRight: 6 }} />
          <Text style={modalStyles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {/* Selector de rol */}
      <View style={roleStyles.container}>
        <Text style={roleStyles.label}>{t('auth.roleLabel')}</Text>
        <View style={roleStyles.row}>
          <TouchableOpacity
            style={[roleStyles.card, role === 'traveller' && roleStyles.cardSelected]}
            onPress={() => setRole('traveller')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-outline"
              size={22}
              color={role === 'traveller' ? '#F59E0B' : '#9CA3AF'}
            />
            <Text style={[roleStyles.cardTitle, role === 'traveller' && roleStyles.cardTitleSelected]}>
              {t('auth.roleTraveller')}
            </Text>
            <Text style={roleStyles.cardHint}>{t('auth.roleTravellerHint')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[roleStyles.card, role === 'professional' && roleStyles.cardSelected]}
            onPress={() => setRole('professional')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="briefcase-outline"
              size={22}
              color={role === 'professional' ? '#F59E0B' : '#9CA3AF'}
            />
            <Text style={[roleStyles.cardTitle, role === 'professional' && roleStyles.cardTitleSelected]}>
              {t('auth.roleProfessional')}
            </Text>
            <Text style={roleStyles.cardHint}>{t('auth.roleProfessionalHint')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Campos */}
      <Field
        label={t('auth.username')}
        value={username}
        onChangeText={setUsername}
        placeholder={t('auth.usernamePlaceholder')}
        error={fieldErrors.username}
        returnKeyType="next"
        onSubmitEditing={() => publicNameRef.current?.focus()}
      />
      <Field
        label={t('auth.publicName')}
        value={publicName}
        onChangeText={setPublicName}
        placeholder={t('auth.publicNamePlaceholder')}
        autoCapitalize="sentences"
        error={fieldErrors.publicName}
        inputRef={publicNameRef}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <Field
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        error={fieldErrors.email}
        inputRef={emailRef}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Field
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.passwordPlaceholder')}
        secureTextEntry
        error={fieldErrors.password}
        inputRef={passwordRef}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <Field
        label={t('auth.confirmPassword')}
        value={confirm}
        onChangeText={setConfirm}
        placeholder={t('auth.confirmPasswordPlaceholder')}
        secureTextEntry
        error={fieldErrors.confirm}
        inputRef={confirmRef}
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
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
  const { height, width } = useWindowDimensions();
  const isMobile = width < 768;

  const handleClose = () => {
    clearError();
    onClose();
  };

  const loginModal = (
    <LoginModal
      onClose={handleClose}
      onSwitch={() => { clearError(); onSwitch('register'); }}
      fullscreen={isMobile}
    />
  );
  const registerModal = (
    <RegisterModal
      onClose={handleClose}
      onSwitch={() => { clearError(); onSwitch('login'); }}
      fullscreen={isMobile}
    />
  );

  return (
    <Modal
      visible={visible !== null}
      transparent
      animationType={isMobile ? 'slide' : 'fade'}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {isMobile ? (
          // ── Mobile: fullscreen ──────────────────────────────────────────
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1, backgroundColor: '#fff' }}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {visible === 'login' ? loginModal : registerModal}
          </ScrollView>
        ) : (
          // ── Desktop: centred card ───────────────────────────────────────
          <Pressable
            onPress={handleClose}
            focusable={false}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.45)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 20,
            }}
          >
            <Pressable
              style={{
                width: '100%',
                maxWidth: 440,
                maxHeight: height * 0.9,
                borderRadius: 24,
                overflow: 'hidden',
              }}
              onPress={() => {}}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {visible === 'login' ? loginModal : registerModal}
              </ScrollView>
            </Pressable>
          </Pressable>
        )}
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
  sheetFullscreen: {
    borderRadius: 0,
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
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
  errorBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorBannerText: { color: '#B91C1C', fontSize: 13, flex: 1 },
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

// ── Estilos del selector de rol ───────────────────────────────────────────────
const roleStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  cardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 6,
    textAlign: 'center',
  },
  cardTitleSelected: {
    color: '#D97706',
  },
  cardHint: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 3,
    textAlign: 'center',
  },
});
