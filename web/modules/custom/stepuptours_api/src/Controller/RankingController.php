<?php

declare(strict_types=1);

namespace Drupal\stepuptours_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Endpoint público de ranking de viajeros.
 *
 * GET /api/ranking
 * Returns top 100 users sorted by total XP descending.
 */
class RankingController extends ControllerBase {

  public function ranking(Request $request): JsonResponse {

    if ($request->getMethod() === 'OPTIONS') {
      return $this->corsResponse(new JsonResponse(NULL, 204));
    }

    try {
      // Query all published tour_user_activity nodes that are completed.
      $database = \Drupal::database();

      // Aggregate XP and completed tours per user from tour_user_activity nodes.
      $query = $database->select('node_field_data', 'n');
      $query->join('node__field_user', 'fu', 'n.nid = fu.entity_id');
      $query->join('node__field_xp_awarded', 'xp', 'n.nid = xp.entity_id');
      $query->condition('n.type', 'tour_user_activity');
      $query->condition('n.status', 1);

      // Only completed activities (field_is_completed = 1)
      $query->join('node__field_is_completed', 'ic', 'n.nid = ic.entity_id');
      $query->condition('ic.field_is_completed_value', 1);

      $query->fields('fu', ['field_user_target_id']);
      $query->addExpression('COUNT(n.nid)', 'tours_completed');
      $query->addExpression('SUM(xp.field_xp_awarded_value)', 'total_xp');
      $query->groupBy('fu.field_user_target_id');
      $query->orderBy('total_xp', 'DESC');
      $query->range(0, 100);

      $results = $query->execute()->fetchAll();

      $ranking = [];
      $position = 1;

      foreach ($results as $row) {
        $uid = (int) $row->field_user_target_id;
        $user = \Drupal\user\Entity\User::load($uid);
        if (!$user) {
          continue;
        }

        $publicName = '';
        if ($user->hasField('field_public_name') && !$user->get('field_public_name')->isEmpty()) {
          $publicName = $user->get('field_public_name')->value;
        }
        if (empty($publicName)) {
          $publicName = $user->getAccountName();
        }

        $avatar = NULL;
        if ($user->hasField('user_picture') && !$user->get('user_picture')->isEmpty()) {
          $file = $user->get('user_picture')->entity;
          if ($file) {
            $avatar = \Drupal::service('file_url_generator')->generateAbsoluteString($file->getFileUri());
          }
        }

        $countryCode = NULL;
        if ($user->hasField('field_country') && !$user->get('field_country')->isEmpty()) {
          $countryTerm = $user->get('field_country')->entity;
          if ($countryTerm && $countryTerm->hasField('field_country_code') && !$countryTerm->get('field_country_code')->isEmpty()) {
            $countryCode = $countryTerm->get('field_country_code')->value;
          }
        }

        $ranking[] = [
          'position'       => $position,
          'userId'         => (string) $uid,
          'username'       => $user->getAccountName(),
          'publicName'     => $publicName,
          'avatar'         => $avatar,
          'countryCode'    => $countryCode,
          'toursCompleted' => (int) $row->tours_completed,
          'totalXp'        => (int) ($row->total_xp ?? 0),
        ];

        $position++;
      }

      return $this->corsResponse(new JsonResponse($ranking, 200));

    }
    catch (\Exception $e) {
      \Drupal::logger('stepuptours_api')->error('Ranking error: @msg', ['@msg' => $e->getMessage()]);
      return $this->corsResponse(new JsonResponse([], 200));
    }
  }

  private function corsResponse(JsonResponse $response): JsonResponse {
    $response->headers->set('Access-Control-Allow-Origin', '*');
    $response->headers->set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return $response;
  }

}
