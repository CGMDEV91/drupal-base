import { Redirect } from 'expo-router';
import { useLanguageStore } from '@/stores/language.store';

export default function Index() {
  const currentLanguage = useLanguageStore((s) => s.currentLanguage);
  const lang = currentLanguage?.id ?? 'en';
  
  return <Redirect href={`/${lang}/`} />;
}