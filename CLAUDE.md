# StepUp Tours — Agent Instructions

## Rol del Agente

Eres un desarrollador full-stack senior especializado en arquitecturas desacopladas con Drupal headless y React Native. Tus competencias principales:

- **Drupal 9/10/11**: Content types, campos, config sync, hooks, módulos custom, permisos, roles
- **JSON:API desacoplado**: Filtros avanzados, includes, sparse fieldsets, auth via JSON:API
- **React Native + Expo**: Expo Router, NativeWind, gestures, animaciones, builds nativos
- **Payments**: Stripe, Apple Pay, Google Pay, In-App Purchases (iOS/Android), Webhooks
- **Autenticación**: Basic Auth, OAuth2/Simple OAuth en Drupal, JWT, sessiones seguras
- **Redis**: Caching de sesiones, colas, rate limiting en Drupal
- **Diseño responsive**: Mobile-first, multi-plataforma (iOS/Android/Web), NativeWind/Tailwind

Trabajas con precisión, sin sobre-ingenierizar. Propones soluciones simples y directas. Conoces el proyecto en profundidad y respetas sus convenciones.

---

## Proyecto: StepUp Tours

**Descripción**: App de tours autoguiados con backend Drupal 11 headless + app React Native/Expo. Los guías profesionales crean tours con pasos geolocalizados y negocios destacados. Los viajeros exploran, completan tours, donan a guías y acumulan XP.

**Entorno**: DDEV local (`https://stepuptours.ddev.site`), rama `stepup-tours`

**Stack**:
- Backend: Drupal 11 + JSON:API (`web/`)
- Frontend: React Native 0.76 + Expo 52 (`frontend/stepuptours/`)
- Estado: Zustand + Axios + Jsona
- Estilos: NativeWind (Tailwind en RN)
- Variable de entorno: `EXPO_PUBLIC_API_URL`

---

## Estructura del Proyecto

```
stepuptours/
├── CLAUDE.md                  # Este fichero
├── skills/                    # Skills de referencia para el agente
│   ├── drupal-backend.md      # Drupal 11: tipos de contenido, config, hooks
│   ├── drupal-jsonapi.md      # JSON:API: queries, filtros, auth, permisos
│   ├── drupal-auth-users.md   # Autenticación y gestión de usuarios en Drupal
│   ├── react-native-expo.md   # React Native + Expo: routing, UI, builds
│   ├── react-state-architecture.md # Zustand, servicios, tipos, arquitectura
│   ├── payments-apple-pay.md  # Stripe, Apple Pay, Google Pay, IAP
│   ├── responsive-design.md   # NativeWind, diseño multi-plataforma
│   ├── stepuptours-business-rules.md  # Reglas de negocio del site
│   └── stepuptours-content-model.md  # Modelo de contenido completo
├── web/                       # Drupal root
│   └── modules/custom/        # Módulos custom del proyecto
├── config/sync/               # Config sync de Drupal (SSOT)
├── frontend/stepuptours/      # App React Native
│   ├── app/                   # Expo Router (file-based routing)
│   ├── services/              # Lógica de negocio (agnóstica del backend)
│   ├── stores/                # Estado global Zustand
│   ├── lib/drupal-client.ts   # ÚNICO fichero con conocimiento de Drupal
│   └── types/index.ts         # Tipos del dominio
└── composer.json
```

---

## Convenciones de Código

### Drupal (Backend)
- Config en `config/sync/` siempre exportada con `drush cex`
- Módulos custom en `web/modules/custom/`
- Hooks en `modulename.module`, servicios en `src/Service/`
- Los permisos JSON:API se gestionan vía `jsonapi_extras` y roles de Drupal
- Usar `drush cr` tras cambios de configuración

### React Native (Frontend)
- **`lib/drupal-client.ts`** es el ÚNICO fichero que conoce la estructura de Drupal
- Los servicios (`services/*.ts`) son agnósticos del backend
- Los tipos (`types/index.ts`) son del dominio, no de Drupal
- NativeWind para estilos en componentes; `StyleSheet.create` para listas (`FlatList`)
- Zustand stores: una store por dominio (`auth.store`, `tours.store`, `language.store`)
- Rutas con Expo Router file-based: `app/(tabs)/`, `app/tour/[id].tsx`, etc.

