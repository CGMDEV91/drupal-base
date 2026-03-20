<?php

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;

class MeController extends ControllerBase {

  public function get(): JsonResponse {
    $account = $this->currentUser();

    return new JsonResponse([
      'id'     => $account->id(),
      'name'   => $account->getAccountName(),
      'mail'   => $account->getEmail(),
      'roles'  => array_values($account->getRoles()), // machine names directos
    ]);
  }

}