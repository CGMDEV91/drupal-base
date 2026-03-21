<?php

declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Admin endpoints for viewing all donations.
 */
class AdminDonationsController extends ControllerBase {

  /**
   * GET /api/admin/donations — admin only.
   * Returns all donations with tour owner info.
   */
  public function list(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    if (!$this->isAdministrator()) {
      return $this->corsResponse(new JsonResponse(['error' => 'Forbidden'], 403));
    }

    $query = \Drupal::entityTypeManager()->getStorage('node')->getQuery()
      ->condition('type', 'donation')
      ->condition('status', 1)
      ->sort('created', 'DESC')
      ->range(0, 500)
      ->accessCheck(FALSE);

    $nids = $query->execute();
    $nodes = \Drupal::entityTypeManager()->getStorage('node')->loadMultiple($nids);

    $donations = [];
    foreach ($nodes as $node) {
      $tourRef = $node->get('field_tour')->entity;
      $donorRef = $node->get('field_user')->entity;

      $tourTitle = '';
      $tourOwnerId = '';
      $tourOwnerName = '';
      $tourOwnerIsAdmin = FALSE;

      if ($tourRef) {
        $tourTitle = $tourRef->label();
        $tourOwner = $tourRef->getOwner();
        if ($tourOwner) {
          $tourOwnerId = (string) $tourOwner->id();
          $tourOwnerName = '';
          if ($tourOwner->hasField('field_public_name') && !$tourOwner->get('field_public_name')->isEmpty()) {
            $tourOwnerName = $tourOwner->get('field_public_name')->value;
          }
          if (empty($tourOwnerName)) {
            $tourOwnerName = $tourOwner->getAccountName();
          }
          $tourOwnerIsAdmin = in_array('administrator', $tourOwner->getRoles(), TRUE);
        }
      }

      $donorName = '';
      if ($donorRef) {
        if ($donorRef->hasField('field_public_name') && !$donorRef->get('field_public_name')->isEmpty()) {
          $donorName = $donorRef->get('field_public_name')->value;
        }
        if (empty($donorName)) {
          $donorName = $donorRef->getAccountName();
        }
      }

      $donations[] = [
        'id' => $node->uuid(),
        'tourTitle' => $tourTitle,
        'tourId' => $tourRef ? $tourRef->uuid() : '',
        'tourOwnerName' => $tourOwnerName,
        'tourOwnerId' => $tourOwnerId,
        'tourOwnerIsAdmin' => $tourOwnerIsAdmin,
        'donorName' => $donorName,
        'amount' => (float) ($node->get('field_amount')->value ?? 0),
        'currency' => $node->hasField('field_currency_code') ? ($node->get('field_currency_code')->value ?? 'EUR') : 'EUR',
        'guideRevenue' => (float) ($node->hasField('field_guide_revenue') ? ($node->get('field_guide_revenue')->value ?? 0) : 0),
        'platformRevenue' => (float) ($node->hasField('field_platform_revenue') ? ($node->get('field_platform_revenue')->value ?? 0) : 0),
        'paymentReference' => $node->hasField('field_payment_reference') ? ($node->get('field_payment_reference')->value ?? '') : '',
        'createdAt' => date('c', (int) $node->getCreatedTime()),
      ];
    }

    return $this->corsResponse(new JsonResponse($donations, 200));
  }

  /**
   * GET /api/admin/donations/summary — admin only.
   * Returns aggregated donation statistics.
   */
  public function summary(Request $request): JsonResponse {
    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    if (!$this->isAdministrator()) {
      return $this->corsResponse(new JsonResponse(['error' => 'Forbidden'], 403));
    }

    $database = \Drupal::database();

    $query = $database->select('node_field_data', 'n');
    $query->condition('n.type', 'donation');
    $query->condition('n.status', 1);

    $query->leftJoin('node__field_amount', 'fa', 'n.nid = fa.entity_id');
    $query->leftJoin('node__field_guide_revenue', 'fgr', 'n.nid = fgr.entity_id');
    $query->leftJoin('node__field_platform_revenue', 'fpr', 'n.nid = fpr.entity_id');

    $query->addExpression('COUNT(n.nid)', 'donations_count');
    $query->addExpression('COALESCE(SUM(fa.field_amount_value), 0)', 'total_amount');
    $query->addExpression('COALESCE(SUM(fgr.field_guide_revenue_value), 0)', 'total_guide_revenue');
    $query->addExpression('COALESCE(SUM(fpr.field_platform_revenue_value), 0)', 'total_platform_revenue');

    $result = $query->execute()->fetchObject();

    return $this->corsResponse(new JsonResponse([
      'donationsCount' => (int) ($result->donations_count ?? 0),
      'totalAmount' => round((float) ($result->total_amount ?? 0), 2),
      'totalGuideRevenue' => round((float) ($result->total_guide_revenue ?? 0), 2),
      'totalPlatformRevenue' => round((float) ($result->total_platform_revenue ?? 0), 2),
    ], 200));
  }

  private function isAdministrator(): bool {
    return in_array('administrator', \Drupal::currentUser()->getRoles(), TRUE);
  }

  private function corsResponse(JsonResponse $response): JsonResponse {
    $response->headers->set('Access-Control-Allow-Origin', '*');
    $response->headers->set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return $response;
  }

}
