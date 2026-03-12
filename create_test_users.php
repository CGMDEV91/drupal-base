<?php

/**
 * Script para crear usuarios de prueba.
 *
 * Crea:
 * - 1 usuario autenticado normal
 * - 1 usuario profesional con professional_profile y subscription
 *
 * Uso:
 *   drush php:script create_test_users.php
 */

use Drupal\user\Entity\User;
use Drupal\node\Entity\Node;

$user_storage = \Drupal::entityTypeManager()->getStorage('user');
$node_storage = \Drupal::entityTypeManager()->getStorage('node');

// ---------------------------------------------------------------------------
// USUARIO 1 — Authenticated (usuario normal)
// ---------------------------------------------------------------------------

$existing = $user_storage->loadByProperties(['name' => 'john_traveler']);
if (!empty($existing)) {
  echo "⏭️  Usuario 'john_traveler' ya existe, saltando.\n";
  $authenticated_user = reset($existing);
} else {
  $authenticated_user = User::create([
    'name'   => 'john_traveler',
    'mail'   => 'john.traveler@example.com',
    'pass'   => 'Password123!',
    'status' => 1,
    'roles'  => ['authenticated'],
    'field_public_name' => 'John Traveler',
  ]);

  // País — busca el term Spain en la taxonomía countries
  $country_terms = \Drupal::entityTypeManager()
    ->getStorage('taxonomy_term')
    ->loadByProperties(['vid' => 'countries', 'name' => 'United Kingdom']);

  if (!empty($country_terms)) {
    $country = reset($country_terms);
    $authenticated_user->set('field_country', [['target_id' => $country->id()]]);
  }

  $authenticated_user->save();
  echo "✅ Usuario autenticado creado:\n";
  echo "   Username : john_traveler\n";
  echo "   Email    : john.traveler@example.com\n";
  echo "   Password : Password123!\n";
  echo "   UID      : " . $authenticated_user->id() . "\n";
  echo "   UUID     : " . $authenticated_user->uuid() . "\n\n";
}

// ---------------------------------------------------------------------------
// USUARIO 2 — Professional (guía)
// ---------------------------------------------------------------------------

$existing_pro = $user_storage->loadByProperties(['name' => 'maria_guide']);
if (!empty($existing_pro)) {
  echo "⏭️  Usuario 'maria_guide' ya existe, saltando.\n";
  $professional_user = reset($existing_pro);
} else {
  $professional_user = User::create([
    'name'   => 'maria_guide',
    'mail'   => 'maria.guide@example.com',
    'pass'   => 'Password123!',
    'status' => 1,
    'roles'  => ['professional'],
    'field_public_name' => 'María García',
  ]);

  $country_terms_es = \Drupal::entityTypeManager()
    ->getStorage('taxonomy_term')
    ->loadByProperties(['vid' => 'countries', 'name' => 'Spain']);

  if (!empty($country_terms_es)) {
    $country_es = reset($country_terms_es);
    $professional_user->set('field_country', [['target_id' => $country_es->id()]]);
  }

  $professional_user->save();
  echo "✅ Usuario profesional creado:\n";
  echo "   Username : maria_guide\n";
  echo "   Email    : maria.guide@example.com\n";
  echo "   Password : Password123!\n";
  echo "   UID      : " . $professional_user->id() . "\n";
  echo "   UUID     : " . $professional_user->uuid() . "\n\n";
}

// ---------------------------------------------------------------------------
// PROFESSIONAL PROFILE para maria_guide
// ---------------------------------------------------------------------------

$existing_profile = $node_storage->loadByProperties([
  'type'       => 'professional_profile',
  'field_user' => $professional_user->id(),
]);

