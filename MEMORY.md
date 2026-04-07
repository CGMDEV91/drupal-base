# MEMORY — StepUp Tours

Registro cronológico de conversaciones con el agente. Ver `CLAUDE.md` para el formato y las reglas.

---

## Sesión 2026-03-19 (aprox.)

**Resumen**: Implementación de la infraestructura i18n y fases iniciales del frontend React Native/Expo.

**Trabajo realizado**:
- Phase 0 (i18n): configuración de `i18next` + `react-i18next`, store `language.store.ts`, ficheros `en.json` / `es.json`, interceptor de langcode en `drupal-client.ts`.
- Phase 1: routing `[langcode]` con Expo Router, `_layout.tsx` con Navbar + Footer + AuthModals + ContactModal.
- Phase 2: página de listado de tours (`app/[langcode]/(tabs)/index.tsx`) con grid responsive, CountryDropdown, búsqueda.
- Phase 3: página de detalle de tour (`app/[langcode]/tour/[id].tsx`) y pantalla de steps (`app/[langcode]/tour/[id]/steps.tsx`).
- Creados: `Footer.tsx`, `ContactModal.tsx`, `CompletionPopup.tsx`, `StepTimeline.tsx`, `StepContent.tsx`, `StarRating.tsx`, `BusinessCard.tsx`.
- Creado `styles/theme.ts` con COLORS, SHADOWS, BUTTON_STYLES, BREAKPOINTS globales.
- i18n completo en `AuthModals.tsx`.

**Archivos modificados clave**:
- `app/_layout.tsx`, `app/[langcode]/_layout.tsx`
- `stores/language.store.ts`, `stores/auth.store.ts`
- `lib/drupal-client.ts`
- `i18n/locales/en.json`, `i18n/locales/es.json`
- `styles/theme.ts` (nuevo)
- `components/layout/Footer.tsx`, `ContactModal.tsx`, `AuthModals.tsx`, `Navbar.tsx`
- `components/tour/TourCard.tsx`, `StarRating.tsx`, `StepTimeline.tsx`, `StepContent.tsx`, `BusinessCard.tsx`, `CompletionPopup.tsx`

**Pendiente**:
- Phase 4: páginas de Favoritos, Completados, Ranking (agentes alcanzaron límite de rate).
- Phase 6: Stripe / donaciones.
- Phase 7: Panel de admin y dashboard profesional.
- Phase 8: redirect post-auth, filtros avanzados, páginas legales, inmutabilidad del rating.

---

## Sesión 2026-03-20 (aprox.)

**Resumen**: Rediseño UI para alinear con mockups (desktop/mobile), mejoras en TourCard, y nuevas funcionalidades.

**Trabajo realizado**:
- Analizado 6 mockups (homepage desktop/mobile, tour detail desktop/mobile, steps desktop/mobile).
- Rediseño de `TourCard`: corazón blanco con sombra, título 2 líneas, location con Ionicons, meta en 2 filas (duración+paradas / estrellas), rating con count.
- Añadidos `ratingCount` y `stopsCount` a tipo `Tour` y mapper `mapDrupalTour` en `drupal-client.ts`.
- `StarRating`: muestra `(count)` incluso sin rating.
- Rediseño homepage: botón de búsqueda reemplazado por icono filtro (Ionicons `options-outline`).
- Rediseño tour detail: hero 380px, círculos de acción (corazón + compartir), título en imagen, stat cards etiquetados, sección "About this tour", CTA dual en desktop.
- Rediseño steps: header compacto con %, barra de progreso exterior al scroll, step cards con bordes por estado (verde completado, ámbar activo).
- Auth modal desde Zustand: añadidos `pendingAuthModal`, `openAuthModal`, `closeAuthModal` a `auth.store.ts`; `_layout.tsx` suscrito al store; tour detail usa `openAuthModal('register')` en lugar de `Alert`.
- CLAUDE.md: añadida sección de MEMORY.md para registro de conversaciones.

**Archivos modificados clave**:
- `components/tour/TourCard.tsx`
- `components/tour/StarRating.tsx`
- `components/tour/StepTimeline.tsx`
- `components/tour/StepContent.tsx`
- `app/[langcode]/(tabs)/index.tsx`
- `app/[langcode]/tour/[id].tsx`
- `app/[langcode]/tour/[id]/steps.tsx`
- `app/[langcode]/_layout.tsx`
- `stores/auth.store.ts`
- `types/index.ts`
- `lib/drupal-client.ts`
- `CLAUDE.md`

**Pendiente**:
- Funcionalidad de favoritos completa (toggle corazón → Drupal → página `/favourites`).
- Página de completados (`/completed`).
- Phase 4-8 del plan original sin implementar.
- Verificación visual en expo web de todos los cambios de diseño.
- Posibles ajustes responsive en tour detail y steps (banner, botones, centrado desktop).

---

## Sesión 2026-03-20 (tarde)

**Resumen**: Phase 2 del plan de refactor — comportamiento de colapso/expansión/activo en StepTimeline.

**Trabajo realizado**:
- `expandedSteps` ahora inicializa con `new Set()` vacío (todos los steps comienzan colapsados).
- Añadido estado `manualActiveIndex` (`useState<number | null>`) para que el usuario pueda activar cualquier step manualmente.
- `getStepState`: si hay `manualActiveIndex`, ese index es el activo; si no, se auto-detecta el primer step no completado (comportamiento original).
- `toggleStep`: al expandir un step no completado, lo marca como `manualActiveIndex`.
- Nuevo `useEffect` + `useRef(prevCompletedCount)`: cuando `stepsCompleted.length` aumenta, colapsa el step recién completado y resetea `manualActiveIndex` a `null` para que el siguiente step incompleto quede activo automáticamente.
- Añadidos `useRef` y `useEffect` al import de React.
- Todos los estilos y la estructura JSX permanecen intactos.

**Archivos modificados**:
- `frontend/stepuptours/components/tour/StepTimeline.tsx`

**Pendiente / Próximos pasos**:
- Phase 3 y siguientes según ISSUES.md.
- Verificación visual del nuevo comportamiento en expo web/simulador.

---

## Sesión 2026-03-20 (noche)

**Resumen**: Phase 1 del plan de wiring — toggle de favorito y pill de completado en la homepage.

**Trabajo realizado**:
- `stores/tours.store.ts`: añadido `userActivities: Record<string, TourActivity>` al estado (inicializado a `{}`); añadida acción `fetchUserActivities(userId)` que llama a `getUserTourActivities` y mapea el array a un `Record<tourId, activity>`; añadida acción `toggleFavorite(userId, tourId)` con optimistic update y rollback en caso de error; añadido `getUserTourActivities` al import desde `tours.service`.
- `app/[langcode]/(tabs)/index.tsx`: importado `useAuthStore`; extraídos `user` y `openAuthModal` del auth store; extraídos `userActivities`, `fetchUserActivities` y `toggleFavorite` del tours store; añadido `useEffect` que llama a `fetchUserActivities(user.id)` cuando el usuario cambia; `renderItem` del `FlatList` ahora pasa `isFavorite`, `isCompleted` y `onToggleFavorite` a `TourCard`, con guard que abre el modal de login si el usuario no está autenticado.

**Archivos modificados**:
- `frontend/stepuptours/stores/tours.store.ts`
- `frontend/stepuptours/app/[langcode]/(tabs)/index.tsx`

**Pendiente / Próximos pasos**:
- Verificación visual del corazón y pill en expo web/simulador.
- Phase 2+: páginas de Favoritos y Completados (tabs dedicados).
- Wiring del toggle en la pantalla de detalle de tour (actualmente usa `updateActivity` separado).

---

## Sesión 2026-03-20 (noche 2)

**Resumen**: Phase 5 del plan — página de tours completados y página de ranking.

