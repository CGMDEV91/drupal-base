// app/index.tsx
import { Redirect } from "expo-router";
import { useLanguageStore } from "@/stores/language.store";

export default function Index() {
  const currentLanguage = useLanguageStore((s) => s.currentLanguage);
  const isLoading = useLanguageStore((s) => s.isLoading);

  // Si el store aún está cargando o no hay currentLanguage, usa /es por defecto
  // Nota: si tu app decide que por defecto es /es, puedes comentar isLoading si quieres más simple
  if (isLoading || !currentLanguage) {
    // Redirige siempre a /es cuando el idioma no está definido
    return <Redirect href="/es/" />;
  }

  // Si el store ya tiene idioma, usa ese idioma (por ejemplo, si ya habías cambiado a /it)
  return <Redirect href={`/${currentLanguage.id}/`} />;
}
