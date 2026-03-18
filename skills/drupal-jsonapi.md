# Skill: Drupal JSON:API

Stack tech. Referencia para construir y consumir queries JSON:API en este proyecto.

---

## Estructura Base de URL

```
{BASE_URL}/jsonapi/{entity_type}/{bundle}
https://stepuptours.ddev.site/jsonapi/node/tour
https://stepuptours.ddev.site/jsonapi/taxonomy_term/cities
https://stepuptours.ddev.site/jsonapi/user/user
```

---

## Filtros

### Filtro simple (igualdad)
```
?filter[status]=1
?filter[field_country.name]=Spain
?filter[field_city.name]=Madrid
```

### Filtro con operador
```
?filter[rate][condition][path]=field_average_rate
&filter[rate][condition][operator]=>=
&filter[rate][condition][value]=4
```

Operadores válidos: `=`, `<>`, `<`, `<=`, `>`, `>=`, `STARTS_WITH`, `CONTAINS`, `ENDS_WITH`, `IN`, `NOT IN`, `BETWEEN`, `NOT BETWEEN`, `IS NULL`, `IS NOT NULL`

### Filtro combinado (AND/OR)
```
?filter[group][group][conjunction]=OR
&filter[f1][condition][path]=field_country.name
&filter[f1][condition][value]=Spain
&filter[f1][condition][memberOf]=group
&filter[f2][condition][path]=field_country.name
&filter[f2][condition][value]=France
&filter[f2][condition][memberOf]=group
```

### Filtro por relación (filter path)
```
# Tours del usuario con userId
?filter[field_user.id]=abc-uuid-123

# Tours en ciudad con nombre
?filter[field_city.name]=Barcelona

# Actividades completadas del usuario
?filter[field_user.id]=abc&filter[field_is_completed]=1
```

---

## Sparse Fieldsets (selección de campos)

Reducen el tamaño de la respuesta. Siempre usarlos en producción.

```
?fields[node--tour]=title,field_image,field_duration,field_city,field_country
&fields[taxonomy_term--cities]=name
&fields[taxonomy_term--countries]=name
```

En el cliente TypeScript (`drupal-client.ts`):
```typescript
const TOUR_CARD_FIELDS = {
  'node--tour': ['title', 'field_image', 'field_average_rate', 'field_duration', 'field_city', 'field_country'],
  'taxonomy_term--cities': ['name'],
  'taxonomy_term--countries': ['name'],
};
buildFields(TOUR_CARD_FIELDS)
// → "fields[node--tour]=title,field_image,...&fields[taxonomy_term--cities]=name"
```

---

## Includes (relaciones anidadas)

Carga relaciones en el mismo request. Evita N+1 queries.

```
?include=field_city,field_country,field_featured_business_1
```

Relaciones anidadas:
```
?include=field_tour,field_tour.field_city
```

Los recursos incluidos aparecen en `data.included[]`. `jsona` los deserializa automáticamente en objetos anidados.

---

## Ordenación

```
?sort=field_order           # Ascendente
?sort=-field_average_rate   # Descendente (-)
?sort=field_country.name,title  # Múltiple
```

---

## Paginación (offset-based)

```
?page[limit]=20&page[offset]=0   # Página 1
?page[limit]=20&page[offset]=20  # Página 2
```

La respuesta incluye `meta.count` con el total de registros y `links.next` con la URL de la siguiente página.

En el cliente:
```typescript
buildPage(page: number, limit: number) {
  return `page[limit]=${limit}&page[offset]=${(page - 1) * limit}`;
}
```

---

## Crear un Recurso (POST)

```http
POST /jsonapi/node/tour
Content-Type: application/vnd.api+json
Authorization: Basic {token}

{
  "data": {
    "type": "node--tour",
    "attributes": {
      "title": "Historic Madrid Walk",
      "field_duration": 120,
      "field_description": { "value": "...", "format": "basic_html" },
      "status": false
    },
    "relationships": {
      "field_city": {
        "data": { "type": "taxonomy_term--cities", "id": "uuid-cities" }
      },
      "field_country": {
        "data": { "type": "taxonomy_term--countries", "id": "uuid-countries" }
      }
    }
  }
}
```

