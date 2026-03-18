# Skill: StepUp Tours — Content Model

Site-specific. Modelo de datos completo: tipos de contenido, campos, relaciones y endpoints JSON:API.

---

## Tipos de Contenido

### node--tour

| Campo Drupal | Tipo | JSON:API attr/rel | Descripción |
|-------------|------|-------------------|-------------|
| `title` | string | attr: `title` | Nombre del tour |
| `status` | boolean | attr: `status` | Publicado (1) o borrador (0) |
| `uid` | entity_ref → user | rel: `uid` | Autor/guía |
| `field_description` | text_with_summary | attr: `field_description` | Descripción rica `{value, format}` |
| `field_image` | image | attr: `field_image` | Imagen cover `{uri: {url}}` |
| `field_duration` | integer | attr: `field_duration` | Duración en minutos |
| `field_average_rate` | float | attr: `field_average_rate` | Promedio ratings 0-5 (string en JSON:API) |
| `field_donation_count` | integer | attr: `field_donation_count` | Nº total donaciones |
| `field_donation_total` | float | attr: `field_donation_total` | Total donado en EUR (string) |
| `field_location` | geofield | attr: `field_location` | `{lat, lon, value}` |
| `field_city` | entity_ref → cities | rel: `field_city` | Ciudad del tour |
| `field_country` | entity_ref → countries | rel: `field_country` | País del tour |
| `field_featured_business_1` | entity_ref → business | rel: `field_featured_business_1` | 1er negocio destacado |
| `field_featured_business_2` | entity_ref → business | rel: `field_featured_business_2` | 2º negocio destacado |
| `field_featured_business_3` | entity_ref → business | rel: `field_featured_business_3` | 3er negocio destacado |

**Endpoint**: `GET /jsonapi/node/tour`
**JSON:API type**: `node--tour`

---

### node--tour_step

| Campo Drupal | Tipo | Descripción |
|-------------|------|-------------|
| `title` | string | Nombre del paso |
| `field_description` | text_with_summary | Descripción del paso |
| `field_order` | integer | Posición en la secuencia (sort=field_order) |
| `field_location` | geofield | Ubicación del paso |
| `field_total_completed` | integer | Contador de usuarios que completaron |
| `field_tour` | entity_ref → tour | Tour al que pertenece |
| `field_featured_business` | entity_ref → business | Negocio destacado en este paso |

**Endpoint**: `GET /jsonapi/node/tour_step`
**Filtro por tour**: `filter[field_tour.id]={tour_uuid}`
**Ordenación**: `sort=field_order`

---

### node--tour_user_activity

| Campo Drupal | Tipo | Descripción |
|-------------|------|-------------|
| `field_user` | entity_ref → user | Usuario |
| `field_tour` | entity_ref → tour | Tour |
| `field_is_favorite` | boolean | Tour en favoritos |
| `field_is_saved` | boolean | Tour guardado para después |
| `field_is_completed` | boolean | Tour completado |
| `field_user_rating` | float | Valoración del usuario 0-5 |
| `field_completed_at` | datetime | Cuándo completó |
| `field_steps_completed` | entity_ref (múltiple) → tour_step | Steps completados |
| `field_xp_awarded` | boolean | Si ya se otorgaron XP |

**Endpoint**: `GET /jsonapi/node/tour_user_activity`
**Filtro por usuario**: `filter[field_user.id]={user_uuid}`
**Filtro por tour**: `filter[field_tour.id]={tour_uuid}`

⚠️ Este nodo es privado: solo el dueño o admin puede leerlo/modificarlo.

---

### node--business

| Campo Drupal | Tipo | Descripción |
|-------------|------|-------------|
| `title` | string | Nombre del negocio |
| `field_description` | text | Descripción |
| `field_logo` | image | Logo `{uri: {url}}` |
| `field_website` | link | URL `{uri}` |
| `field_phone` | string | Teléfono |
| `field_contact_email` | email | Email de contacto |
| `field_location` | geofield | Ubicación del negocio |
| `field_category` | entity_ref → business_category | Categoría del negocio |
| `field_status` | list_string | `active` / `inactive` |

