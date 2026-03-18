
# StepUp Tours — API Test Results

> Generado el: `2026-03-15 15:32:42`  
> Base URL: `https://stepuptours.ddev.site`

## Índice

1. [Endpoints públicos](#endpoints-públicos)
2. [Usuario autenticado — john_traveler](#usuario-autenticado--john_traveler)
3. [Usuario profesional — maria_guide](#usuario-profesional--maria_guide)
4. [Administrador — admin](#administrador--admin)


## Endpoints públicos


---


### 01 — Homepage: todos los tours

**Usuario:** `anónimo`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/tour?filter[status]=1&sort=-field_average_rate&page[limit]=20&page[offset]=0&fields[node--tour]=title,field_description,field_image,field_average_rate,field_duration,field_donation_count,field_city,field_country&include=field_city,field_country
```
**Estado:** `✅ 200`

| Title | Rating | Duración | Donaciones | Ciudad | País |
|---|---|---|---|---|---|
| Historic Madrid: From the Royal Palace to the Prado | 0.00 | 180 min | 0 | Madrid | Spain |
| Gaudí's Barcelona: Modernisme and Mediterranean Magic | 0.00 | 210 min | 0 | Barcelona | Spain |
| Eternal Rome: From the Colosseum to the Trevi Fountain | 0.00 | 240 min | 0 | Rome | Italy |

> **Total:** 3 tour(s)


---


### 02 — Homepage: tours por país (Spain)

**Usuario:** `anónimo`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/tour?filter[status]=1&filter[field_country.name]=Spain&sort=-field_average_rate&page[limit]=20&fields[node--tour]=title,field_image,field_average_rate,field_duration,field_city&include=field_city
```
**Estado:** `✅ 200`

| Title | Rating | Duración | Donaciones | Ciudad | País |
|---|---|---|---|---|---|
| Historic Madrid: From the Royal Palace to the Prado | 0.00 | 180 min | — | Madrid | — |
| Gaudí's Barcelona: Modernisme and Mediterranean Magic | 0.00 | 210 min | — | Barcelona | — |

> **Total:** 2 tour(s)


---


### 03 — Homepage: tours con rating >= 4

**Usuario:** `anónimo`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/tour?filter[status]=1&filter[rate][condition][path]=field_average_rate&filter[rate][condition][operator]=>=&filter[rate][condition][value]=4&sort=-field_average_rate&page[limit]=20&fields[node--tour]=title,field_image,field_average_rate,field_duration,field_city&include=field_city
```
**Estado:** `✅ 200`

> Sin resultados.


---


### 04 — Tour detail: Historic Madrid

**Usuario:** `anónimo`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/tour/71cdf528-1eba-49a0-860c-41d556fc765e?include=field_city,field_country,field_featured_business_1,field_featured_business_2,field_featured_business_3,uid
```
**Estado:** `✅ 200`

| Campo | Valor |
|---|---|
| Title | Historic Madrid: From the Royal Palace to the Prado |
| Duración | 180 min |
| Rating medio | 0.00 |
| Donaciones | 0 |
| Total donado | 0.00 € |
| Ciudad | Madrid |
| País | Spain |
| Autor | — |
| Negocio slot 1 | — |
| Negocio slot 2 | — |
| Negocio slot 3 | — |

**Descripción:**

> Discover the heart of Spain's capital on this immersive walking tour through Madrid's most iconic historic district. Starting at the majestic Royal Palace — one of the largest in Europe — you'll journey through centuries of Spanish history, art, and culture. Along the way you'll cross the legendary ...


## Usuario autenticado — john_traveler


---


### 05 — Steps del tour Madrid

**Usuario:** `john_traveler`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/tour_step?filter[field_tour.id]=71cdf528-1eba-49a0-860c-41d556fc765e&sort=field_order&include=field_featured_business
```
**Estado:** `✅ 200`

| Orden | Title | Completados | Negocio | Lat | Lon |
|---|---|---|---|---|---|
| 1 | Palacio Real — The Royal Palace | 0 | — | 40.4179 | -3.7143 |
| 2 | Catedral de la Almudena | 0 | — | 40.4154 | -3.7144 |
| 3 | Plaza Mayor — The Grand Square | 0 | — | 40.4154 | -3.7074 |
| 4 | Mercado de San Miguel | 0 | — | 40.4151 | -3.7087 |
| 5 | Museo Nacional del Prado | 0 | — | 40.4138 | -3.6921 |

---


### 06 — Actividad en tour Madrid

**Usuario:** `john_traveler`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/tour_user_activity?filter[field_user.id]=86a2d84f-6437-4657-a271-404c2552b968&filter[field_tour.id]=71cdf528-1eba-49a0-860c-41d556fc765e&include=field_steps_completed
```
**Estado:** `✅ 200`

> Sin actividad registrada para este usuario en este tour.


---


### 07 — Perfil de john_traveler

**Usuario:** `john_traveler`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/user/user/86a2d84f-6437-4657-a271-404c2552b968?fields[user--user]=name,field_public_name,mail,created,field_experience_points&include=field_country
```
**Estado:** `✅ 200`

| Campo | Valor |
|---|---|
| Username | john_traveler |
| Nombre público | John Traveler |
| Email | john.traveler@example.com |
| Registrado | 2026-03-12T12:52:30 |
| País | — |
| XP | — |

---


### 08 — Todos los tours (favoritos, guardados, completados)

**Usuario:** `john_traveler`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/tour_user_activity?filter[field_user.id]=86a2d84f-6437-4657-a271-404c2552b968&fields[node--tour_user_activity]=field_is_favorite,field_is_saved,field_is_completed,field_user_rating,field_completed_at,field_xp_awarded&include=field_tour,field_tour.field_city&fields[node--tour]=title,field_image,field_average_rate,field_duration,field_city
```
**Estado:** `✅ 200`

> Sin actividad registrada.


---


### 09 — Donaciones realizadas

**Usuario:** `john_traveler`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/donation?filter[field_user.id]=86a2d84f-6437-4657-a271-404c2552b968&sort=-created&include=field_tour,field_currency&fields[node--donation]=field_amount,field_currency,field_guide_revenue,field_platform_revenue,created&fields[node--tour]=title
```
**Estado:** `✅ 200`

> Sin donaciones.


## Usuario profesional — maria_guide


---


### 05b — Steps del tour Madrid

**Usuario:** `maria_guide`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/tour_step?filter[field_tour.id]=71cdf528-1eba-49a0-860c-41d556fc765e&sort=field_order&include=field_featured_business
```
**Estado:** `✅ 200`

| Orden | Title | Completados | Negocio | Lat | Lon |
|---|---|---|---|---|---|
| 1 | Palacio Real — The Royal Palace | 0 | — | 40.4179 | -3.7143 |
| 2 | Catedral de la Almudena | 0 | — | 40.4154 | -3.7144 |
| 3 | Plaza Mayor — The Grand Square | 0 | — | 40.4154 | -3.7074 |
| 4 | Mercado de San Miguel | 0 | — | 40.4151 | -3.7087 |
| 5 | Museo Nacional del Prado | 0 | — | 40.4138 | -3.6921 |

---


### 10 — Perfil de facturación

**Usuario:** `maria_guide`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/professional_profile?filter[field_user.id]=2151c6d3-4d7a-493f-81c7-1b94e712f64e&fields[node--professional_profile]=field_full_name,field_tax_id,field_address,field_account_holder,field_revenue_percentage
```
**Estado:** `✅ 200`

| Campo | Valor |
|---|---|
| Nombre legal | María García López |
| Tax ID | B12345678 |
| Titular cuenta | María García López |
| Revenue % | 75.00 % |

---


### 11 — Suscripción activa

**Usuario:** `maria_guide`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/subscription?filter[field_user.id]=2151c6d3-4d7a-493f-81c7-1b94e712f64e&filter[field_subscription_status]=active&include=field_plan&fields[node--subscription]=field_subscription_status,field_start_date,field_end_date,field_auto_renewal,field_last_payment_at&fields[node--subscription_plan]=title,field_plan_type,field_price,field_billing_cycle,field_max_featured_detail,field_max_featured_steps,field_max_languages,field_featured_per_step
```
**Estado:** `✅ 200`

> Sin suscripción activa.


---


### 12 — Tours creados

**Usuario:** `maria_guide`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/tour?filter[uid.id]=2151c6d3-4d7a-493f-81c7-1b94e712f64e&sort=-created&include=field_city&fields[node--tour]=title,field_image,field_average_rate,field_duration,field_donation_count,field_donation_total,status,created,field_city
```
**Estado:** `✅ 200`

> Sin tours creados.


---


### 13 — Donaciones recibidas en mis tours

**Usuario:** `maria_guide`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/donation?filter[field_tour.uid.id]=2151c6d3-4d7a-493f-81c7-1b94e712f64e&sort=-created&include=field_tour,field_currency&fields[node--donation]=field_amount,field_guide_revenue,field_platform_revenue,field_currency,created&fields[node--tour]=title
```
**Estado:** `✅ 200`

> Sin donaciones.


## Administrador — admin


---


### 05c — Steps del tour Madrid

**Usuario:** `admin`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/tour_step?filter[field_tour.id]=71cdf528-1eba-49a0-860c-41d556fc765e&sort=field_order&include=field_featured_business
```
**Estado:** `✅ 200`

| Orden | Title | Completados | Negocio | Lat | Lon |
|---|---|---|---|---|---|
| 1 | Palacio Real — The Royal Palace | 0 | — | 40.4179 | -3.7143 |
| 2 | Catedral de la Almudena | 0 | — | 40.4154 | -3.7144 |
| 3 | Plaza Mayor — The Grand Square | 0 | — | 40.4154 | -3.7074 |
| 4 | Mercado de San Miguel | 0 | — | 40.4151 | -3.7087 |
| 5 | Museo Nacional del Prado | 0 | — | 40.4138 | -3.6921 |

---


### 14 — Todos los tours del sistema

**Usuario:** `admin`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/tour?sort=-created&page[limit]=50&include=field_city,uid&fields[node--tour]=title,field_average_rate,field_donation_count,field_donation_total,status,created,field_city&fields[user--user]=name,field_public_name
```
**Estado:** `✅ 200`

| Title | Rating | Donaciones | Total € | Publicado | Autor | Ciudad |
|---|---|---|---|---|---|---|
| Historic Madrid: From the Royal Palace to the Prado | 0.00 | 0 | 0.00 | ✅ | — | Madrid |
| Gaudí's Barcelona: Modernisme and Mediterranean Magic | 0.00 | 0 | 0.00 | ✅ | — | Barcelona |
| Eternal Rome: From the Colosseum to the Trevi Fountain | 0.00 | 0 | 0.00 | ✅ | — | Rome |

---


### 15 — Todas las donaciones

**Usuario:** `admin`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/donation?sort=-created&page[limit]=50&include=field_tour,field_user,field_currency&fields[node--donation]=field_amount,field_guide_revenue,field_platform_revenue,created&fields[node--tour]=title&fields[user--user]=name,field_public_name
```
**Estado:** `✅ 200`

> Sin donaciones.


---


### 16 — Todas las suscripciones activas

**Usuario:** `admin`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/subscription?filter[field_subscription_status]=active&sort=-field_start_date&include=field_user,field_plan&fields[node--subscription]=field_subscription_status,field_start_date,field_end_date,field_auto_renewal,field_last_payment_at&fields[user--user]=name,field_public_name&fields[node--subscription_plan]=title,field_plan_type,field_price,field_billing_cycle
```
**Estado:** `✅ 200`

> Sin suscripciones activas.


---


### 17 — Todos los perfiles profesionales

**Usuario:** `admin`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/professional_profile?sort=-created&include=field_user&fields[node--professional_profile]=field_full_name,field_tax_id,field_address,field_revenue_percentage,created&fields[user--user]=name,mail,field_public_name
```
**Estado:** `✅ 200`

| Usuario | Email | Nombre legal | Tax ID | Revenue % |
|---|---|---|---|---|
| — | — | María García López | B12345678 | 75.00 % |

---


### 18 — Planes de suscripción

**Usuario:** `admin`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/subscription_plan?filter[status]=1&sort=field_price&fields[node--subscription_plan]=title,field_plan_type,field_billing_cycle,field_price,field_max_featured_detail,field_max_featured_steps,field_max_languages,field_featured_per_step,field_auto_renewal,status
```
**Estado:** `✅ 200`

| Plan | Tipo | Ciclo | Precio | Slots detalle | Slots steps | Idiomas | Por step | Activo |
|---|---|---|---|---|---|---|---|---|
| Free | free | none | 0.00 € | 1 | 3 | 5 | ❌ | ✅ |

---


### 19 — Negocios activos

**Usuario:** `admin`  
**URL:**
```
https://stepuptours.ddev.site/jsonapi/node/business?filter[field_status]=active&sort=title&fields[node--business]=title,field_description,field_website,field_status&include=field_category
```
**Estado:** `✅ 200`

> Sin negocios activos.
