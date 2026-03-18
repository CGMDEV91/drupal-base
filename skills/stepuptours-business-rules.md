# Skill: StepUp Tours — Business Rules

Site-specific. Reglas de negocio, flujos y restricciones propias de la plataforma.

---

## Modelo de Negocio

StepUp Tours es una plataforma de tours autoguiados donde:
- **Guías profesionales** crean tours con pasos geolocalizados
- **Viajeros** exploran tours, los completan y donan a guías
- **Negocios locales** pagan a guías para ser destacados en los tours
- La **plataforma** cobra una comisión de las donaciones y suscripciones de guías

---

## Roles y Permisos

### Anónimo
- Ver listado de tours publicados
- Ver detalle de tour y sus pasos
- Ver negocios destacados en tours
- No puede: favoritos, completar, donar, valorar

### Authenticated (Viajero)
- Todo lo anterior
- Marcar tours como favorito / guardado
- Completar pasos y tours (TourUserActivity)
- Valorar tours (1-5 estrellas)
- Donar a guías
- Acumular XP
- Ver su historial de actividad

### Professional (Guía)
- Todo lo anterior (como viajero)
- Crear tours propios
- Editar/borrar sus propios tours
- Crear y editar tour steps
- Gestionar negocios destacados en sus tours
- Ver estadísticas de sus tours (donaciones, completados, ratings)
- Necesita `professional_profile` con datos fiscales/bancarios para cobrar

### Administrator
- Acceso total a todo
- Gestionar todos los usuarios, tours, suscripciones, pagos

---

## Reglas de Tours

### Creación
- Solo `professional` o `administrator` pueden crear tours
- Un tour nuevo se crea en estado `unpublished` (status=0)
- El guía lo publica manualmente cuando está listo
- El tour debe tener al menos un `tour_step` para ser válido

### Negocios Destacados (Featured Businesses)
- Un tour tiene exactamente 3 slots: `field_featured_business_1`, `_2`, `_3`
- Los slots disponibles dependen del plan de suscripción del guía:

  | Plan | `field_max_featured_detail` | Descripción |
  |------|-----------------------------|-------------|
  | Free | 1 | Solo 1 negocio destacado por tour |
  | Premium Monthly | 3 | Todos los slots |
  | Premium Annual | 3 | Todos los slots |

- `field_max_featured_steps` controla cuántos negocios destacados puede haber por step (-1 = ilimitado)
- `field_featured_per_step`: Boolean que habilita destacados a nivel de step (no solo tour)

### Rating / Valoración
- Los viajeros valorann un tour de 1 a 5 estrellas
- La valoración se guarda en `tour_user_activity.field_user_rating`
- El campo `tour.field_average_rate` es un agregado calculado (promedio)
- Solo usuarios autenticados pueden valorar
- Solo se puede valorar un tour una vez (upsert sobre la misma activity)

### Donaciones
- Los viajeros pueden donar a guías por cualquier tour completado
- No hay obligación de completar el tour para donar
- Monto mínimo: configurado en el sistema (pendiente)
- La donación crea un nodo `donation` con estado `pending` → `completed` tras pago
- El split se calcula: `guide_revenue = amount * (professional_profile.field_revenue_percentage / 100)`
- El tour acumula `field_donation_count` y `field_donation_total` (agregados)

---

## Reglas de Tour Steps

- Los steps pertenecen a un único tour (`field_tour` entity reference)
- Cada step tiene un `field_order` entero para ordenar (sort=field_order)
- Los steps tienen su propia ubicación geolocalizada (`field_geofield`)
- Un step puede tener un negocio destacado opcional (`field_featured_business`)
- El campo `field_total_completed` cuenta cuántos usuarios completaron ese step

### Completar un Step
1. Usuario completa el step en la app
2. App hace PATCH a `tour_user_activity.field_steps_completed` añadiendo el step UUID
3. Si todos los steps están en `field_steps_completed`, el tour está completado
4. Al completar el tour → `field_is_completed = true`, `field_completed_at = now()`
5. Se otorgan XP → `field_xp_awarded = true` (solo una vez por tour)

---

## Sistema de XP (Experiencia)

- Los usuarios acumulan `field_experience_points` en su perfil
- XP se otorga al completar un tour (una sola vez: `field_xp_awarded`)
- La cantidad de XP es fija por tour (20 pts, mostrado en las cards)
- Pending: implementar niveles, badges, leaderboard

### Otorgar XP (flujo)
```
1. Tour completado → field_is_completed = true
2. field_xp_awarded no era true → es la primera vez
3. PATCH user.field_experience_points += XP_AMOUNT
4. PATCH tour_user_activity.field_xp_awarded = true
```