**Endpoint**: `GET /jsonapi/node/business`
**JSON:API type**: `node--business`

---

### node--donation

| Campo Drupal | Tipo | Descripción |
|-------------|------|-------------|
| `field_tour` | entity_ref → tour | Tour donado |
| `field_user` | entity_ref → user | Donante |
| `field_guide` | entity_ref → user | Guía receptor |
| `field_amount` | decimal | Importe en EUR |
| `field_currency` | entity_ref → currency | Moneda |
| `field_status` | list_string | `pending` / `completed` / `failed` |
| `field_guide_revenue` | decimal | Parte del guía |
| `field_platform_revenue` | decimal | Parte de la plataforma |
| `field_payment_reference` | string | ID transacción Stripe |

**Endpoint**: `GET /jsonapi/node/donation`

---

### node--subscription

| Campo Drupal | Tipo | Descripción |
|-------------|------|-------------|
| `field_user` | entity_ref → user | Guía suscrito |
| `field_plan` | entity_ref → subscription_plan | Plan contratado |
| `field_subscription_status` | list_string | `active` / `cancelled` / `expired` / `trial` |
| `field_start_date` | date | Inicio de suscripción |
| `field_end_date` | date | Fin de suscripción |
| `field_auto_renewal` | boolean | Renovación automática |
| `field_last_payment_at` | datetime | Último pago |
| `field_payment_reference` | string | ID customer Stripe |

**Endpoint**: `GET /jsonapi/node/subscription`
**Filtro activa**: `filter[field_user.id]={uuid}&filter[field_subscription_status]=active`

---

### node--subscription_plan

| Campo Drupal | Tipo | Descripción |
|-------------|------|-------------|
| `title` | string | Nombre del plan |
| `field_plan_type` | list_string | `free` / `premium` |
| `field_billing_cycle` | list_string | `monthly` / `annual` / `none` |
| `field_price` | decimal | Precio en EUR |
| `field_max_featured_detail` | integer | Máx. negocios destacados por tour |
| `field_max_featured_steps` | integer | Máx. por step (-1=ilimitado) |
| `field_max_languages` | integer | Máx. idiomas (-1=ilimitado) |
| `field_featured_per_step` | boolean | Permitir featured por step |
| `field_auto_renewal_available` | boolean | Opción de auto-renovación |

**Endpoint**: `GET /jsonapi/node/subscription_plan`

---

### node--professional_profile

| Campo Drupal | Tipo | Descripción |
|-------------|------|-------------|
| `field_user` | entity_ref → user | Guía propietario |
| `field_full_name` | string | Nombre fiscal |
| `field_tax_id` | string | NIF/CIF |
| `field_address` | address | Dirección completa (módulo address) |
| `field_account_holder` | string | Titular de cuenta bancaria |
| `field_bank_iban` | string | IBAN |
| `field_bank_bic` | string | BIC/SWIFT |
| `field_revenue_percentage` | decimal | % de donaciones para el guía (ej: 70) |

**Endpoint**: `GET /jsonapi/node/professional_profile`
**Filtro**: `filter[field_user.id]={user_uuid}`

---

## Taxonomías

### taxonomy_term--countries
| Campo | Descripción |
|-------|-------------|
| `name` | Nombre del país |

**Endpoint**: `GET /jsonapi/taxonomy_term/countries?sort=name`

### taxonomy_term--cities
| Campo | Descripción |
|-------|-------------|
| `name` | Nombre de la ciudad |
| `field_country` | entity_ref → countries |

**Endpoint**: `GET /jsonapi/taxonomy_term/cities?filter[field_country.name]=Spain&sort=name`

