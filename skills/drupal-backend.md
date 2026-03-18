# Skill: Drupal Backend (9/10/11)

Stack tech. Referencia para trabajar con Drupal 11 headless.

---

## Crear un Content Type via Config

Los content types se definen en `config/sync/node.type.{bundle}.yml`:

```yaml
# config/sync/node.type.tour.yml
langcode: en
status: true
dependencies: {}
name: Tour
type: tour
description: 'Self-guided tour experience'
help: ''
new_revision: false
preview_mode: 1
display_submitted: false
```

Siempre exportar con `drush cex` y commitear. Nunca editar config de producción por UI sin exportar.

---

## Añadir un Campo via Config

### 1. Field Storage (compartida entre bundles)
```yaml
# config/sync/field.storage.node.field_duration.yml
langcode: en
status: true
type: integer
entity_type: node
field_name: field_duration
cardinality: 1
settings:
  unsigned: false
  size: normal
```

### 2. Field Instance (por bundle)
```yaml
# config/sync/field.field.node.tour.field_duration.yml
langcode: en
status: true
entity_type: node
bundle: tour
field_name: field_duration
label: 'Duration (minutes)'
required: false
default_value: []
settings: {}
```

### 3. Form/View Display
```yaml
# config/sync/core.entity_form_display.node.tour.default.yml
# Incluir en 'content' la entrada del campo
content:
  field_duration:
    type: number
    weight: 5
    settings: {}
```

---

## Tipos de Campo Comunes

| Tipo | Config `type` | Uso |
|------|--------------|-----|
| Texto corto | `string` | Título, nombre |
| Texto largo | `text_with_summary` | Descripción rica |
| Entero | `integer` | Duración, orden |
| Decimal | `decimal` | Precio, porcentaje |
| Float | `float` | Rating, totales |
| Boolean | `boolean` | Flags on/off |
| Entity Reference | `entity_reference` | Relaciones |
| Image | `image` | Imágenes con alt |
| Link | `link` | URLs externas |
| Email | `email` | Correo electrónico |
| DateTime | `datetime` | Fechas con hora |
| Date | `datetime` (date_only) | Solo fecha |
| Geofield | `geofield` | Lat/lon |
| Address | `address` | Direcciones estructuradas |
| List (select) | `list_string` | Valores predefinidos |

### Entity Reference a Taxonomy
```yaml
# field.storage.node.field_city.yml
type: entity_reference
settings:
  target_type: taxonomy_term
```
```yaml
# field.field.node.tour.field_city.yml
settings:
  handler: default:taxonomy_term
  handler_settings:
    target_bundles:
      cities: cities
```

---

## Hooks Importantes

### `hook_node_presave()` — Calcular valores antes de guardar
```php
// web/modules/custom/stepup_tours/stepup_tours.module
use Drupal\node\NodeInterface;

function stepup_tours_node_presave(NodeInterface $node) {
  if ($node->getType() === 'tour') {
    // Recalcular rating promedio antes de guardar
    _stepup_recalculate_tour_rating($node);
  }
}
```

### `hook_jsonapi_entity_filter_access()` — Control de acceso a filtros
```php
function stepup_tours_jsonapi_entity_filter_access(EntityTypeInterface $entity_type, AccountInterface $account) {
  // Permitir filtrar por field_user solo al propio usuario o admin
  if ($entity_type->id() === 'node' && !$account->hasPermission('administer nodes')) {
    return AccessResult::allowed()->addCacheContexts(['user']);
  }
}
```

### `hook_ENTITY_TYPE_access()` — Permisos granulares
```php
function stepup_tours_node_access(NodeInterface $node, $operation, AccountInterface $account) {
  if ($node->getType() === 'tour_user_activity' && $operation === 'view') {
    // Solo el dueño o admin puede ver actividades
    $owner_id = $node->get('field_user')->target_id;
    if ($account->id() == $owner_id || $account->hasPermission('administer nodes')) {
      return AccessResult::allowed();
    }
    return AccessResult::forbidden();
  }
  return AccessResult::neutral();
}
```

---

## Módulo Custom: Estructura Mínima

```
web/modules/custom/stepup_tours/
├── stepup_tours.info.yml
├── stepup_tours.module
├── stepup_tours.services.yml (opcional)
└── src/
    ├── Service/
    │   └── TourService.php
    └── EventSubscriber/
        └── TourEventSubscriber.php
```

```yaml
# stepup_tours.info.yml
name: 'StepUp Tours'
type: module
description: 'Custom business logic for StepUp Tours'
core_version_requirement: ^10 || ^11
package: Custom
dependencies:
  - drupal:node
  - drupal:jsonapi
```

---

## Config Sync: Workflow

```bash
# Exportar cambios locales
ddev drush cex -y

# Importar config desde ficheros
ddev drush cim -y

# Ver diferencias antes de importar
ddev drush config:diff

# Limpiar caché tras importar
ddev drush cr
```

**Regla**: Config en `config/sync/` es la fuente de verdad. Los cambios en UI deben exportarse siempre.

---

## Taxonomías

### Crear términos por código
```php
$term = \Drupal\taxonomy\Entity\Term::create([
  'vid' => 'cities',
  'name' => 'Madrid',
]);
$term->save();
```

### Referenciar en JSON:API
```
GET /jsonapi/taxonomy_term/cities?sort=name
GET /jsonapi/taxonomy_term/cities?filter[name]=Madrid
```

---

## Campos Geofield

El módulo `geofield` almacena lat/lon y más. En JSON:API devuelve:
```json
"field_location": {
  "value": "POINT (2.1734 41.3851)",
  "geo_type": "Point",
  "lat": 41.3851,
  "lon": 2.1734,
  "left": 2.1734,
  "top": 41.3851,
  "right": 2.1734,
  "bottom": 41.3851,
  "geohash": "sp3e3"
}
```

En el cliente TS: `{ lat: raw.field_location.lat, lon: raw.field_location.lon }`

---

## Permisos JSON:API por Rol

Configurar en `/admin/config/services/jsonapi` o via config YAML:

```yaml
# Siempre necesario para acceso público
jsonapi.settings:
  read_only: false  # Permitir escritura

# Permisos de rol para content types
# Se gestionan en /admin/people/permissions
# Buscar: "JSON:API"
```

Permisos clave por rol:
- **anonymous**: `access content` (ver nodos publicados)
- **authenticated**: `create tour_user_activity content`, `edit own tour_user_activity content`
- **professional**: `create tour content`, `edit own tour content`, `create tour_step content`
- **administrator**: All permissions

---

## Comandos de Desarrollo Frecuentes

```bash
ddev drush en -y module_name          # Activar módulo
ddev drush pmu module_name            # Desactivar módulo
ddev drush entity:delete node --bundle=tour  # Borrar entidades
ddev drush php:eval "drupal_flush_all_caches();"  # Cache por código
ddev drush watchdog:tail              # Ver logs en tiempo real
ddev drush urol professional uid=2    # Asignar rol a usuario
```