if (!empty($existing_profile)) {
  echo "⏭️  Professional profile para 'maria_guide' ya existe, saltando.\n";
} else {
  $profile = Node::create([
    'type'                   => 'professional_profile',
    'title'                  => 'Profile — ' . $professional_user->getDisplayName(),
    'status'                 => 1,
    'uid'                    => $professional_user->id(),
    'field_user'             => [['target_id' => $professional_user->id()]],
    'field_full_name'        => 'María García López',
    'field_tax_id'           => 'B12345678',
    'field_bank_iban'        => 'ES91 2100 0418 4502 0005 1332',
    'field_bank_bic'         => 'CAIXESBBXXX',
    'field_account_holder'   => 'María García López',
    'field_revenue_percentage' => '75.00',
  ]);

  // Dirección usando el módulo address
  $profile->set('field_address', [
    'country_code'     => 'ES',
    'address_line1'    => 'Calle Gran Vía 45',
    'locality'         => 'Madrid',
    'postal_code'      => '28013',
    'administrative_area' => 'MD',
  ]);

  $profile->save();
  echo "✅ Professional profile creado:\n";
  echo "   Nombre legal : María García López\n";
  echo "   Tax ID       : B12345678\n";
  echo "   Revenue %    : 75%\n";
  echo "   Node ID      : " . $profile->id() . "\n\n";
}

// ---------------------------------------------------------------------------
// SUBSCRIPTION PLAN — obtener el plan Free
// ---------------------------------------------------------------------------

$free_plans = $node_storage->loadByProperties([
  'type'            => 'subscription_plan',
  'field_plan_type' => 'free',
]);

if (empty($free_plans)) {
  // Crear el plan Free si no existe
  $free_plan = Node::create([
    'type'                      => 'subscription_plan',
    'title'                     => 'Free',
    'status'                    => 1,
    'uid'                       => 1,
    'field_plan_type'           => 'free',
    'field_billing_cycle'       => 'none',
    'field_price'               => '0.00',
    'field_max_featured_detail' => 1,
    'field_max_featured_steps'  => 3,
    'field_max_languages'       => 5,
    'field_featured_per_step'   => 0,
    'field_auto_renewal'        => 0,
    'field_active'              => 1,
  ]);
  $free_plan->save();
  echo "✅ Plan Free creado (no existía).\n";
} else {
  $free_plan = reset($free_plans);
  echo "⏭️  Plan Free ya existe.\n";
}

// ---------------------------------------------------------------------------
// SUBSCRIPTION para maria_guide (plan Free)
// ---------------------------------------------------------------------------

$existing_sub = $node_storage->loadByProperties([
  'type'       => 'subscription',
  'field_user' => $professional_user->id(),
]);

if (!empty($existing_sub)) {
  echo "⏭️  Subscription para 'maria_guide' ya existe, saltando.\n";
} else {
  $subscription = Node::create([
    'type'               => 'subscription',
    'title'              => $professional_user->getDisplayName() . ' — Free',
    'status'             => 1,
    'uid'                => $professional_user->id(),
    'field_user'         => [['target_id' => $professional_user->id()]],
    'field_plan'         => [['target_id' => $free_plan->id()]],
    'field_status'       => 'active',
    'field_start_date'   => date('Y-m-d\TH:i:s', strtotime('today')),
    'field_end_date'     => NULL,
    'field_auto_renewal' => 0,
  ]);
  $subscription->save();
  echo "✅ Subscription Free creada para maria_guide.\n";
  echo "   Node ID : " . $subscription->id() . "\n\n";
}

// ---------------------------------------------------------------------------
// RESUMEN FINAL
// ---------------------------------------------------------------------------

echo "\n========================================\n";
echo "RESUMEN DE USUARIOS CREADOS\n";
echo "========================================\n";
echo "Authenticated user:\n";
echo "  UID  : " . $authenticated_user->id() . "\n";
echo "  UUID : " . $authenticated_user->uuid() . "\n\n";
echo "Professional user:\n";
echo "  UID  : " . $professional_user->id() . "\n";
echo "  UUID : " . $professional_user->uuid() . "\n";
echo "========================================\n";
echo "Copia estos UUIDs en las variables de Bruno.\n\n";
