import { Redirect } from 'expo-router';
import { useLanguageStore } from '@/stores/language.store';

export default function Index() {
  const currentLanguage = useLanguageStore((s) => s.currentLanguage);
  const isLoading = useLanguageStore((s) => s.isLoading);

  // Wait until fetchLanguages completes so we redirect to the correct language.
  // Returning null keeps the root blank while _layout initializes.
  if (isLoading || !currentLanguage) return null;

  return <Redirect href={`/${currentLanguage.id}/`} />;
}