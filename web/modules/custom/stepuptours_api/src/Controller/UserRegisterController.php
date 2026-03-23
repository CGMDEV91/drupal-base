<?php

declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\user\Entity\User;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Endpoint de registro público para la app StepUp Tours.
 *
 * POST /api/user/register
 * Body JSON: { "name": "...", "mail": "...", "pass": "..." }
 */
class UserRegisterController extends ControllerBase {

  /**
   * Registra un nuevo usuario si el registro está habilitado para visitantes.
   */
  public function register(Request $request): JsonResponse {

    // ── CORS preflight ────────────────────────────────────────────────────────
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    // ── Verificar que el registro está abierto ────────────────────────────────
    $register_setting = $this->config('user.settings')->get('register');
    if ($register_setting === 'admin_only') {
      return $this->corsResponse(new JsonResponse(
        ['error' => 'El registro de nuevas cuentas está desactivado.'],
        403
      ));
    }

    // ── Parsear body ──────────────────────────────────────────────────────────
    $data = json_decode($request->getContent(), TRUE);
    if (!is_array($data)) {
      return $this->corsResponse(new JsonResponse(
        ['error' => 'El cuerpo de la petición no es JSON válido.'],
        400
      ));
    }

    $name        = trim((string) ($data['name'] ?? ''));
    $mail        = trim((string) ($data['mail'] ?? ''));
    $pass        = (string) ($data['pass'] ?? '');
    $public_name = trim((string) ($data['field_public_name'] ?? ''));
    $role        = trim((string) ($data['role'] ?? ''));

    // ── Validación básica ─────────────────────────────────────────────────────
    $errors = [];

    if ($name === '') {
      $errors['name'] = 'El nombre de usuario es obligatorio.';
    }
    elseif (mb_strlen($name) < 3) {
      $errors['name'] = 'El nombre de usuario debe tener al menos 3 caracteres.';
    }
    elseif (user_validate_name($name)) {
      $errors['name'] = (string) user_validate_name($name);
    }

    if ($mail === '') {
      $errors['mail'] = 'El email es obligatorio.';
    }
    elseif (!\Drupal::service('email.validator')->isValid($mail)) {
      $errors['mail'] = 'El email no es válido.';
    }

    if ($pass === '') {
      $errors['pass'] = 'La contraseña es obligatoria.';
    }
    elseif (mb_strlen($pass) < 8) {
      $errors['pass'] = 'La contraseña debe tener al menos 8 caracteres.';
    }

    if (!empty($errors)) {
      return $this->corsResponse(new JsonResponse(['errors' => $errors], 422));
    }

    // ── Verificar unicidad ────────────────────────────────────────────────────
    $existing_name = \Drupal::entityQuery('user')
      ->condition('name', $name)
      ->accessCheck(FALSE)
      ->execute();

    if (!empty($existing_name)) {
      return $this->corsResponse(new JsonResponse(
        ['errors' => ['name' => 'El nombre de usuario ya está en uso.']],
        409
      ));
    }

    $existing_mail = \Drupal::entityQuery('user')
      ->condition('mail', $mail)
      ->accessCheck(FALSE)
      ->execute();

    if (!empty($existing_mail)) {
      return $this->corsResponse(new JsonResponse(
        ['errors' => ['mail' => 'El email ya está registrado.']],
        409
      ));
    }

    // ── Crear usuario ─────────────────────────────────────────────────────────
    try {
      $user = User::create([
        'name'   => $name,
        'mail'   => $mail,
        'pass'   => $pass,
        'status' => ($register_setting === 'visitors') ? 1 : 0,
        'langcode' => \Drupal::languageManager()->getCurrentLanguage()->getId(),
      ]);

      if ($public_name !== '') {
        $user->set('field_public_name', $public_name);
      }

      if ($role === 'professional') {
        $user->addRole('professional');
      }

      $violations = $user->validate();
      if (count($violations) > 0) {
        $msg = (string) $violations->get(0)->getMessage();
        return $this->corsResponse(new JsonResponse(['error' => $msg], 422));
      }

      $user->save();
    }
    catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error('Error creando usuario: @msg', ['@msg' => $e->getMessage()]);
      return $this->corsResponse(new JsonResponse(
        ['error' => 'Error interno al crear el usuario.'],
        500
      ));
    }

    return $this->corsResponse(new JsonResponse([
      'uid'  => $user->id(),
      'name' => $user->getAccountName(),
      'mail' => $user->getEmail(),
    ], 201));
  }

  /**
   * Añade cabeceras CORS a una respuesta.
   */
  private function corsResponse(JsonResponse $response): JsonResponse {
    $response->headers->set('Access-Control-Allow-Origin', '*');
    $response->headers->set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return $response;
  }

}