### taxonomy_term--business_category
| Campo | Descripción |
|-------|-------------|
| `name` | Nombre de la categoría (Restaurant, Museum, Shop…) |

**Endpoint**: `GET /jsonapi/taxonomy_term/business_category`

### taxonomy_term--currency
| Campo | Descripción |
|-------|-------------|
| `name` | Código de moneda (EUR, USD…) |

---

## Usuarios

### user--user

| Campo Drupal | JSON:API | Descripción |
|-------------|---------|-------------|
| `name` | attr: `name` | Username (login) |
| `mail` | attr: `mail` | Email |
| `field_public_name` | attr: `field_public_name` | Nombre visible |
| `field_experience_points` | attr: `field_experience_points` | XP acumulados |
| `field_country` | rel: `field_country` | País (→ countries taxonomy) |
| `user_picture` | attr: `user_picture` | Avatar `{uri: {url}}` |
| `roles` | rel: `roles` | Roles asignados |

**Endpoint**: `GET /jsonapi/user/user/{uuid}`

---

## Queries JSON:API de Referencia

### Listado de tours para Home (Card view)
```
GET /jsonapi/node/tour
  ?filter[status]=1
  &sort=-field_average_rate
  &page[limit]=20&page[offset]=0
  &fields[node--tour]=title,field_image,field_average_rate,field_duration,field_city,field_country,field_donation_count,status
  &fields[taxonomy_term--cities]=name
  &fields[taxonomy_term--countries]=name
  &include=field_city,field_country
```

### Detalle de tour completo
```
GET /jsonapi/node/tour/{uuid}
  ?fields[node--tour]=title,field_description,field_image,field_average_rate,field_duration,field_donation_count,field_donation_total,field_location,field_city,field_country,field_featured_business_1,field_featured_business_2,field_featured_business_3,status,uid
  &fields[taxonomy_term--cities]=name
  &fields[taxonomy_term--countries]=name
  &fields[node--business]=title,field_logo,field_website,field_category,field_location
  &include=field_city,field_country,field_featured_business_1,field_featured_business_2,field_featured_business_3,uid
```

### Steps de un tour
```
GET /jsonapi/node/tour_step
  ?filter[field_tour.id]={tour_uuid}
  &sort=field_order
  &fields[node--tour_step]=title,field_description,field_order,field_location,field_total_completed,field_featured_business
  &fields[node--business]=title,field_logo,field_website
  &include=field_featured_business
```

### Actividad del usuario en un tour
```
GET /jsonapi/node/tour_user_activity
  ?filter[field_user.id]={user_uuid}
  &filter[field_tour.id]={tour_uuid}
  &include=field_steps_completed
```

### Suscripción activa del guía
```
GET /jsonapi/node/subscription
  ?filter[field_user.id]={user_uuid}
  &filter[field_subscription_status]=active
  &include=field_plan
  &page[limit]=1
```

### Perfil profesional del guía
```
GET /jsonapi/node/professional_profile
  ?filter[field_user.id]={user_uuid}
  &page[limit]=1
```

---

## Mapeo TypeScript Clave

```typescript
// lib/drupal-client.ts

mapDrupalTour(raw) → Tour
  raw.title                    → tour.title
  raw.field_image?.uri?.url    → tour.image
  raw.field_duration           → tour.duration
  parseFloat(raw.field_average_rate) → tour.averageRate
  raw.field_city               → { id, name }
  raw.field_country            → { id, name }
  raw.field_location           → { lat, lon }
  [raw.field_featured_business_1, ...] → tour.featuredBusinesses

mapDrupalActivity(raw) → TourActivity
  raw.field_is_favorite        → activity.isFavorite
  raw.field_steps_completed?.map(s => s.id) → activity.stepsCompleted

mapDrupalSubscription(raw) → Subscription
  raw.field_plan.field_max_featured_detail → plan.maxFeaturedDetail
  raw.field_plan.field_billing_cycle       → plan.billingCycle
```