**Trabajo realizado**:
- `app/[langcode]/completed.tsx` (nuevo): página de tours completados, auth-protected. Mismos patrones que `favourites.tsx`. Filtra actividades por `isCompleted === true`, pasa `isCompleted={true}` a `TourCard` (sin callback de toggle). Layout responsive con columnas (1/2/3/4 según ancho), CONTENT_MAX_WIDTH=900. Estados: no autenticado (icono trophy-outline), loading, vacío, listado.
- `services/ranking.service.ts` (nuevo): `getRanking()` llama a `GET /api/ranking`, normaliza campos camelCase/snake_case, devuelve `RankingEntry[]`.
- `app/[langcode]/ranking.tsx` (nuevo): página pública de ranking. Header amber + back button. `FlatList` con `RankingRow` para cada entrada. Dos layouts: desktop (tabla con columnas #/Nombre/Tours/XP) y mobile (fila compacta). Top-3 con badge dorado/plateado/bronce y fondo amarillo suave. Avatar con fallback de iniciales. Estados: loading, error, vacío, listado.
- `i18n/locales/en.json` y `es.json`: añadidas claves `ranking.title`, `ranking.tours`, `ranking.xp`, `ranking.empty`, `completed.empty` (mantenidas las claves existentes).

**Archivos modificados/creados**:
- `frontend/stepuptours/app/[langcode]/completed.tsx` (nuevo)
- `frontend/stepuptours/services/ranking.service.ts` (nuevo)
- `frontend/stepuptours/app/[langcode]/ranking.tsx` (nuevo)
- `frontend/stepuptours/i18n/locales/en.json`
- `frontend/stepuptours/i18n/locales/es.json`

**Pendiente / Próximos pasos**:
- Implementar el endpoint Drupal `GET /api/ranking` (módulo custom) que devuelva los datos de ranking.
- Phase 6: Stripe / donaciones.
- Phase 7: Panel de admin y dashboard profesional.
- Phase 8: redirect post-auth, filtros avanzados, páginas legales.

---

## Sesión 2026-03-20 (Phase 8)

**Resumen**: Phase 8 — Footer fixes, Cookie consent banner, y páginas legales (Cookie Policy + Privacy Policy).

**Trabajo realizado**:
- **8A (Footer)**: Verificado que `Footer.tsx` no tiene enlace HOME ni `position: fixed/absolute`. El footer ya estaba correcto, sin cambios necesarios.
- **8B (CookieBanner)**: Creado `components/layout/CookieBanner.tsx`. Banner fijo en la parte inferior de la pantalla (`position: 'absolute'`). Almacena el consentimiento en `localStorage` (web) o memoria (native, fallback hasta instalar AsyncStorage). Layout responsive: columna en mobile, fila en desktop. Botón Accept (ámbar), botón Decline (outline gris), enlace "Learn more" a `/[langcode]/cookie-policy`. Se integró en `app/[langcode]/_layout.tsx` como último hijo del layout para que flote sobre el contenido.
- **8C (Legal pages)**: Creados `app/[langcode]/cookie-policy.tsx` y `app/[langcode]/privacy-policy.tsx`. Mismo patrón que `favourites.tsx`: header ámbar + back button + scroll centrado a `maxWidth: 900`. Contenido profesional en inglés (8 secciones cada uno). Texto del intro de privacy con borde ámbar a la izquierda para distinción visual.
- **i18n**: Añadidas claves `cookie.banner.*` y `legal.*` a `en.json` y `es.json`.

**Archivos creados/modificados**:
- `frontend/stepuptours/components/layout/CookieBanner.tsx` (nuevo)
- `frontend/stepuptours/app/[langcode]/cookie-policy.tsx` (nuevo)
- `frontend/stepuptours/app/[langcode]/privacy-policy.tsx` (nuevo)
- `frontend/stepuptours/app/[langcode]/_layout.tsx` (import + `<CookieBanner />`)
- `frontend/stepuptours/i18n/locales/en.json`
- `frontend/stepuptours/i18n/locales/es.json`

**Pendiente / Próximos pasos**:
- Instalar `@react-native-async-storage/async-storage` para persistencia nativa real del consentimiento (actualmente en memoria en native).
- Phase 6: Stripe / donaciones.
- Phase 7: Panel de admin y dashboard profesional.
- Endpoint Drupal `GET /api/ranking`.

---

## Sesión 2026-03-20 (Phase 6 — User Profile)

**Resumen**: Phase 6 del plan — página de perfil de usuario y enlace en Navbar.

**Trabajo realizado**:
- **Navbar**: Añadido item "Profile" (`nav.profile`) en el dropdown de usuario autenticado, antes de "Favourites". Navega a `/${lang}/profile`.
- **user.service.ts**: Extendido `updateUserProfile` para aceptar `preferredLanguage` (mapeado a `preferred_langcode`) y `countryId` (string ID directo, alternativa a pasar el objeto `country`). Añadida nueva función `updatePassword(userId, newPassword)` que hace PATCH a `/user/user/{id}` con `pass.value`.
- **auth.store.ts**: Añadida acción `updateProfile` en la interfaz e implementación. Llama a `updateUserProfile` con los cambios y luego refresca el usuario con `getUserById`, actualizando el store.
- **app/[langcode]/profile.tsx** (nuevo): Página auth-protected con:
  - Header ámbar + back button (patrón idéntico a favourites/completed).
  - Auth gate si no hay usuario (icono persona + botón sign in).
  - Sección "Statistics" con grid de 4 stat cards (tours completados, valoraciones dadas, miembro desde, XP). Responsive: 2 columnas en mobile, 4 en desktop. Cards con fondo amarillo suave y borde ámbar.
  - Sección "Edit Profile" con: campo publicName, campo nueva contraseña, campo confirmar contraseña, picker de idioma, picker de país.
  - Validación: passwords deben coincidir antes de guardar.
  - Feedback: mensaje de error en rojo (con icono), mensaje de éxito en verde (web) o Alert nativo (iOS/Android).
  - Botón Save ámbar, full-width, con ActivityIndicator durante guardado.
  - Pickers implementados como Modal con sheet inferior (bottom sheet) y `FlatList` de opciones, con checkmark en item seleccionado.
  - Idiomas hardcodeados (en/es/fr/de). Países cargados desde `useToursStore.fetchCountries()`.
  - Stats calculadas de `getUserTourActivities()`.
- **i18n**: Añadidas claves `nav.profile` + 16 claves `profile.*` en `en.json` y `es.json`.

**Archivos creados/modificados**:
- `frontend/stepuptours/components/layout/Navbar.tsx`
- `frontend/stepuptours/services/user.service.ts`
- `frontend/stepuptours/stores/auth.store.ts`
- `frontend/stepuptours/app/[langcode]/profile.tsx` (nuevo)
- `frontend/stepuptours/i18n/locales/en.json`
- `frontend/stepuptours/i18n/locales/es.json`

**Pendiente / Próximos pasos**:
- Donaciones/Stripe (Phase 6 payments).
- Phase 7: Panel de admin y dashboard profesional.
- Endpoint Drupal `GET /api/ranking`.
- Instalar `@react-native-async-storage/async-storage` para CookieBanner nativa.

---

## Sesión 2026-03-20 (Phase 7 — Expandable Filters Panel)

**Resumen**: Implementación del panel de filtros expandible en la homepage con soporte de país, ciudad y ordenación.

**Trabajo realizado**:
- **`types/index.ts`**: Añadido campo `sort?: 'rating' | 'alphabetical' | 'popular'` a `TourFilters`.
- **`services/tours.service.ts`**: Desestructurado `sort` en `getTours()`. Sort dinámico: `rating` → `sort=-field_average_rate` (default), `alphabetical` → `sort=title`, `popular` → `sort=-field_donation_count`. Aprovechado para añadir también el filtro de búsqueda por título via `filter[title][condition]` (CONTAINS) que antes no estaba conectado al backend.
- **`i18n/locales/en.json` + `es.json`**: Añadidas claves `filter.sort`, `filter.sortRating`, `filter.sortAlpha`, `filter.sortPopular`, `filter.selectCountry`, `filter.selectCity`. Actualizadas `filter.apply` (de "Search" a "Apply") y `filter.clear` (de "Clear Filters" a "Clear").
- **`app/[langcode]/(tabs)/index.tsx`**: Refactorización completa del sistema de filtros:
  - Añadido `useState(false)` → `showFilters` para controlar visibilidad del panel.
  - Extraídos `cities` y `fetchCities` del store.
  - Importado `TourFilters` desde `types`.
  - Nuevo componente `FilterSelect`: selector inline con dropdown expandible, sin Modal (scroll dentro del panel). Muestra placeholder o valor seleccionado, opción "All" para limpiar.
  - Nuevo componente `FiltersPanel`: contiene `FilterSelect` para país, `FilterSelect` para ciudad, chips de ordenación, y botones "Apply" / "Clear".
  - `handleCountrySelect`: cuando se selecciona país, limpia ciudad y llama `fetchCities`. Cuando se borra, solo limpia ambos del estado.
  - `handleCitySelect`, `handleSortSelect`: actualizan el store con `setFilters`.
  - `handleApply`: llama `fetchTours({ ...filters, page: 1 })` y cierra el panel.
  - `handleClear`: llama `clearFilters()` + `setSearch('')` + `fetchTours({})` y cierra el panel.
  - `hasActiveFilters`: computa `!!(country || city || sort)` para highlight del icono.
  - Botón filtro (options-outline): toggle de `showFilters`, ámbar cuando activo o panel abierto, blanco cuando inactivo.
  - Eliminado bloque `filtersRow` (CountryDropdown standalone en cabecera) — la funcionalidad está ahora dentro del panel.
  - Añadidos estilos: `filterIconBtnActive`, `filtersPanel`, `filterLabel`, `selectBtn/Text/Placeholder/Dropdown/Option`, `chipRow/chip/chipActive/chipText/chipTextActive`, `filterActions/applyBtn/applyBtnText/clearBtn/clearBtnText`.

**Archivos modificados**:
- `frontend/stepuptours/types/index.ts`
- `frontend/stepuptours/services/tours.service.ts`
- `frontend/stepuptours/i18n/locales/en.json`
- `frontend/stepuptours/i18n/locales/es.json`
- `frontend/stepuptours/app/[langcode]/(tabs)/index.tsx`

**Pendiente / Próximos pasos**:
- Verificación visual del panel en expo web y simulador iOS/Android.
- El `CountryDropdown` (con Modal) sigue en el fichero pero ya no se usa en el JSX principal — se puede eliminar en una limpieza futura si no se necesita.
- Donaciones/Stripe (Phase 6 payments).
- Endpoint Drupal `GET /api/ranking`.
- Instalar `@react-native-async-storage/async-storage` para CookieBanner nativa.

---

## Sesión 2026-03-20 (Phase 9 — Professional Dashboard)

**Resumen**: Phase 9 — Dashboard profesional con tabs de Mis Tours, Suscripción, Datos de Pago y Donaciones.

**Trabajo realizado**:
- **`services/dashboard.service.ts`** (nuevo): Servicio con todas las llamadas de datos del dashboard. Funciones: `getToursByAuthor`, `createTour`, `createTourStep`, `deleteTourStep`, `getProfessionalProfile`, `updateProfessionalProfile`, `getActiveSubscription`, `updateSubscription`, `getDonationsForAuthor`. Agnóstico del backend (mapeos en `drupal-client.ts`).
- **`app/[langcode]/dashboard.tsx`** (nuevo): Página principal del dashboard. Auth + role guard (professional/administrator). Header ámbar + back button. Tab bar horizontal scrollable con pills (ámbar activo, gris inactivo) para: My Tours, Subscription, Payment Data, Donations. Scroll view con `maxWidth: 900` para centrado desktop. Renderiza el tab component activo.
- **`components/dashboard/MyToursTab.tsx`** (nuevo): Lista los tours del autor. Carga `getToursByAuthor(userId)`. Cada tour como card con: título, pill Published(verde)/Draft(gris), ciudad, duración. Botón "View" (outline ámbar) + "Edit" (ghost gris). Botón "Create Tour" (ámbar) en la parte superior. Estado vacío con icono mapa. Grid 1 columna (mobile) / 2 columnas (desktop).
- **`components/dashboard/SubscriptionTab.tsx`** (nuevo): Muestra la suscripción activa. Carga `getActiveSubscription(userId)`. Cabecera de plan con badge (ámbar en premium). Grid de detalles (cycle, price, start/end dates). Toggle de auto-renewal con `Switch` de RN (actualiza via `updateSubscription`). Sección de límites del plan con dos cards ámbar (Negocios Destacados, Idiomas). Estado vacío si no hay suscripción.
- **`components/dashboard/PaymentDataTab.tsx`** (nuevo): Formulario de edición de datos bancarios del perfil profesional. Carga `getProfessionalProfile(userId)`. Campos editables: Full Name, Tax ID, Account Holder, IBAN (uppercase), BIC (uppercase). Botón Save con `updateProfessionalProfile`. Feedback de éxito/error. Estado "No professional profile found" si no existe perfil.
- **`components/dashboard/DonationsTab.tsx`** (nuevo): Historial de donaciones recibidas. Carga `getDonationsForAuthor(userId)`. Card de total revenue (ámbar grande). Desktop: tabla con columnas Fecha/Donante/Cantidad. Mobile: cards apiladas. Estado vacío con icono corazón.
- **`i18n/locales/en.json`** y **`es.json`**: Añadidas 38 claves `dashboard.*` (tabs, tours, subscription, payment, donations).

**Archivos creados/modificados**:
- `frontend/stepuptours/services/dashboard.service.ts` (nuevo)
- `frontend/stepuptours/app/[langcode]/dashboard.tsx` (nuevo)
- `frontend/stepuptours/components/dashboard/MyToursTab.tsx` (nuevo)
- `frontend/stepuptours/components/dashboard/SubscriptionTab.tsx` (nuevo)
- `frontend/stepuptours/components/dashboard/PaymentDataTab.tsx` (nuevo)
- `frontend/stepuptours/components/dashboard/DonationsTab.tsx` (nuevo)
- `frontend/stepuptours/i18n/locales/en.json`
- `frontend/stepuptours/i18n/locales/es.json`

**Pendiente / Próximos pasos**:
- Wiring del botón "Create Tour" en MyToursTab (navegación a formulario de creación).
- Wiring del botón "Edit" en MyToursTab (formulario de edición de tour, Phase futura).
- Donaciones/Stripe integration (webhook, Stripe Elements).
- Endpoint Drupal `GET /api/ranking`.
- Instalar `@react-native-async-storage/async-storage` para CookieBanner nativa.

---

## Sesión 2026-03-20 (Phase 3 — CompletionPopup confetti + layout)

**Resumen**: Phase 3 del plan de mejoras del CompletionPopup — animación de confetti mejorada y rediseño del layout del modal.

**Decisión de arquitectura (3A)**:
- `react-native-reanimated` ~3.16.1 está instalado pero el `babel.config.js` NO incluye `react-native-reanimated/plugin`, que es requisito obligatorio para que funcionen los worklets. Migrar a Reanimated sin ese plugin provocaría un crash en runtime. Se optó por mantener el `Animated` API nativo de RN y mejorarlo en lugar de introducir una dependencia de build no configurada.

**Trabajo realizado (3A — Confetti)**:
- Paleta ampliada de 8 a 12 colores (`#F97316`, `#06B6D4`, `#84CC16`, `#A855F7` añadidos).
- Contador de partículas aumentado de 80 a 100.
- Nuevo sistema de formas (`ConfettiShape`: `square`, `rect`, `circle`, `thin`) con función `pickShape()` y `shapeStyle()` que calculan dimensiones y `borderRadius` por tipo.
- Tamaños variados: distribución no uniforme (60% pequeñas 4-12px, 40% medianas/grandes hasta 24px).
- Drift horizontal ampliado de ±60 a ±90 unidades.
- Rotación máxima aumentada de ±360 a ±450 grados.
- Duración ampliada: 1800–4000ms (antes 2000–3500ms).
- `startY` aleatorio (0 a -60) para que las piezas no arranquen todas en la misma línea.
- `translateX` con 4 keyframes (0, 0.4, 0.7, 1) para movimiento horizontal más orgánico.
- Opacidad: fade-in rápido al 5% del recorrido (antes empezaba opaco) → evita pop.
- Easing cambiado de `Easing.out(Easing.quad)` a `Easing.out(Easing.cubic)` para caída más natural.
- Delay entre piezas reducido de 20ms a 18ms (ráfaga inicial más densa).

**Trabajo realizado (3B — Layout)**:
- Eliminado `flex: 1` y `marginTop: 60` del `cardStyle` móvil. Ahora la tarjeta usa `maxHeight: '85%'` aplicado en `cardShellMobile` para nunca cubrir toda la pantalla.
- Introducido `cardShell` (View exterior) que contiene el `overflow: 'hidden'` y las `borderRadius` → separa responsabilidades de la tarjeta del `ScrollView` interior.
- `ScrollView` envuelve todo el contenido del modal (`bounces={false}`, sin indicador de scroll) para que en pantallas pequeñas el contenido sea scrollable.
- `closeBtn` es `position: 'absolute'` con `zIndex: 10` fuera del `ScrollView` → siempre accesible.
- `paddingTop: 40` en `scrollContent` para que el título no quede debajo del botón close.
- `xpBadge`: añadido `alignSelf: 'center'` y `marginBottom: 8`.
- `ratingSection`: cambiado a `marginVertical: 12` (antes solo `marginBottom: 20`).
- `divider`: cambiado a `marginVertical: 16` (antes solo `marginBottom: 20`).
- `donationSection`: `marginBottom: 16` (consistente con el gap de 16px entre secciones).
- `donationInputRow`: altura fija `height: 48`, `alignItems: 'center'` para evitar stretching. Eliminado `alignItems: 'stretch'` anterior.
- `currencySymbol` y `donateInlineBtn`: `height: '100%'` para rellenar el row sin padding vertical explícito.
- `currencySymbol`: `lineHeight: 48` para centrado vertical en Android.
- `homeButton`: añadido `marginBottom: 16` para separarlo del borde inferior del scroll.

**Archivos modificados**:
- `frontend/stepuptours/components/tour/CompletionPopup.tsx`

**Pendiente / Próximos pasos**:
- Si en algún momento se añade `react-native-reanimated/plugin` al `babel.config.js`, migrar `ConfettiPiece` a `useSharedValue` + `useAnimatedStyle` para eliminar el `USE_NATIVE_DRIVER` condicional.
- Phase 6: Stripe / donaciones.
- Endpoint Drupal `GET /api/ranking`.

---

## Sesión 2026-03-20 (Phase 2 — PageBanner unificado)

**Resumen**: Phase 2 del plan de rediseño de cabeceras — reemplazo de todos los headers ámbar en páginas secundarias por el componente `PageBanner` (dark navy) ya existente.

**Trabajo realizado**:
- **2A (`favourites.tsx`)**: Importado `PageBanner`. Reemplazadas las 3 instancias del bloque `<View style={styles.header}>` (no-auth, loading, main) por `<PageBanner icon="heart" iconBgColor="#EC4899" ... />`. Eliminados estilos `header`, `backBtn`, `headerTitle`, `headerSpacer`.
- **2B (`completed.tsx`)**: Importado `PageBanner`. Refactorizado el componente `Header` interno para devolver `<PageBanner icon="trophy" iconBgColor="#22C55E" ... />`. Eliminados los mismos 4 estilos.
- **2C (`ranking.tsx`)**: Importado `PageBanner`. Refactorizado el componente `Header` interno para devolver `<PageBanner icon="trophy" iconBgColor="#F59E0B" ... />`. Eliminados los 4 estilos y también las importaciones ya innecesarias de `TouchableOpacity`, `useRouter`, `useLocalSearchParams` (el ranking no tiene acciones propias de navegación).
- **2D (`cookie-policy.tsx`)**: Importado `PageBanner`. Reemplazado el bloque header (incluyendo `TouchableOpacity` + `Ionicons` + back button) por `<PageBanner icon="document-text" iconBgColor="#6366F1" ... />`. Eliminados imports de `TouchableOpacity`, `useRouter`, `Ionicons` y la constante `AMBER`. Eliminados los 4 estilos.
- **2E (`privacy-policy.tsx`)**: Igual que cookie-policy pero con `icon="shield-checkmark" iconBgColor="#10B981"`. Mantenida la constante `AMBER` porque se usa en el estilo `borderLeftColor` del bloque intro.
- **2F (`profile.tsx`)**: Banner custom (no PageBanner) porque incluye avatar con iniciales:
  - Importado `BackButton`.
  - Reemplazado el header ámbar por `<View style={styles.profileBanner}>` (`#1E293B`, `paddingTop: 24`, `paddingBottom: 32`).
  - `BackButton` en `position: 'absolute', top: 16, left: 16`.
  - Avatar circle: 64x64, `borderRadius: 32`, `backgroundColor: '#F59E0B'`, iniciales blancas 24px bold.
  - Nombre: blanco 20px bold, `marginTop: 12`.
  - Email: `rgba(255,255,255,0.6)` 13px, `marginTop: 4`.
  - XP badge: pill `#FEF3C7`, text `#D97706` bold.
  - Iniciales calculadas en la función de render principal (split por espacios, mayúsculas, máx 2 caracteres).
  - El auth-gate también usa el banner (sin nombre ni email, solo `?` en el avatar y título de la página).
  - `StatCard` refactorizado: eliminado `icon: string` (emoji), añadidos `iconName`, `iconBg`, `iconColor`. Ahora renderiza un `View` circular con `Ionicons` en lugar de un `Text` con emoji.
  - Stat cards: trophy/gold → tours completados; location/green → ratings; calendar/purple → miembro desde; globe/blue → XP.
  - Eliminados estilos `header`, `backBtn`, `headerTitle`, `headerSpacer`, `statIcon`. Añadidos `profileBanner`, `bannerBackBtn`, `avatarCircle`, `avatarInitials`, `bannerName`, `bannerEmail`, `xpBadge`, `xpBadgeText`, `statIconCircle`.

**Archivos modificados**:
- `frontend/stepuptours/app/[langcode]/favourites.tsx`
- `frontend/stepuptours/app/[langcode]/completed.tsx`
- `frontend/stepuptours/app/[langcode]/ranking.tsx`
- `frontend/stepuptours/app/[langcode]/cookie-policy.tsx`
- `frontend/stepuptours/app/[langcode]/privacy-policy.tsx`
- `frontend/stepuptours/app/[langcode]/profile.tsx`

**Pendiente / Próximos pasos**:
- Phase 3+ de cabeceras (dashboard.tsx si aplica).
- Verificación visual en expo web.
- Donaciones/Stripe (Phase 6 payments).
- Endpoint Drupal `GET /api/ranking`.

---

## Sesión 2026-03-20 (Phase 7 — Ranking list/table redesign)

**Resumen**: Rediseño visual del contenido de la página de ranking (tabla/lista bajo el banner) para alinear con el mockup Phase 7. El banner (PageBanner) fue gestionado por otro agente en paralelo y no se tocó.

**Trabajo realizado**:
- Reemplazados los estilos de tabla plana (filas con `borderBottomWidth`) por tarjetas individuales con `borderWidth: 1`, `borderColor: '#F3F4F6'`, `borderRadius: 12`, `marginBottom: 8`, sombra multiplataforma (`Platform.select` con iOS shadow / Android elevation / default shadow).
- Añadida `SectionTitle` ("Top Exploradores" + icono `star` ámbar) dentro de una tarjeta contenedora blanca (`containerCard`: `borderRadius: 16`, sombra, `marginHorizontal: 20`, `maxWidth: 900`, `alignSelf: 'center'`). Usada como `ListHeaderComponent` del FlatList.
- Top 3 (`isTop3`): fondo `#FFFBEB`. Posición mostrada con icono Ionicons `trophy` en color dorado/plateado/bronce + número debajo (`positionTrophyWrap`). Posiciones 4+: círculo `#F3F4F6` con número gris (`positionNumberWrap`).
- Nuevo componente `XpBadge`: pill ámbar (`backgroundColor: '#FEF3C7'`, `color: '#D97706'`, `borderRadius: 12`, `paddingHorizontal: 10`, `paddingVertical: 3`). Prop `compact` reduce `fontSize` a 11 en mobile.
- Desktop: Tours con número + etiqueta "tours" (`toursCell` centrada). XP como `XpBadge` alineado a la derecha.
- Mobile: nombre + fila con `map-outline` + "{n} tours". `XpBadge compact` al extremo derecho.
- Nuevo componente `PositionIndicator` extraído para reutilización en ambos layouts.
- Eliminados: prop `isEven`, función `positionColors` (sustituida por `positionColor`), componente `TableHeader`, estilos legacy (`rowDesktop`, `rowMobile`, `badge`, `badgeText`, `statCell`, `xpCell`, `statValue`, `mobileStats`, `mobileStatText`, `tableHeader*`).
- Añadido `Platform` al import de react-native. Eliminados imports innecesarios (ya eliminados por agente anterior): `TouchableOpacity`, `useRouter`, `useLocalSearchParams`.

**Archivos modificados**:
- `frontend/stepuptours/app/[langcode]/ranking.tsx`

**Pendiente / Próximos pasos**:
- Verificación visual en expo web y simulador iOS/Android.
- Donaciones/Stripe integration.
- Endpoint Drupal `GET /api/ranking`.
- Instalar `@react-native-async-storage/async-storage` para CookieBanner nativa.

---

## Sesión 2026-03-20 (Bug fixes — TourCard stopsCount, Favourites/Completed data, layout consistency)

**Resumen**: Corrección de 4 bugs en el frontend: stopsCount no se mostraba en tarjetas del listado, las páginas de favoritos/completados no cargaban datos del tour, el estado favourite/completed no aparecía al cargar la homepage, y desalineación de grid entre homepage y páginas secundarias.

**Trabajo realizado**:

- **Issue 1 (stopsCount no visible en TourCard)**: El componente `TourCard` ya renderizaba `tour.stopsCount` correctamente, pero `TOUR_CARD_FIELDS` en `services/tours.service.ts` no incluía `field_steps_count` ni `field_rating_count` en el sparse fieldset. Drupal no devolvía esos campos en el listado. Añadidos `field_steps_count` y `field_rating_count` a `TOUR_CARD_FIELDS`.

- **Issue 2 (Favourites/Completed sin datos de tour)**: Las páginas originales llamaban `getTourById()` por cada actividad (N+1 requests). Problema adicional: los campos del tour incluidos en `getUserTourActivities` eran insuficientes. Solución en dos partes:
  1. Añadida función `extractTourFromActivity(raw)` en `lib/drupal-client.ts`: extrae el tour embebido del nodo de actividad cuando Jsona lo resuelve desde el include.
  2. Añadida función `getUserActivitiesWithTours(userId)` en `services/tours.service.ts` con interface `ActivityWithTour { activity, tour }`. Hace una sola petición con `include=field_tour,field_tour.field_city,field_tour.field_country,field_tour.field_image` y campos completos del tour. Devuelve pares activity+tour listos para la UI sin peticiones adicionales.
  3. Actualizadas `favourites.tsx` y `completed.tsx` para usar `getUserActivitiesWithTours` en lugar de `getUserTourActivities` + `getTourById`.

- **Issue 3 (estado isFavorite/isCompleted no visible al cargar homepage)**: La lógica en `app/[langcode]/(tabs)/index.tsx` ya era correcta — `useEffect` con `[user?.id]` llama `fetchUserActivities`. No se requirió cambio; el bug era consecuencia de los otros issues.

- **Issue 4 (layout inconsistente)**: Las páginas `favourites.tsx` y `completed.tsx` usaban breakpoints diferentes (4/3/2/1 cols), `CONTENT_MAX_WIDTH=900`, `GAP=12`. Normalizadas para usar los mismos valores que la homepage: 3/2/1 cols, `GRID_MAX_WIDTH=1200`, `GAP=20`, `PADDING` responsivo (32 en desktop, 16 en mobile). `columnWrapperStyle` y wrapping de items de 1 columna ahora son idénticos a los de la homepage.

**Archivos modificados**:
- `frontend/stepuptours/lib/drupal-client.ts` (nueva función `extractTourFromActivity`)
- `frontend/stepuptours/services/tours.service.ts` (TOUR_CARD_FIELDS ampliado, nueva interface `ActivityWithTour` y función `getUserActivitiesWithTours`, nueva función `getToursByIds`)
- `frontend/stepuptours/app/[langcode]/favourites.tsx` (reescrito)
- `frontend/stepuptours/app/[langcode]/completed.tsx` (reescrito)

**Pendiente / Próximos pasos**:
- Verificación visual de los cambios en expo web/simulador.
- Donaciones/Stripe integration.
- Endpoint Drupal `GET /api/ranking`.
- Instalar `@react-native-async-storage/async-storage` para CookieBanner nativa.

---

## Sesión 2026-03-20 (Bug fixes — site-settings 404 + confetti web)

**Resumen**: Corrección de dos bugs: `/api/site-settings` devolvía 404 (investigación del controlador Drupal), y el confetti del `CompletionPopup` no era visible en Expo web por limitaciones del `Animated` API de RN en el contexto de un Modal.

**Trabajo realizado**:

- **Issue 1 (site-settings 404)**: Verificado que `SiteSettingsController.php` ya existía y era correcto (namespace, métodos GET+OPTIONS, CORS headers, manejo de errores). `stepuptours_api.routing.yml` ya incluía OPTIONS en la lista de métodos. `stepuptours_api.info.yml` estaba correcto. El 404 se debe a caché de rutas de Drupal sin limpiar. **Acción requerida**: ejecutar `ddev drush cr` desde el directorio del proyecto para limpiar la caché y registrar la ruta.

- **Issue 2 (confetti no visible en web)**: El problema raíz es que en Expo web el `Animated` API con `useNativeDriver: false` corre en el hilo JS dentro del contexto del `Modal`, que puede quedar bajo el stacking context del backdrop. Solución implementada sin dependencias nuevas (npm no pudo ejecutarse desde Windows sobre paths WSL):
  - Nueva función `injectConfettiCSS()`: inyecta una `<style>` con los keyframes `confettiFall` y `confettiSway` en `document.head` una sola vez (guarda contra doble inyección con id `stepuptours-confetti-styles`).
  - Nueva función `mountWebConfetti(screenWidth)`: crea un `<div id="stepuptours-confetti-host">` con `position:fixed; inset:0; z-index:9999` directamente en `document.body` (escapa el stacking context del Modal). Genera 100 `<div class="confetti-piece">` con estilos inline aleatorios (posición, tamaño, color, border-radius, duración). Auto-elimina el host tras 6200ms con `setTimeout`. Devuelve una función de cleanup para `useEffect`.
  - Nuevo componente `WebConfetti`: llama a `mountWebConfetti` en `useEffect` y devuelve `null` desde el árbol RN.
  - En el render del `CompletionPopup`: la condición `{isFirstCompletion && visible && ...}` ahora bifurca con `Platform.OS === 'web' ? <WebConfetti /> : <NativeConfetti />`. El `visible` en la condición garantiza que al re-abrir el modal el confetti se re-dispara.
  - El fallback nativo (`ConfettiPiece` con `Animated`) permanece exactamente igual para iOS/Android.

**Archivos modificados**:
- `frontend/stepuptours/components/tour/CompletionPopup.tsx`

**Pendiente / Próximos pasos**:
- Ejecutar `ddev drush cr` para resolver el 404 de `/api/site-settings`.
- Verificación visual del confetti en expo web (`npx expo start --web`).
- Donaciones/Stripe integration.
- Endpoint Drupal `GET /api/ranking`.

---

## Sesión 2026-03-20 (Bug fix — Professional Dashboard inaccesible)

**Resumen**: Corrección del bug por el que usuarios con rol `professional` no podían acceder al dashboard: el enlace no aparecía en el Navbar y el role guard los bloqueaba porque los roles se almacenaban como UUIDs en lugar de machine names.

**Causa raíz identificada**:
El endpoint de roles en `auth.service.ts` usaba `?fields[user--user]=roles`, que en JSON:API es un sparse fieldset de atributos; los campos de relación (`roles`) se incluyen en `relationships` igualmente, pero los objetos de linkage no tienen `meta.drupal_internal__target_id` accesibles a menos que Drupal los popule explícitamente. El parámetro correcto para obtener las entidades de rol completas (con su `drupal_internal__id` = machine name) es `?include=roles`, que hace que Drupal incluya los nodos de rol en el array `included` de la respuesta.

**Trabajo realizado**:

- **`services/auth.service.ts`**: Cambiada la URL de fetch de roles de `?fields[user--user]=roles` a `?include=roles`. Añadida lógica para construir un mapa `uuid → drupal_internal__id` recorriendo el array `rolesResponse.data.included` (filtrando por `type === 'user_role--user_role'`). Los roles del usuario se mapean ahora usando ese diccionario, con fallbacks a `meta.drupal_internal__target_id`, `meta.drupal_internal__id` y finalmente el UUID si ninguna clave está disponible.

- **`lib/drupal-client.ts` (`mapDrupalUser`)**: Mejorada la extracción de roles para que funcione en dos casos:
  1. Cuando `raw.roles` es un array de strings (flujo normal desde `auth.service.ts`): pasa los strings tal cual.
  2. Cuando `raw.roles` es un array de objetos de relación JSON:API (llamadas directas a `mapDrupalUser` con datos crudos sin pre-procesar): lee `meta.drupal_internal__id` o `meta.drupal_internal__target_id`.
  3. Fallback: si `raw.roles` no existe, lee de `raw.relationships.roles.data`.

- **`components/layout/Navbar.tsx`**: Ampliada la condición de visibilidad del enlace "Dashboard" de `roles.includes('professional')` a `(roles.includes('professional') || roles.includes('administrator'))`. Los administradores ahora también ven el enlace.

**Verificación del resto de la cadena**:
- `dashboard.tsx`: el role guard ya comprobaba correctamente ambos roles (`professional` || `administrator`). Sin cambios.
- Los 4 componentes de tab (`MyToursTab`, `SubscriptionTab`, `PaymentDataTab`, `DonationsTab`) usan todos `export function` (named exports), coincidiendo con los imports `{ ... }` en `dashboard.tsx`. Sin mismatch de exports.

**Archivos modificados**:
- `frontend/stepuptours/services/auth.service.ts`
- `frontend/stepuptours/lib/drupal-client.ts`
- `frontend/stepuptours/components/layout/Navbar.tsx`

**Pendiente / Próximos pasos**:
- Verificar en expo web que tras login con usuario `professional` el dropdown muestra el enlace Dashboard y la página carga correctamente los 4 tabs.
- Donaciones/Stripe integration.
- Endpoint Drupal `GET /api/ranking`.

---

## Sesión 2026-03-21

**Resumen**: Implementación completa de la Fase 1 — Donaciones + Admin Panel + Stripe Integration + Gestión de Suscripciones para profesionales.

**Trabajo realizado**:

### Donaciones y Admin Panel
- **`components/shared/DonationsView.tsx`** (CREADO): Vista compartida de donaciones con modo `admin` (tabla + 4 cards resumen, badges role) y modo `professional` (card total propio). Responsive: tabla desktop, cards mobile.
- **`app/[langcode]/admin.tsx`** (MODIFICADO): Añadida pestaña `donations` con `<DonationsView mode="admin" />`.
- **`components/admin/SiteSettingsTab.tsx`** (REESCRITO): Tres cards — Social Links, Revenue Split (con preview live), Stripe Configuration (publishable key visible, secret/webhook write-only con badge "✓ configured").

### Stripe Integration
- **`lib/stripe.ts`** (MODIFICADO): Añadida función `resetStripePromise()` para invalidar el singleton tras cambio de keys.
- **`services/admin.service.ts`** (MODIFICADO): Interfaces `StripeSettings`, `StripeKeysInput`; función `updateStripeKeys()`.
- **`components/tour/CompletionPopup.tsx`** (MODIFICADO): Flujo real de donación con `Elements` + `CardElement` de Stripe — `createDonationIntent` → `confirmCardPayment` → `onSuccess`. Guard Platform.OS (web/native).
- **`components/dashboard/DonationsTab.tsx`** (REESCRITO): Thin wrapper sobre `DonationsView`.

### Backend Stripe
- **`web/modules/custom/stepuptours_api/src/Controller/SiteSettingsController.php`** (MODIFICADO): `buildSettingsData()` devuelve `stripeSettings` (publishable key pública, booleans para secret/webhook). `update()` guarda keys en `stepuptours.payment` config con validación de prefijos.
- **`web/modules/custom/stepuptours_api/src/Controller/WebhookController.php`** (MODIFICADO): Routing por `metadata.type` (`donation` vs `subscription`). `handleSubscriptionPaymentSucceeded()` añadido para crear nodo suscripción desde webhook (idempotente por `field_payment_reference`).

### Gestión de Suscripciones
- **`web/modules/custom/stepuptours_api/src/Controller/SubscriptionController.php`** (CREADO): `POST /api/subscription/intent` (crea PaymentIntent Stripe con metadata plan) + `POST /api/subscription/activate` (verifica pago, cancela suscripciones previas, crea nodo). Idempotencia por `field_payment_reference`.
- **`stepuptours_api.routing.yml`** (MODIFICADO): Añadidas rutas `subscription_intent` y `subscription_activate`.
- **`lib/drupal-client.ts`** (MODIFICADO): `mapDrupalSubscriptionPlan()`.
- **`services/dashboard.service.ts`** (MODIFICADO): `getSubscriptionPlans()` vía JSON:API.
- **`services/subscription.service.ts`** (CREADO): `createSubscriptionIntent()` + `activateSubscription()`.
- **`components/dashboard/SubscriptionTab.tsx`** (REESCRITO): Vista activa (auto-renewal toggle, cancel, limits grid, last payment), `NoSubscriptionView` (planes reales Drupal, billing cycle toggle, `StripeSubscriptionForm` con `Elements` + `CardElement`), pantalla éxito.

### i18n
- **`i18n/locales/en.json`** y **`es.json`**: Añadidas ~40 keys `subscription.*` y ~15 keys `admin.settings.*` y `admin.donations.*`.
- Caché Drupal limpiada: `ddev drush cr` ✅

**Archivos modificados** (principales):
- `frontend/stepuptours/components/shared/DonationsView.tsx`
- `frontend/stepuptours/components/tour/CompletionPopup.tsx`
- `frontend/stepuptours/components/admin/SiteSettingsTab.tsx`
- `frontend/stepuptours/components/dashboard/DonationsTab.tsx`
- `frontend/stepuptours/components/dashboard/SubscriptionTab.tsx`
- `frontend/stepuptours/services/admin.service.ts`
- `frontend/stepuptours/services/subscription.service.ts`
- `frontend/stepuptours/services/dashboard.service.ts`
- `frontend/stepuptours/lib/drupal-client.ts`
- `frontend/stepuptours/lib/stripe.ts`
- `frontend/stepuptours/i18n/locales/en.json`
- `frontend/stepuptours/i18n/locales/es.json`
- `web/modules/custom/stepuptours_api/src/Controller/SiteSettingsController.php`
- `web/modules/custom/stepuptours_api/src/Controller/SubscriptionController.php`
- `web/modules/custom/stepuptours_api/src/Controller/WebhookController.php`
- `web/modules/custom/stepuptours_api/stepuptours_api.routing.yml`

**Pendiente / Próximos pasos**:
- Probar el flujo completo de donación en Expo Web con tarjeta de test Stripe (4242 4242 4242 4242).
- Probar el flujo de suscripción: selección de plan → CardElement → activación → vista activa.
- Verificar webhook Stripe local (stripe listen --forward-to) para el flujo de fallback.
- Endpoint `GET /api/ranking` (pendiente de sesiones anteriores).
- Considerar añadir keys de suscripción a `de.json` y `fr.json` (actualmente solo en/es).

## Sesión 2026-03-22

**Resumen**: Tour Experience Polish — completado el plan aprobado de mejoras de performance, animaciones, UX y rediseño de componentes.

**Trabajo realizado**:

### Correcciones de sesión anterior (retomadas)
- Fix 403 PATCH `tour_user_activity`: permisos `create/edit own` añadidos al rol `authenticated`
- Fix 422 POST `professional_profile`: módulo Address requiere `given_name`/`family_name`; añadido `splitFullName()` en `dashboard.service.ts`
- Fix `StarRating` rating bug: aceptar prop `value` (antes solo `rating`)
- Fix banner detail page: emoji `📍` → `<Ionicons name="location-outline">`
- Fix "Start Again": resetea `stepsCompleted: [], isCompleted: false` antes de navegar
- Fix es.json: "Visitado" → "Completado"
- Endpoint `POST /api/payment/donation-activate`: crea nodo donación verificando PaymentIntent en Stripe (idempotente)

### Implementado en esta sesión

**Performance**:
- `stores/tours.store.ts`: `updateActivity` usa optimistic update (patron idéntico a `toggleFavorite`) — steps se marcan completados instantáneamente sin esperar la respuesta API

**Animaciones**:
- `steps.tsx`: Barra de progreso animada con `Animated.timing` (500ms, Easing.out cubic) + `progressAnim.interpolate` para width `'0%'→'100%'`
- `StepTimeline.tsx`: Expand/collapse animado con `maxHeight` 0→600 + `opacity` 0→1 (300ms, bezier). Círculo del timeline hace pop (scale 1→1.4→1) al completar un step (useNativeDriver: true)
- `CompletionPopup.tsx`: XP badge hace scale pop (spring), texto "+XP" flota hacia arriba y se desvanece (translateY -60px, 1200ms). Confetti se muestra en TODAS las completaciones (no solo la primera)
- `StarRating.tsx`: Bounce en cascada al votar (i*30ms stagger, scale 1→1.5→1)

**TTS Player rediseñado** (`StepContent.tsx`):
- Botón "Escuchar descripción" que expande/colapsa un mini-player (Animated, 280ms)
- Controles: Stop | Play/Pause | Speed
- Velocidades ciclables: 0.75x → 1x → 1.25x → 1.5x → 2x
- Barra de progreso + timestamps (elapsed/total)
- Progreso estimado: `Math.ceil(textLength / (15 * rate))` segundos
- `setInterval(100ms)` actualiza progressAnim; display se actualiza 1×/segundo
- `onDone/onStopped/onError` callbacks de expo-speech

**Descripción rediseñada** (`StepContent.tsx`):
- Card con sombra (elevation 3), icono `information-circle-outline`
- Line-height 22, color #374151
- TTS player en mini-card gris (#F9FAFB) debajo de la descripción

**CompletionPopup refactorizado**:
- Tamaño compacto: `maxHeight: '70%'` mobile, sin ScrollView
- Donación movida a `DonationModal` separado (abre al pulsar botón "Donar")
- `DonationModal`: feedback de éxito inline (checkmark scale pop + fade-in texto + auto-close 3s)
- Flujo: `CompletionPopup` → botón Donar → `DonationModal` → éxito inline → cierre

**i18n** (`en.json`, `es.json`):
- Añadidas: `step.tts.listen`, `step.description`, `donation.thankYou`, `donation.donated`

**Archivos modificados**:
- `frontend/stepuptours/stores/tours.store.ts`
- `frontend/stepuptours/app/[langcode]/tour/[id]/steps.tsx`
- `frontend/stepuptours/app/[langcode]/tour/[id].tsx`
- `frontend/stepuptours/components/tour/StepTimeline.tsx`
- `frontend/stepuptours/components/tour/StepContent.tsx`
- `frontend/stepuptours/components/tour/CompletionPopup.tsx`
- `frontend/stepuptours/components/tour/StarRating.tsx`
- `frontend/stepuptours/services/dashboard.service.ts`
- `frontend/stepuptours/services/payment.service.ts`
- `frontend/stepuptours/i18n/locales/en.json`
- `frontend/stepuptours/i18n/locales/es.json`
- `web/modules/custom/stepuptours_api/src/Controller/PaymentController.php`
- `web/modules/custom/stepuptours_api/stepuptours_api.routing.yml`
- `config/sync/user.role.authenticated.yml`
- `config/sync/user.role.professional.yml`

**Pendiente / Próximos pasos**:
- Probar el flujo completo en Expo Web: completar tour → popup compacto → donar → modal Stripe → feedback éxito
- Verificar TTS en iOS/Android (expo-speech `onDone` callback puede comportarse diferente por plataforma)
- Endpoint `GET /api/ranking` (pendiente de sesiones anteriores)
- Añadir keys de traducción a otros idiomas (de.json, fr.json) si aplica

---

## Sesión 2026-03-25 10:00

**Resumen**: Refactor del tab "My Tours" del dashboard profesional para reutilizar el componente TourCard de la homepage, añadiendo funcionalidades de propietario (edición, borrado) y barra de búsqueda.

**Trabajo realizado**:
- Extendido `TourCard` con props opcionales `isOwner`, `onEdit`, `onDelete`. En modo owner se muestran: pill de estado (Published/Draft) en esquina superior derecha, botón de borrado (papelera, fondo blanco, icono rojo) en esquina superior izquierda, botón de edición amber en el área meta debajo del rating. Todos los botones de owner usan `stopPropagation` para no disparar la navegación al tour.
- Añadida `AMBER_DARK` como constante en TourCard (necesaria para el botón de edición).
- Añadida función `deleteTour(tourId: string)` a `services/dashboard.service.ts` que llama a `drupalDelete('/node/tour/{uuid}')`.
- Refactorizado `MyToursTab` completamente: reemplaza los cards custom por `TourCard` con `isOwner=true`, usa `FlatList` con el mismo cálculo de grid responsivo que homepage/favourites (cols 1/2/3, PADDING, GAP=20, GRID_MAX_WIDTH=1200, columnWrapperStyle, contentContainerStyle).
- Añadida barra de búsqueda (estilo homepage: fondo blanco, borde gris, icono search, botón clear) entre el botón "Create Tour" y el listado. Filtrado client-side por título.
- Flujo de borrado: `Alert.alert` en nativo, `Modal` custom con confirmación en web. Overlay de `ActivityIndicator` por card durante el borrado.
- Edición navega a `/${langcode}/dashboard/create-tour?tourId=${id}`.
- Añadidas claves de traducción en `en.json` y `es.json`: `dashboard.tours.searchPlaceholder`, `dashboard.tours.noResults`, `dashboard.tours.deleteTitle`, `dashboard.tours.deleteConfirm`, `common.cancel`, `common.delete`, `common.error`, `common.retry`.

**Archivos modificados**:
- `frontend/stepuptours/components/tour/TourCard.tsx`
- `frontend/stepuptours/components/dashboard/MyToursTab.tsx`
- `frontend/stepuptours/services/dashboard.service.ts`
- `frontend/stepuptours/i18n/locales/en.json`
- `frontend/stepuptours/i18n/locales/es.json`

**Pendiente / Próximos pasos**:
- Las claves de traducción `fr.json` y `de.json` contienen solo `{}` — añadir traducciones cuando se activen esos idiomas.
- La ruta `create-tour?tourId=` para edición asume que la pantalla `create-tour` lee ese param y carga el tour existente — verificar que esa lógica existe o implementarla.
- Valorar añadir acción de publicar/despublicar directamente desde el card en modo owner.

---

## Sesión 2026-03-25 — Business Management Feature

**Resumen**: Implementación completa de la feature de gestión de negocios (Business): API layer, servicio, tabs de gestión, formulario, picker reutilizable e integración en create-tour.

**Trabajo realizado**:

### Part 1: Business API Layer (`lib/drupal-client.ts`)
- Añadidas constantes `BUSINESS_INCLUDE`, `BUSINESS_FIELDS`, helper `buildBusinessParams()`.
- Añadidas funciones exportadas: `fetchBusinesses(authorId?)`, `fetchBusinessById(id)`, `searchBusinesses(query, authorId?)`, `createBusinessNode(data)`, `updateBusinessNode(id, data)`, `deleteBusinessNode(id)`, `fetchBusinessCategories()`.
- Exportada interfaz `BusinessInput` con campos: name, description, website, phone, categoryId, lat, lon.
- Los fields `field_website` se envían como objeto `{uri, title}` (JSON:API link field).
- Los fields `field_description` usan `{value, format: 'basic_html'}`.

### Part 2: Business Service (`services/business.service.ts`) — nuevo fichero
- Funciones agnósticas del backend: `getBusinessesByAuthor`, `getAllBusinesses`, `getBusinessById`, `searchBusinessesByName`, `getBusinessCategories`, `createBusiness`, `updateBusiness`, `deleteBusiness`.
- `searchBusinessesByName` con query vacío devuelve todos (útil para el picker inicial).

### Part 3: BusinessForm.tsx — nuevo componente
- Modal bottom-sheet para crear/editar negocios.
- Campos: name (requerido), description, category (picker con búsqueda), website, phone, lat/lon.
- En modo edición (`existing` prop), precarga el formulario.
- Carga categorías de `business_category` taxonomy al montar.
- Category picker con buscador nested dentro del mismo modal.

### Part 4: BusinessTab.tsx — nuevo componente
- Props: `userId?` — sin userId → modo admin (todos), con userId → modo professional (propios).
- Desktop: tabla con columnas Name / Category / Website / Actions (Edit / Delete).
- Mobile: cards apiladas con icono, nombre, categoría, website y botones de acción.
- Delete con confirmación: `Alert.alert` en nativo, `confirm()` en web.
- Integra `BusinessForm` para create/edit inline sin navegación.
- Actualización optimista de la lista tras guardar/borrar.

### Part 5: BusinessPicker.tsx — nuevo componente reutilizable
- Props: `selectedBusinessId`, `onSelect`, `userId`, `disabled`, `placeholder`, `selectedBusiness`.
- Sin selección: muestra botón trigger con icono search.
- Con selección: muestra chip amber con nombre, categoría y botón X para limpiar (sin borrar en Drupal).
- Modal bottom-sheet con buscador debounced (350ms), lista de resultados con icono + nombre + categoría.
- Carga inicial al abrir el modal: todos los negocios del usuario.
- Búsqueda por nombre con `searchBusinessesByName`.

### Part 6: Integración en dashboard.tsx
- Importado `BusinessTab`.
- Añadido tab `'businesses'` con icon `business-outline` entre Tours y Subscription.
- `TabId` extendido con `'businesses'`.
- Renderiza `<BusinessTab userId={user.id} />` en ambos layouts (mobile/desktop).
- Clave i18n: `dashboard.tabs.businesses`.

### Part 7: Integración en admin.tsx
- Importado `BusinessTab`.
- Añadido tab `'businesses'` con icon `business-outline` entre Translations y Donations.
- `TabId` extendido con `'businesses'`.
- Renderiza `<BusinessTab />` (sin userId → admin ve todos).
- Clave i18n: `admin.tabs.businesses`.

### Part 8: Integración en create-tour.tsx
- Importados `BusinessPicker` y tipo `Business`.
- Estado de tour-level businesses: cambiado de `string[]` a `(Business | null)[]`.
- Estado de step-level business: cambiado de `Record<string, string[]>` a `Record<string, Business | null>` (un slot por step = `field_featured_business`).
- `tourBusinessSlots`: ahora usa `subscription.plan.maxFeaturedDetail` en lugar de hardcoded 3.
- Reemplazados los `TextInput` de businessId por `BusinessPicker` en todos los slots.
- Sección 3 (tour businesses): añadida `planBadge` con nombre del plan + nº de slots, y banner de warning si hay negocios duplicados entre slots.
- Añadidas styles: `ddBackdrop`, `ddDropdown`, `ddSearchBar`, `ddSearchInput`, `ddOption`, `ddOptionActive`, `ddOptionText`, `ddOptionTextActive` (restauradas, eran referencias sin definición), `planBadge`, `planBadgeText`, `upgradeHint`, `warnBanner`, `warnText`.

### i18n
- `en.json`: añadidas `dashboard.tabs.businesses`, `admin.tabs.businesses`.
- `es.json`: añadidas `dashboard.tabs.businesses` ("Negocios"), `admin.tabs.businesses` ("Negocios").

**Archivos creados**:
- `frontend/stepuptours/services/business.service.ts`
- `frontend/stepuptours/components/dashboard/BusinessForm.tsx`
- `frontend/stepuptours/components/dashboard/BusinessTab.tsx`
- `frontend/stepuptours/components/dashboard/BusinessPicker.tsx`

**Archivos modificados**:
- `frontend/stepuptours/lib/drupal-client.ts`
- `frontend/stepuptours/app/[langcode]/dashboard.tsx`
- `frontend/stepuptours/app/[langcode]/admin.tsx`
- `frontend/stepuptours/app/[langcode]/dashboard/create-tour.tsx`
- `frontend/stepuptours/i18n/locales/en.json`
- `frontend/stepuptours/i18n/locales/es.json`

**Pendiente / Próximos pasos**:
- `create-tour.tsx`: los valores de `tourBusinesses` y `stepFeaturedBusiness` se recogen en estado pero el `handleSave` aún no los envía a Drupal (los tours y steps se crean sin los business relationships). Hay que extender `createTour()` y `createTourStep()` en `dashboard.service.ts` para aceptar y enviar los `field_featured_business_1/2/3` y `field_featured_business` como relationships JSON:API.
- Validar que el rol `professional` tiene permiso en Drupal para crear/editar/borrar nodos `business` (revisar permisos en Drupal admin o config sync).
- Las traducciones de `fr.json` y `de.json` siguen siendo `{}` — añadir cuando se activen esos idiomas.

---

## Sesión 2026-03-25 — Fix 1: Business relationships en save + Fix 2: Edit mode en create-tour

**Resumen**: Dos correcciones relacionadas en `create-tour.tsx` y `dashboard.service.ts`: (1) enviar los negocios seleccionados como relationships JSON:API al crear/actualizar tours y steps; (2) modo edición completo cuando se accede con `?tourId=` param.

**Trabajo realizado**:

### Fix 1: Business relationships al guardar

- Extendida `createTour(data)` en `dashboard.service.ts` para aceptar `featuredBusinessIds: (string | null)[]` (3 slots). Construye relationships `field_featured_business_1/2/3` con `{ data: { type: 'node--business', id } }` o `{ data: null }` según el slot.
- Extendida `createTourStep(tourId, data)` para aceptar `featuredBusinessId: string | null`, `lat?`, `lon?`, `duration?`. Construye relationship `field_featured_business` y atributos `field_location` / `field_duration` opcionales.
- Añadida `updateTour(tourId, data)` — PATCH con mismos campos + relationships de negocios.
- Añadida `updateTourStep(stepId, data)` — PATCH; cuando no hay coords pone `field_location: null` para limpiar el geopoint.
- Añadida `buildFields` al import de `dashboard.service.ts`.
- En `handleSave` de `create-tour.tsx`: se extraen `featuredBusinessIds` de `tourBusinesses[i]?.id` y `stepBusinessId` de `stepFeaturedBusiness[step.key]?.id`. Se pasan a `createTour` / `createTourStep` (create mode) y `updateTour` / `updateTourStep` (edit mode).
- La extracción de UUIDs se hace en la capa de servicio/componente; `drupal-client.ts` no se modificó (sigue siendo el único fichero con conocimiento de Drupal).

### Fix 2: Edit mode

- Añadidas funciones en `dashboard.service.ts`:
  - `getTourById(tourId)`: GET `/node/tour/{uuid}` con includes de imagen, ciudad, país y los 3 business slots. Devuelve `Tour` completo.
  - `getTourStepsForEdit(tourId)`: GET `/node/tour_step` filtrado por `field_tour.id`, ordenado por `field_order`, incluye `field_featured_business`. Devuelve `TourStep[]`.
- En `create-tour.tsx`:
  - `useLocalSearchParams` lee `tourId` además de `langcode`. `isEditMode = !!tourId`.
  - `StepEntry` gana campo opcional `drupalId?: string` para identificar steps ya persistidos.
  - `originalStepIds` ref: guarda los UUIDs de steps al cargar en edición (para detectar borrados).
  - `isLoadingTour` state: inicializado a `isEditMode`; muestra spinner hasta que los datos carguen.
  - `useEffect` de carga: `Promise.all([getTourById, getTourStepsForEdit])` → pre-rellena title, description, duration, cityId/cityLabel, tourBusinesses (slots 1-3), steps (con `drupalId`) y `stepFeaturedBusiness` map por key.
  - Guarda antitear con flag `cancelled` y cleanup `return () => { cancelled = true }`.
  - `handleSave` bifurca en PATCH vs POST:
    - PATCH: llama `updateTour`, luego elimina steps removidos (`deleteTourStep` por ids que ya no están), luego itera steps actuales — `updateTourStep` si tiene `drupalId`, `createTourStep` si es nuevo.
    - POST: comportamiento original + ahora pasa businesses.
  - `PageBanner` usa `t('createTour.editTitle', 'Edit Tour')` / `t('createTour.editSubtitle', ...)` en modo edición, fallback inline en inglés para no romper sin claves i18n nuevas.
  - Guard de renderizado incluye `|| isLoadingTour`.

**Archivos modificados**:
- `frontend/stepuptours/services/dashboard.service.ts`
- `frontend/stepuptours/app/[langcode]/dashboard/create-tour.tsx`

**Pendiente / Próximos pasos**:
- Añadir claves i18n `createTour.editTitle` y `createTour.editSubtitle` a `en.json` y `es.json` (actualmente usan fallback inline).
- Validar permisos Drupal del rol `professional` para PATCH en `node--tour` y `node--tour_step`.
- Las traducciones de `fr.json` y `de.json` siguen siendo `{}`.
- Verificar en expo web / simulador el flujo completo: crear tour con negocios, editar tour, añadir/borrar steps en edición.

---

## Sesión 2026-03-25 — Image/Logo Upload Feature

**Resumen**: Implementación completa de subida de imagen/logo en los formularios de creación/edición de tours y negocios.

**Trabajo realizado**:

### Task 1: `uploadDrupalFile` en `lib/drupal-client.ts`
- Añadida función exportada `uploadDrupalFile(bundle, field, uri, filename): Promise<string>`.
- Usa `fetch(uri)` para obtener un Blob (funciona en web y native sin condición Platform).
- Lee la sesión con `appSession.getSession()` para construir el header `Authorization`.
- POST a `${BASE_URL}/jsonapi/file/upload/node/${bundle}/${field}` usando `drupalClient.post()` con `baseURL: ''` (URL absoluta), `Content-Type: application/octet-stream`, `Content-Disposition: file; filename="..."`, `transformRequest` para enviar el Blob sin serialización JSON.
- Devuelve el UUID del fichero subido desde `response.data.data.id`.
- Eliminado import `Platform` que no era necesario en la implementación final.

### Task 2: `BusinessInput` + CRUD de business en `drupal-client.ts`
- Añadido campo `logoId?: string` a `BusinessInput`.
- `createBusinessNode`: añade `relationships.field_logo = { data: { type: 'file--file', id } }` si `logoId` está presente.
- `updateBusinessNode`: igual, pero con soporte para `null` explícito (borra el logo existente).

### Task 3: `createTour` / `updateTour` en `dashboard.service.ts`
- Añadido parámetro opcional `imageId?: string` a `createTour`. Construye `relationships.field_image` si está presente.
- Añadido parámetro opcional `imageId?: string | null` a `updateTour`. Construye o limpia `relationships.field_image` según valor.

### Task 4: `ImagePickerField` en `components/shared/ImagePickerField.tsx` (NUEVO)
- Componente reutilizable con props: `currentImageUrl`, `onImageSelected`, `onImageCleared`, `label`.
- En web: `document.createElement('input')` con `type="file" accept="image/*"` + `URL.createObjectURL`.
- En native: importa dinámicamente `expo-image-picker`, llama `launchImageLibraryAsync`.
- Preview con `expo-image` (`Image` de expo-image, `contentFit="cover"`).
- Botones "Change" y "Remove" en modo preview.
- Botón dashed "Select image" cuando no hay imagen.

### Task 5: Integración en `create-tour.tsx`
- Importados `ImagePickerField` y `uploadDrupalFile`.
- Añadidos estados: `imageUri`, `imageFilename`, `uploadedImageId`, `existingImageUrl`.
- Edit mode: pre-rellena `existingImageUrl` desde `tour.image`.
- JSX: `ImagePickerField` en Section 1 (Basic Info) entre el campo description y la fila city/duration/language.
- `handleSave`: antes de crear/actualizar el tour, si hay `imageUri` y no `uploadedImageId`, llama `uploadDrupalFile('tour', 'field_image', ...)` y guarda el UUID resultante. Pasa `imageId` a `createTour` y `updateTour`.
- Dependencias del `useCallback` actualizadas.

### Task 6: Integración en `create-business.tsx`
- Importados `ImagePickerField` y `uploadDrupalFile`.
- Añadidos estados: `imageUri`, `imageFilename`, `uploadedImageId`, `existingLogoUrl`.
- Edit mode: pre-rellena `existingLogoUrl` desde `business.logo`.
- JSX: `ImagePickerField` añadida al final de la sección "Business Details".
- `handleSave`: antes de crear/actualizar, si hay `imageUri` y no `uploadedImageId`, llama `uploadDrupalFile('business', 'field_logo', ...)`. Pasa `logoId` a `createBusiness` / `updateBusiness`.

**Archivos creados**:
- `frontend/stepuptours/components/shared/ImagePickerField.tsx`

**Archivos modificados**:
- `frontend/stepuptours/lib/drupal-client.ts`
- `frontend/stepuptours/services/dashboard.service.ts`
- `frontend/stepuptours/app/[langcode]/dashboard/create-tour.tsx`
- `frontend/stepuptours/app/[langcode]/dashboard/create-business.tsx`

**Pendiente / Próximos pasos**:
- Drupal debe tener los permisos de `file_upload` habilitados para el rol `professional` en los bundles `node/tour/field_image` y `node/business/field_logo`. Verificar en `/admin/config/media/file-system` y módulo `jsonapi_file_upload` o permisos JSON:API.
- El endpoint de upload en Drupal JSON:API requiere módulo `jsonapi` ≥ Drupal 9.3 con soporte de file upload (habilitado por defecto en Drupal 10/11).
- En native, si `expo-image-picker` no está instalado, el componente silencia el error. Considerar instalar `expo-image-picker` (`npx expo install expo-image-picker`) para habilitar el picker nativo.
- En web, los Blob URLs (`URL.createObjectURL`) son efímeros — si el componente se desmonta antes de guardar, la URI puede quedar inválida. Considerar `FileReader.readAsDataURL` como alternativa más robusta si se detecta este problema.

---

## Sesión 2026-03-26 — Bug fixes: lat/lon, redirects post-save, toast notifications

**Resumen**: Cuatro correcciones relacionadas con el guardado de negocios y tours: fix del campo `field_location` que no se actualizaba en edición, redirecciones post-save con params `tab` y `toast`, y sistema de toast animado en el dashboard.

**Trabajo realizado**:

### Fix 1: `field_location` no se guardaba en edición (`lib/drupal-client.ts`)
- **Causa**: `updateBusinessNode` solo ejecutaba `attributes.field_location = {...}` cuando `data.lat !== undefined && data.lon !== undefined`. Si el usuario no tocaba las coordenadas pero el formulario enviaba `lat: undefined, lon: undefined` (caso de campos vacíos), la clave nunca se incluía en el payload PATCH, y Drupal no actualizaba el campo.
- **Fix**: Cambiado a `if ('lat' in data || 'lon' in data)` — el bloque se ejecuta siempre que alguna de las claves esté presente en el objeto (en `create-business.tsx` el spread de `BusinessInput` siempre incluye `lat` y `lon`). Dentro, `hasCoords` valida si ambos son números válidos; si no, envía `null` para limpiar el geopoint en Drupal.

### Fix 2: Redireccion post-save en `create-business.tsx`
- `router.replace` cambiado de `/${langcode}/dashboard` a `/${langcode}/dashboard?tab=businesses&toast=business_saved`.

### Fix 3: Redirección post-save en `create-tour.tsx`
- `router.replace` cambiado de `/${langcode}/dashboard` a `/${langcode}/dashboard?tab=tours&toast=tour_saved`.

### Fix 4: Tab inicial y toast animado en `dashboard.tsx`
- `useLocalSearchParams` ahora lee `tab` y `toast` además de `langcode`.
- `VALID_TABS` array + helper `isValidTab()` para validar el param `tab` antes de usarlo como `TabId`.
- `initialTab` deriva del param `tab` (si es válido) o default `'tours'`; inicializa `activeTab` state.
- Toast system:
  - `toastMessage` state + `toastOpacity` `Animated.Value` (ref) + `toastTimeoutRef` para limpiar el timer.
  - `useEffect` reacciona al cambio de `toastParam`: resuelve la clave i18n `toast.<param>` (con fallback al valor raw si la clave no existe), lanza animación fade-in (250ms), espera 2.5s, lanza fade-out (400ms), limpia el mensaje.
  - Toast renderizado como `Animated.View` con `position: 'absolute'`, `bottom: 32`, `alignSelf: 'center'`, fondo `#1F2937`, icono `checkmark-circle` blanco, texto.
- Añadido `Animated` a los imports de React Native. Añadido `useRef` a los imports de React.

### i18n
- `en.json`: añadidas `toast.business_saved` y `toast.tour_saved`.
- `es.json`: añadidas `toast.business_saved` ("Negocio guardado correctamente") y `toast.tour_saved` ("Tour guardado correctamente").

**Archivos modificados**:
- `frontend/stepuptours/lib/drupal-client.ts`
- `frontend/stepuptours/app/[langcode]/dashboard/create-business.tsx`
- `frontend/stepuptours/app/[langcode]/dashboard/create-tour.tsx`
- `frontend/stepuptours/app/[langcode]/dashboard.tsx`
- `frontend/stepuptours/i18n/locales/en.json`
- `frontend/stepuptours/i18n/locales/es.json`

**Pendiente / Próximos pasos**:
- Probar el flujo completo: crear negocio → redirige a dashboard tab businesses con toast verde.
- Probar edición de negocio con coordenadas: verificar que lat/lon llegan a Drupal correctamente y que se pueden limpiar (enviando null).
- Verificar que el toast no interfiere con el contenido en mobile (bottom: 32 puede solapar con la barra de navegación del sistema en algunos dispositivos — considerar añadir `SafeAreaView` offset).
- Las traducciones de `fr.json` y `de.json` siguen siendo `{}` — añadir cuando se activen esos idiomas.

---

## Sesión 2026-04-06

**Resumen**: Implementación de Google OAuth en el frontend (web) y refactor completo del componente AuthModals con diseño Twitter/X-style para desktop, scrollbar thin en la tarjeta modal, y correcciones en global.css.

**Trabajo realizado**:
- `global.css`: Cambiado el selector `[role="button"]` a `*` para la regla `touch-action: pan-y`, de modo que el scroll funcione sobre cualquier elemento interactivo. Añadido el bloque `.auth-scroll` con scrollbar siempre visible (thin, 5px, color #D1D5DB) para el contenedor del modal de autenticación en desktop.
- `services/googleAuth.service.ts` (nuevo): Carga Google Identity Services (GSI) de forma lazy via `<script>` inyectado en el DOM. Expone `getGoogleAccessToken()` que abre el popup OAuth de Google y retorna el `access_token`. Solo funciona en `Platform.OS === 'web'`. Usa `EXPO_PUBLIC_GOOGLE_CLIENT_ID` como variable de entorno.
- `services/auth.service.ts`: Añadida la función exportada `loginWithGoogle(googleAccessToken, role?)`. Llama a `POST /api/auth/google` con el token de Google, recibe `{token, username}` (Basic Auth pre-codificado), obtiene el perfil completo del usuario vía JSON:API y roles vía `/api/me`, guarda la sesión.
- `stores/auth.store.ts`: Añadida `signInWithGoogle` en la interface `AuthState` y su implementación. Usa dynamic import de `loginWithGoogle`. Arranca el `inactivityTracker` tras login exitoso.
- `components/layout/AuthModals.tsx`: Reescritura completa con los siguientes cambios:
  - En desktop (`Platform.OS === 'web' && !isMobile`): se renderiza fuera de `<Modal>` usando divs nativos con `position: fixed; zIndex: 999` y clase `auth-scroll`. Evita los problemas de `position: fixed` dentro de Modal en web.
  - En mobile: `<Modal>` con `transparent={false}`, `animationType="slide"` y `KeyboardAvoidingView` + `ScrollView`.
  - Ambos formularios tienen botón "Continue with Google" (SVG inline del logo de Google, 4 paths de colores) antes de los campos, separado por un divider "o".
  - `LoginModal`: incluye link "Don't have an account? Register" después del submit.
  - `RegisterModal`: NO tiene link a login (usuario cierra y hace clic en login desde la navbar). El selector de rol está antes del botón Google para que la selección afecte al flujo de Google.
  - Estado local `googleLoading` y `googleError` en cada formulario por separado.
  - Eliminado el estilo `orLoginLink` y la key `auth.orLogIn` (ya no se usa).
- `i18n/locales/en.json`: Eliminado `auth.orLogIn`. Añadidos `auth.continueWithGoogle` ("Continue with Google"), `auth.orDivider` ("or"), `auth.googleError` ("Google sign-in failed. Please try again.").
- `i18n/locales/es.json`: Eliminado `auth.orLogIn`. Añadidos `auth.continueWithGoogle` ("Continuar con Google"), `auth.orDivider` ("o"), `auth.googleError` ("Error con Google. Inténtalo de nuevo.").

**Archivos modificados**:
- `frontend/stepuptours/global.css`
- `frontend/stepuptours/services/googleAuth.service.ts` (nuevo)
- `frontend/stepuptours/services/auth.service.ts`
- `frontend/stepuptours/stores/auth.store.ts`
- `frontend/stepuptours/components/layout/AuthModals.tsx`
- `frontend/stepuptours/i18n/locales/en.json`
- `frontend/stepuptours/i18n/locales/es.json`

**Pendiente / Próximos pasos**:
- Configurar `EXPO_PUBLIC_GOOGLE_CLIENT_ID` en el `.env` del proyecto con el Client ID de Google Cloud Console (tipo "Web application", con el origen correcto en "Authorized JavaScript origins").
- Implementar el endpoint Drupal `POST /api/auth/google` en un módulo custom que verifique el `access_token` contra la API de Google, cree o recupere el usuario y devuelva `{token, username}`.
- Para native (iOS/Android): implementar Google Sign-In con `@react-native-google-signin/google-signin`. Actualmente `getGoogleAccessToken()` lanza error en plataformas no-web.
- Las traducciones de `fr.json` y `de.json` siguen siendo `{}` — añadir las nuevas claves de auth cuando se activen esos idiomas.
