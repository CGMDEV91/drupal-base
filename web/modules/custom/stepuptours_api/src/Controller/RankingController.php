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
      $database = \Drupal::database();

      // Step 1: top 100 users ranked by field_experience_points (canonical total XP,
      // same value shown on the user profile page).
      $xp_query = $database->select('users_field_data', 'u');
      $xp_query->join('user__field_experience_points', 'xp', 'u.uid = xp.entity_id');
      $xp_query->condition('u.status', 1);
      $xp_query->condition('xp.field_experience_points_value', 0, '>');
      $xp_query->fields('u', ['uid']);
      $xp_query->addField('xp', 'field_experience_points_value', 'total_xp');
      $xp_query->orderBy('xp.field_experience_points_value', 'DESC');
      $xp_query->range(0, 100);
      $xp_results = $xp_query->execute()->fetchAllAssoc('uid');

      if (empty($xp_results)) {
        return $this->corsResponse(new JsonResponse([], 200));
      }

      // Step 2: count completed tour activities for those users (single query).
      $uids = array_map('intval', array_keys($xp_results));
      $act_query = $database->select('node_field_data', 'n');
      $act_query->join('node__field_user', 'fu', 'n.nid = fu.entity_id');
      $act_query->join('node__field_is_completed', 'ic', 'n.nid = ic.entity_id');
      $act_query->condition('n.type', 'tour_user_activity');
      $act_query->condition('n.status', 1);
      $act_query->condition('ic.field_is_completed_value', 1);
      $act_query->condition('fu.field_user_target_id', $uids, 'IN');
      $act_query->fields('fu', ['field_user_target_id']);
      $act_query->addExpression('COUNT(n.nid)', 'tours_completed');
      $act_query->groupBy('fu.field_user_target_id');
      $activity_counts = $act_query->execute()->fetchAllAssoc('field_user_target_id');

      $results = array_values($xp_results);

      $ranking = [];
      $position = 1;

      foreach ($results as $row) {
        $uid = (int) $row->uid;
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
          'toursCompleted' => (int) ($activity_counts[$uid]->tours_completed ?? 0),
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
