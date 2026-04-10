// components/layout/AuthModals.tsx
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
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
import { getGoogleAccessToken } from '../../services/googleAuth.service';

interface Props {
  visible: 'login' | 'register' | null;
  onClose: () => void;
  onSwitch: (mode: 'login' | 'register') => void;
}

// ── Google "G" logo SVG ───────────────────────────────────────────────────────
const GoogleLogo = () => (
  // @ts-ignore
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    {/* @ts-ignore */}
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    {/* @ts-ignore */}
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    {/* @ts-ignore */}
    <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    {/* @ts-ignore */}
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

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
            fontSize: Platform.OS === 'web' ? 16 : 14,
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
function LoginModal({ onClose, onSwitch, fullscreen, desktopWeb }: { onClose: () => void; onSwitch: () => void; fullscreen?: boolean; desktopWeb?: boolean }) {
  const { signIn, signInWithGoogle, isLoading, error, clearError } = useAuthStore();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
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

  const handleGoogleAuth = async () => {
    setGoogleError(null);
    setGoogleLoading(true);
    try {
      const token = await getGoogleAccessToken();
      await signInWithGoogle(token);
      if (!useAuthStore.getState().error) onClose();
    } catch (e: any) {
      setGoogleError(e.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={[modalStyles.sheet, fullscreen && modalStyles.sheetFullscreen, desktopWeb && modalStyles.sheetDesktopWeb as any]}>
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

      {/* Botón Google */}
      <TouchableOpacity
        style={modalStyles.googleBtn}
        onPress={handleGoogleAuth}
        disabled={googleLoading || isLoading}
        activeOpacity={0.8}
      >
        {googleLoading ? (
          <ActivityIndicator size="small" color="#374151" />
        ) : (
          <>
            {Platform.OS === 'web' && <GoogleLogo />}
            <Text style={modalStyles.googleBtnText}>{t('auth.continueWithGoogle')}</Text>
          </>
        )}
      </TouchableOpacity>
      {googleError ? (
        <Text style={modalStyles.googleErrorText}>{googleError}</Text>
      ) : null}

      {/* Divider */}
      <View style={modalStyles.dividerRow}>
        <View style={modalStyles.dividerLine} />
        <Text style={modalStyles.dividerText}>{t('auth.orDivider')}</Text>
        <View style={modalStyles.dividerLine} />
      </View>

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
function RegisterModal({ onClose, onSwitch, fullscreen, desktopWeb }: { onClose: () => void; onSwitch: () => void; fullscreen?: boolean; desktopWeb?: boolean }) {
  const { signUp, signInWithGoogle, isLoading, error, clearError } = useAuthStore();
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
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

  const handleGoogleAuth = async () => {
    setGoogleError(null);
    setGoogleLoading(true);
    try {
      const token = await getGoogleAccessToken();
      await signInWithGoogle(token, role === 'professional' ? 'professional' : undefined);
      if (!useAuthStore.getState().error) onClose();
    } catch (e: any) {
      setGoogleError(e.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={[modalStyles.sheet, fullscreen && modalStyles.sheetFullscreen, desktopWeb && modalStyles.sheetDesktopWeb as any]}>
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

      {/* Botón Google */}
      <TouchableOpacity
        style={modalStyles.googleBtn}
        onPress={handleGoogleAuth}
        disabled={googleLoading || isLoading}
        activeOpacity={0.8}
      >
        {googleLoading ? (
          <ActivityIndicator size="small" color="#374151" />
        ) : (
          <>
            {Platform.OS === 'web' && <GoogleLogo />}
            <Text style={modalStyles.googleBtnText}>{t('auth.continueWithGoogle')}</Text>
          </>
        )}
      </TouchableOpacity>
      {googleError ? (
        <Text style={modalStyles.googleErrorText}>{googleError}</Text>
      ) : null}

      {/* Divider */}
      <View style={modalStyles.dividerRow}>
        <View style={modalStyles.dividerLine} />
        <Text style={modalStyles.dividerText}>{t('auth.orDivider')}</Text>
        <View style={modalStyles.dividerLine} />
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
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const scrollRef = useRef<ScrollView>(null);

  // Reset scroll to top whenever the modal switches between login ↔ register
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [visible]);

  const handleClose = () => {
    clearError();
    onClose();
  };

  if (visible === null) return null;

  const isDesktopWeb = Platform.OS === 'web' && !isMobile;

  const loginContent = (
    <LoginModal
      onClose={handleClose}
      onSwitch={() => { clearError(); onSwitch('register'); }}
      fullscreen={isMobile}
      desktopWeb={isDesktopWeb}
    />
  );
  const registerContent = (
    <RegisterModal
      onClose={handleClose}
      onSwitch={() => { clearError(); onSwitch('login'); }}
      fullscreen={isMobile}
      desktopWeb={isDesktopWeb}
    />
  );

  // ── Desktop web: native divs with position:fixed ──────────────────────────
  // Card and scroll container are merged into ONE div to avoid double scrollbar
  // and prevent the scrollbar from breaking the border-radius corners.
  if (isDesktopWeb) {
    return (
      // @ts-ignore
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 999,
        }}
      >
        {/* @ts-ignore — single element: card shape + scroll container */}
        <div
          onClick={(e: any) => e.stopPropagation()}
          className="auth-scroll"
          style={{
            width: '100%',
            maxWidth: '440px',
            maxHeight: '85vh',
            borderRadius: '24px',
            backgroundColor: '#fff',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          }}
        >
          {visible === 'login' ? loginContent : registerContent}
        </div>
      </div>
    );
  }

  // ── Mobile: fullscreen Modal with ScrollView ──────────────────────────────
  return (
    <Modal
      visible={true}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, backgroundColor: '#fff' }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {visible === 'login' ? loginContent : registerContent}
        </ScrollView>
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
  // On desktop web the outer div already has borderRadius + shadow; the inner
  // View must NOT repeat them (prevents RN Web's overflow:hidden on radius
  // from creating a second scroll context and double-scrollbar).
  sheetDesktopWeb: {
    borderRadius: 0,
    boxShadow: 'none',
    overflow: 'visible',
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
    flexShrink: 0 as const,
  },
  errorBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorBannerText: { color: '#B91C1C', fontSize: 13, flex: 1 },
  googleBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  googleErrorText: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  dividerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500' as const,
  },
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