---

## Suscripciones de Guías

### Planes
| Plan | Tipo | Precio | Ciclo | Max Featured Detail | Max Featured Steps | Max Languages |
|------|------|--------|-------|--------------------|--------------------|---------------|
| Free | free | 0 | none | 1 | 3 | 5 |
| Premium Monthly | premium | ~9.99€ | monthly | 3 | -1 (ilimitado) | -1 (ilimitado) |
| Premium Annual | premium | ~99€ | annual | 3 | -1 (ilimitado) | -1 (ilimitado) |

### Estados de Suscripción
- `trial` → guía nuevo, período de prueba
- `active` → suscripción vigente y pagada
- `cancelled` → cancelada, puede seguir activa hasta `field_end_date`
- `expired` → fecha fin superada

### Renovación Automática
- `field_auto_renewal = true` → se renueva via Stripe al llegar a `field_end_date`
- El webhook de Stripe actualiza la subscription node al renovar/cancelar

### Restricciones Aplicadas en Frontend
```typescript
// Verificar si el guía puede añadir un featured business
function canAddFeaturedBusiness(subscription: Subscription, currentCount: number): boolean {
  const { maxFeaturedDetail } = subscription.plan;
  return currentCount < maxFeaturedDetail;
}

// Al crear/editar tour, verificar límite
const { plan } = await getActiveSubscription(userId);
if (featuredBusinessCount > plan.maxFeaturedDetail) {
  throw new Error(`Tu plan solo permite ${plan.maxFeaturedDetail} negocio(s) destacado(s)`);
}
```

---

## Perfil Profesional

- El `professional_profile` es un nodo separado ligado al usuario (`field_user`)
- Es obligatorio para que el guía pueda cobrar donaciones
- Contiene: nombre fiscal, NIF/CIF, dirección, titular de cuenta, IBAN, BIC
- `field_revenue_percentage` define qué % de donaciones recibe el guía (ej: 70%)
- El perfil se crea al registrarse como profesional o después desde el perfil

### Verificar si el guía puede cobrar
```typescript
const hasProfile = await getProfessionalProfile(userId);
const hasBankInfo = hasProfile?.bankIban && hasProfile?.accountHolder;
if (!hasBankInfo) {
  // Mostrar aviso: "Completa tu perfil profesional para cobrar donaciones"
}
```

---

## Flujo de Registro de Guía

```
1. Usuario se registra como authenticated
2. Solicita ser guía → admin asigna rol 'professional' (manual o automático)
3. Guía completa professional_profile (datos fiscales + IBAN)
4. Guía activa suscripción (Free por defecto, puede upgrade)
5. Guía puede crear tours
```

---

## Relaciones entre Entidades

```
User (user--user)
  ↓ 1:1
ProfessionalProfile (node--professional_profile)
  field_user → User

  ↓ 1:1 (activa)
Subscription (node--subscription)
  field_user → User
  field_plan → SubscriptionPlan

Tour (node--tour)
  uid → User (autor/guía)
  field_city → Taxonomy(cities)
  field_country → Taxonomy(countries)
  field_featured_business_1,2,3 → Business

  ↓ 1:N
TourStep (node--tour_step)
  field_tour → Tour
  field_featured_business → Business

  ↓ N:M (por usuario)
TourUserActivity (node--tour_user_activity)
  field_tour → Tour
  field_user → User
  field_steps_completed → [TourStep] (múltiple)

Donation (node--donation)
  field_tour → Tour
  field_user → User (donante)
  field_guide → User (guía receptor)

Business (node--business)
  field_category → Taxonomy(business_category)
```

---

## Validaciones del Frontend

### Al crear/publicar un tour
- Título: requerido, mínimo 5 caracteres
- Descripción: requerida, mínimo 50 caracteres
- Ciudad/País: requerido
- Al menos 1 tour step: antes de publicar
- Imagen: opcional pero recomendada

### Al donar
- Monto: mínimo €1, máximo €500 (pendiente)
- Usuario debe estar autenticado
- El guía debe tener professional_profile con IBAN

### Al valorar
- Valor entre 1 y 5 (entero o medio punto)
- Solo una vez por tour por usuario (upsert)
- Usuario debe estar autenticado

---

## Idiomas / Multilingual (Pendiente)

- El campo `field_max_languages` en SubscriptionPlan define cuántos idiomas puede tener un tour
- La implementación de multilingüismo en Drupal usará el módulo `content_translation`
- El Language Store en la app gestiona el idioma activo de la UI
- Las queries JSON:API deberán incluir el header `Accept-Language` o parámetro `langcode`
