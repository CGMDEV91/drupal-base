<?php

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

class GoogleAuthController extends ControllerBase {

  public function authenticate(Request $request): JsonResponse {
    $data = json_decode($request->getContent(), TRUE);
    $accessToken = $data['access_token'] ?? NULL;
    $role = $data['role'] ?? NULL;

    if (!$accessToken) {
      return new JsonResponse(['error' => 'Missing access_token'], 400);
    }

    $googleUser = $this->verifyGoogleToken($accessToken);
    if (!$googleUser) {
      return new JsonResponse(['error' => 'Invalid Google token'], 401);
    }

    $result = $this->findOrCreateUser($googleUser, $role);
    if (!$result) {
      return new JsonResponse(['error' => 'Failed to create user'], 500);
    }

    return new JsonResponse($result);
  }

  private function verifyGoogleToken(string $accessToken): ?array {
    $url = 'https://www.googleapis.com/oauth2/v3/userinfo';
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $accessToken"]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) return NULL;
    $user = json_decode($response, TRUE);
    if (empty($user['email'])) return NULL;
    return $user;
  }

  private function findOrCreateUser(array $googleUser, ?string $role): ?array {
    $email = $googleUser['email'];
    $sub = $googleUser['sub'];
    $name = $googleUser['name'] ?? $email;

    $users = \Drupal::entityTypeManager()
      ->getStorage('user')
      ->loadByProperties(['mail' => $email]);

    if ($users) {
      $account = reset($users);
    } else {
      $username = $this->uniqueUsername($name);
      $account = \Drupal\user\Entity\User::create([
        'name' => $username,
        'mail' => $email,
        'status' => 1,
        'field_public_name' => $name,
      ]);
    }

    $hashSalt = \Drupal::state()->get('system.private_key') ?? 'stepuptours_salt';
    $derivedPassword = substr(hash('sha256', $sub . ':' . $email . ':' . $hashSalt), 0, 40);
    $account->setPassword($derivedPassword);

    if ($role === 'professional' && !$account->hasRole('professional')) {
      $account->addRole('professional');
    }

    $account->save();

    $username = $account->getAccountName();
    $token = base64_encode($username . ':' . $derivedPassword);

    return ['token' => $token, 'username' => $username];
  }

  private function uniqueUsername(string $name): string {
    $base = preg_replace('/[^a-zA-Z0-9_]/', '_', $name);
    $base = substr($base, 0, 50);
    $username = $base;
    $i = 1;
    while (\Drupal::entityTypeManager()->getStorage('user')->loadByProperties(['name' => $username])) {
      $username = $base . '_' . $i++;
    }
    return $username;
  }

  public function options(Request $request): JsonResponse {
    return new JsonResponse(NULL, 204, [
      'Access-Control-Allow-Origin' => $request->headers->get('Origin') ?? '*',
      'Access-Control-Allow-Methods' => 'POST, OPTIONS',
      'Access-Control-Allow-Headers' => 'Content-Type, Authorization',
    ]);
  }

}