---

## Actualizar un Recurso (PATCH)

```http
PATCH /jsonapi/node/tour/{uuid}
Content-Type: application/vnd.api+json
Authorization: Basic {token}

{
  "data": {
    "type": "node--tour",
    "id": "{uuid}",
    "attributes": {
      "field_average_rate": "4.5",
      "field_donation_count": 10
    }
  }
}
```

Solo se envían los campos que cambian.

---

## Relaciones múltiples (cardinality > 1)

```json
"relationships": {
  "field_steps_completed": {
    "data": [
      { "type": "node--tour_step", "id": "uuid-step-1" },
      { "type": "node--tour_step", "id": "uuid-step-2" }
    ]
  }
}
```

---

## Respuesta JSON:API

```json
{
  "data": {
    "id": "uuid",
    "type": "node--tour",
    "attributes": { ... },
    "relationships": {
      "field_city": { "data": { "type": "taxonomy_term--cities", "id": "city-uuid" } }
    }
  },
  "included": [
    { "id": "city-uuid", "type": "taxonomy_term--cities", "attributes": { "name": "Madrid" } }
  ],
  "meta": { "count": 47 },
  "links": { "next": { "href": "..." } }
}
```

Con `jsona.deserialize()` los `included` se inyectan como propiedades del objeto principal:
```typescript
tour.field_city.name  // "Madrid" (no hace falta buscar en included)
```

---

## Permisos JSON:API en Drupal

### Habilitar escritura global
```
/admin/config/services/jsonapi → Allow all JSON:API create/update/delete operations
```

### Permisos por operación (en roles de Drupal)
```
# anonymous
- "Access GET on Tour resource"
- "Access GET on Tour Step resource"

# authenticated
- "Create Tour User Activity resource"
- "Edit own Tour User Activity resource"

# professional
- "Create Tour resource"
- "Edit own Tour resource"
- "Delete own Tour resource"
```

### Filtros con datos privados — Requieren permiso especial
Para filtrar por `field_user` (campo de usuario), el usuario debe tener:
`Access filter by field_user on Tour User Activity`

---

## Módulo jsonapi_extras

Instalado en este proyecto. Permite:
- Deshabilitar endpoints (ej: ocultar `node--article` de la API)
- Renombrar paths: `/jsonapi/node/tour` → `/jsonapi/tours`
- Alias de campos: `field_average_rate` → `average_rate`
- Incluir campos calculados vía ResourceFieldEnhancer

Config en `/admin/config/services/jsonapi/resource_types`

---

## Autenticación en Requests

### Basic Auth (actual implementación)
```
Authorization: Basic {base64(username:password)}
```

### Simple OAuth (Bearer Token — para implementar)
```
# 1. Obtener token
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=password&client_id={id}&client_secret={secret}&username={user}&password={pass}

# 2. Usar token
Authorization: Bearer {access_token}
```

---

## Endpoints del Proyecto

| Recurso | Endpoint |
|---------|----------|
| Tours | `/jsonapi/node/tour` |
| Tour Steps | `/jsonapi/node/tour_step` |
| Businesses | `/jsonapi/node/business` |
| Donations | `/jsonapi/node/donation` |
| Subscriptions | `/jsonapi/node/subscription` |
| Sub. Plans | `/jsonapi/node/subscription_plan` |
| Pro. Profiles | `/jsonapi/node/professional_profile` |
| Tour Activity | `/jsonapi/node/tour_user_activity` |
| Users | `/jsonapi/user/user` |
| Countries | `/jsonapi/taxonomy_term/countries` |
| Cities | `/jsonapi/taxonomy_term/cities` |
| Biz. Category | `/jsonapi/taxonomy_term/business_category` |

---

## Debugging JSON:API

```bash
# Ver respuesta completa en terminal
curl -H "Accept: application/vnd.api+json" \
  "https://stepuptours.ddev.site/jsonapi/node/tour?page[limit]=1" | jq .

# Con auth
curl -H "Accept: application/vnd.api+json" \
  -H "Authorization: Basic $(echo -n 'admin:admin' | base64)" \
  "https://stepuptours.ddev.site/jsonapi/user/user" | jq .data[0]
```
