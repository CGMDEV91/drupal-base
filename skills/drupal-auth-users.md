# Skill: Drupal Auth & Users

Stack tech. Autenticación, roles, permisos y gestión de usuarios en Drupal 11 + JSON:API.

---

## Roles del Sistema

| Rol | Machine Name | Descripción |
|-----|-------------|-------------|
| Anónimo | `anonymous` | Sin sesión |
| Autenticado | `authenticated` | Con cuenta registrada |
| Profesional | `professional` | Guía que crea tours |
| Administrador | `administrator` | Acceso total |

Los roles son acumulativos: un `professional` también tiene permisos de `authenticated`.

---

## Autenticación Actual: Basic Auth

Módulo `basic_auth` de Drupal Core.

```
Authorization: Basic {base64(username:password)}
```

El token es simplemente `btoa('usuario:contraseña')` y no expira (válido mientras las credenciales sean correctas).

### Activar en Drupal
```bash
ddev drush en basic_auth -y
```

### Flujo de login en la app
```typescript
// 1. Crear token
const token = btoa(`${username}:${password}`);

// 2. Verificar contra JSON:API (obtener perfil)
GET /jsonapi/user/user?filter[name]={username}
Authorization: Basic {token}

// 3. Obtener roles del usuario
GET /jsonapi/user/user/{uuid}?fields[user--user]=roles
Authorization: Basic {token}
// Roles están en: data.relationships.roles.data[].meta.drupal_internal__target_id

// 4. Guardar sesión
sessionStorage.saveSession({ token, tokenType: 'basic', user, expiresAt: null })
```

---

## OAuth 2.0 / Simple OAuth (Para implementar)

Módulo `simple_oauth`. Permite tokens Bearer con expiración.

### Instalación
```bash
composer require drupal/simple_oauth
ddev drush en simple_oauth -y
```

### Configuración
```
/admin/config/people/simple_oauth
→ Access token expiration: 3600 (1 hora)
→ Refresh token expiration: 2592000 (30 días)
→ Generar claves: drush simple-oauth:generate-keys ../keys
```

### Crear Client (consumer)
```
/admin/config/services/consumer/add
→ Label: StepUp Tours App
→ Secret: {secret}
→ Scopes: (dejar vacío = todos los permisos del usuario)
→ Redirect: stepuptours://callback
```

### Token Request
```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=password
&client_id={client_uuid}
&client_secret={secret}
&username={user}
&password={pass}
```

```json
{
  "token_type": "Bearer",
  "expires_in": 3600,
  "access_token": "eyJ...",
  "refresh_token": "def..."
}
```

### Refresh Token
```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={refresh_token}
&client_id={client_uuid}
&client_secret={secret}
```

---

## Campos de Usuario en Drupal

El `user--user` bundle tiene estos campos custom añadidos al proyecto:

| Campo Drupal | Tipo | Propósito |
|-------------|------|-----------|
| `field_public_name` | string | Nombre visible (no username) |
| `field_experience_points` | integer | XP acumulados |
| `field_country` | entity_reference (countries) | País del usuario |
| `user_picture` | image | Avatar |
| `roles` | (relationship) | Roles asignados |
| `name` | string | Username (sistema) |
| `mail` | email | Email |

### Query JSON:API para perfil completo
```
GET /jsonapi/user/user/{uuid}
  ?fields[user--user]=name,mail,field_public_name,field_experience_points,field_country,user_picture
  &include=field_country
```

---

## Registrar Usuario via JSON:API

```http
POST /jsonapi/user/user
Content-Type: application/vnd.api+json

{
  "data": {
    "type": "user--user",
    "attributes": {
      "name": "john_traveler",
      "mail": "john@example.com",
      "pass": "password123",
      "field_public_name": "John Traveler"
    }
  }
}
```

Requiere permiso: `POST to user--user endpoint` (anónimo puede registrarse si está habilitado en `/admin/config/people/accounts`).

---

## Actualizar Perfil de Usuario

```http
PATCH /jsonapi/user/user/{uuid}
Authorization: Basic {token}

{
  "data": {
    "type": "user--user",
    "id": "{uuid}",
    "attributes": {
      "field_public_name": "John Explorer",
      "field_experience_points": 150
    },
    "relationships": {
      "field_country": {
        "data": { "type": "taxonomy_term--countries", "id": "country-uuid" }
      }
    }
  }
}
```

Solo el propio usuario o admin puede editar (Drupal lo verifica automáticamente).

---

## Asignar Rol Professional

Solo desde Drupal admin o código (no via JSON:API por defecto):

```bash
ddev drush urol professional --uid=2
```

```php
$user = \Drupal\user\Entity\User::load(2);
$user->addRole('professional');
$user->save();
```

---

## Gestión de Sesión en React Native

```typescript
// lib/session.ts
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'auth_session';

export const sessionStorage = {
  async saveSession(session: AuthSession) {
    // Token en SecureStore (encriptado)
    await SecureStore.setItemAsync('auth_token', session.token);
    // User data en AsyncStorage
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },
  async getSession(): Promise<AuthSession | null> {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  async clearSession() {
    await SecureStore.deleteItemAsync('auth_token');
    await AsyncStorage.removeItem(SESSION_KEY);
  },
  async isAuthenticated(): Promise<boolean> {
    const token = await SecureStore.getItemAsync('auth_token');
    return !!token;
  }
};
```

---

## Inactivity Tracker

```typescript
// Auto-logout por inactividad
export const inactivityTracker = {
  timer: null as ReturnType<typeof setTimeout> | null,
  TIMEOUT_MS: 30 * 60 * 1000, // 30 minutos

  start(onExpire: () => void) {
    this.reset(onExpire);
    // Registrar eventos de actividad (gestos, etc.)
  },
  reset(onExpire: () => void) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(onExpire, this.TIMEOUT_MS);
  },
  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
};
```

---

## Permisos JSON:API Clave por Rol

### anonymous
```
Access GET on Tour content
Access GET on Tour Step content
Access GET on Business content
Access GET on Subscription Plan content
```

### authenticated
```
(todo lo de anonymous)
Create Tour User Activity content
Edit own Tour User Activity content
View own unpublished content
Access POST on Donation content
```

### professional
```
(todo lo de authenticated)
Create Tour content
Edit own Tour content
Delete own Tour content
Create Tour Step content
Edit own Tour Step content
Create Business content
Edit own Business content
```

---

## Proteger Endpoints por Rol en Drupal

Usando `hook_jsonapi_entity_filter_access()` o configurando permisos en `/admin/people/permissions` bajo la sección "JSON:API Resource Permissions".

Para filtros que exponen datos privados (ej: filtrar actividades por usuario):
```php
// Sólo el propio usuario puede filtrar por field_user
function stepup_tours_jsonapi_entity_filter_access(EntityTypeInterface $entity_type, AccountInterface $account) {
  if ($entity_type->id() === 'node') {
    return AccessResult::allowedIfHasPermission($account, 'access content');
  }
}
```

---

## Redis para Sesiones (opcional)

```bash
composer require drupal/redis
ddev drush en redis -y
```

```php
// web/sites/default/settings.php
$settings['redis.connection']['interface'] = 'PhpRedis';
$settings['redis.connection']['host'] = 'redis';
$settings['redis.connection']['port'] = 6379;
$settings['cache']['default'] = 'cache.backend.redis';
$settings['cache']['bins']['form'] = 'cache.backend.database';
```

Para sesiones PHP (no las de la app RN):
```php
$settings['session.storage.options']['cookie_secure'] = FALSE; // dev
```
