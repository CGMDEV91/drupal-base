<?php
/**
 * cancel-all-stripe-subs.php
 * Cancela INMEDIATAMENTE todas las Stripe Subscriptions activas
 * y marca los nodos Drupal como cancelled+expired.
 * Uso: ddev drush php:script scripts/cancel-all-stripe-subs.php
 */

$config = \Drupal::config('stepuptours.payment');
$secretKey = $config->get('stripe_secret_key') ?? '';

if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
  echo "\n✗ Stripe not configured.\n\n";
  exit(1);
}

\Stripe\Stripe::setApiKey($secretKey);

echo "\n";
echo str_repeat('═', 60) . "\n";
echo "  Cleanup — Cancel all Stripe Subscriptions\n";
echo str_repeat('═', 60) . "\n\n";

// ── 1. Cancel in Stripe ───────────────────────────────────────────────────────
$cancelled = 0;
$errors    = 0;

try {
  $stripeSubs = \Stripe\Subscription::all(['limit' => 20, 'status' => 'all']);

  foreach ($stripeSubs->data as $sub) {
    if (in_array($sub->status, ['canceled', 'incomplete_expired'])) {
      echo "  SKIP  {$sub->id} (already {$sub->status})\n";
      continue;
    }

    try {
      $retrieved = \Stripe\Subscription::retrieve($sub->id);
      $retrieved->cancel();
      echo "  ✓ Cancelled Stripe sub: {$sub->id} (was: {$sub->status})\n";
      $cancelled++;
    } catch (\Exception $e) {
      echo "  ✗ Error cancelling {$sub->id}: " . $e->getMessage() . "\n";
      $errors++;
    }
  }
} catch (\Exception $e) {
  echo "✗ Stripe API error: " . $e->getMessage() . "\n";
  exit(1);
}

echo "\n  Stripe: cancelled=$cancelled, errors=$errors\n";

// ── 2. Mark Drupal nodes as expired ──────────────────────────────────────────
echo "\n▶ Updating Drupal subscription nodes...\n";

$nids = \Drupal::entityQuery('node')
  ->condition('type', 'subscription')
  ->condition('field_subscription_status', ['active', 'cancelled'], 'IN')
  ->accessCheck(FALSE)
  ->execute();

$updated = 0;
$storage = \Drupal::entityTypeManager()->getStorage('node');

foreach ($storage->loadMultiple($nids) as $node) {
  $node->set('field_subscription_status', 'expired');
  $node->set('field_auto_renewal', FALSE);
  $node->save();
  echo "  ✓ Node {$node->id()} → expired\n";
  $updated++;
}

echo "\n  Drupal: updated=$updated nodes\n";

echo "\n" . str_repeat('═', 60) . "\n";
echo "  Done. Run check-subscriptions.php to verify.\n";
echo str_repeat('═', 60) . "\n\n";