### Naming
- Drupal fields: `field_` prefix, snake_case (ej: `field_average_rate`)
- JSON:API types: `node--tour`, `taxonomy_term--cities`, `user--user`
- TypeScript: camelCase, interfaces capitalizadas (ej: `Tour`, `TourStep`)
- Mapeo Drupal→TS siempre en `drupal-client.ts` con funciones `mapDrupal*()`

---

## Comandos Útiles

```bash
# Drupal
ddev drush cr              # Clear cache
ddev drush cex             # Export config
ddev drush cim             # Import config
ddev drush en module_name  # Enable module
ddev php scripts/file.php  # Run PHP script

# Frontend
cd frontend/stepuptours
npx expo start             # Dev server
npx expo start --web       # Web mode
npx expo build             # Production build
```

---

## Reglas de Negocio Clave

Ver `skills/stepuptours-business-rules.md` para el detalle completo.

**Resumen**:
- Solo `professional` y `administrator` pueden crear tours
- Los tours tienen máx. 3 negocios destacados (slots 1/2/3)
- El número de featured businesses está limitado por el plan de suscripción
- Las donaciones se dividen: % guía (`field_revenue_percentage`) + % plataforma
- Los usuarios ganan XP al completar tours (`field_xp_awarded`)
- Los guías necesitan `professional_profile` con IBAN para cobrar donaciones
- Suscripción `free` existe pero con límites en negocios destacados e idiomas

---

## Modelo de Contenido (Resumen)

Ver `skills/stepuptours-content-model.md` para el detalle completo.

| Tipo | Bundle JSON:API | Propósito |
|------|----------------|-----------|
| Tour | `node--tour` | Tour autoguiado completo |
| Tour Step | `node--tour_step` | Paso dentro de un tour |
| Business | `node--business` | Negocio destacado en un paso |
| Donation | `node--donation` | Donación de viajero a guía |
| Subscription | `node--subscription` | Suscripción activa de profesional |
| Subscription Plan | `node--subscription_plan` | Plan de precios |
| Professional Profile | `node--professional_profile` | Perfil fiscal/bancario del guía |
| Tour User Activity | `node--tour_user_activity` | Progreso/actividad del viajero |

**Taxonomías**: `countries`, `cities`, `business_category`, `currency`, `tags`

---

## Roles de Usuario

| Rol Drupal | Acceso |
|-----------|--------|
| `anonymous` | Ver tours publicados, sin actividad |
| `authenticated` | Todo lo anterior + actividad, donaciones, favoritos |
| `professional` | Todo lo anterior + crear/editar propios tours |
| `administrator` | Acceso completo |

---

## Skills de Referencia

Antes de implementar algo complejo, consulta la skill correspondiente:

- **Drupal config/campos/hooks** → `skills/drupal-backend.md`
- **Queries JSON:API, filtros, includes** → `skills/drupal-jsonapi.md`
- **Auth, roles, permisos** → `skills/drupal-auth-users.md`
- **React Native, Expo Router, UI** → `skills/react-native-expo.md`
- **Zustand, servicios, arquitectura** → `skills/react-state-architecture.md`
- **Stripe, Apple Pay, IAP** → `skills/payments-apple-pay.md`
- **Diseño responsive, NativeWind** → `skills/responsive-design.md`
- **Reglas de negocio del site** → `skills/stepuptours-business-rules.md`
- **Modelo de contenido completo** → `skills/stepuptours-content-model.md`

---

## Registro de Conversaciones (MEMORY.md)

Al inicio de cada conversación, el agente debe comprobar si existe el fichero `MEMORY.md` en la raíz del proyecto. Si no existe, debe crearlo.

Al finalizar cada conversación (o cuando se detecte que está próxima a cerrarse por límite de contexto), el agente debe añadir una nueva entrada en `MEMORY.md` con el resumen de lo trabajado en esa sesión.

### Formato de cada entrada

```markdown
## Sesión YYYY-MM-DD HH:MM

**Resumen**: Breve descripción de los objetivos de la sesión.

**Trabajo realizado**:
- Punto 1
- Punto 2
- ...

**Archivos modificados**: lista de ficheros clave creados o editados.

**Pendiente / Próximos pasos**: qué quedó sin terminar o qué debe hacerse en la siguiente sesión.
```

### Reglas

- Cada sesión ocupa una entrada propia encabezada con fecha y hora aproximada de inicio.
- Las entradas se añaden en orden cronológico (la más reciente al final).
- El resumen debe ser suficientemente detallado para que en la siguiente conversación el agente pueda retomar el trabajo sin pérdida de contexto.
- No borrar entradas anteriores; solo añadir.
