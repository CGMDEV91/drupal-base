<?php
/**
 * check-subscriptions.php
 * Lista todas las suscripciones en Drupal con su estado en Stripe.
 * Uso: ddev drush php:script scripts/check-subscriptions.php
 */

$config = \Drupal::config('stepuptours.payment');
$secretKey = $config->get('stripe_secret_key') ?? '';

if (!empty($secretKey) && $secretKey !== 'sk_test_PLACEHOLDER') {
  \Stripe\Stripe::setApiKey($secretKey);
}

$nids = \Drupal::entityQuery('node')
  ->condition('type', 'subscription')
  ->sort('nid', 'DESC')
  ->accessCheck(FALSE)
  ->execute();

$nodes = \Drupal::entityTypeManager()->getStorage('node')->loadMultiple($nids);

echo "\n";
echo str_repeat('═', 90) . "\n";
echo "  Drupal Subscriptions\n";
echo str_repeat('═', 90) . "\n";
printf("%-6s %-10s %-12s %-8s %-22s %-22s\n", 'NID', 'USER', 'STATUS', 'RENEWAL', 'END DATE', 'STRIPE SUB ID');
echo str_repeat('─', 90) . "\n";

foreach ($nodes as $node) {
  $nid      = $node->id();
  $uid      = $node->get('field_user')->target_id ?? '?';
  $status   = $node->get('field_subscription_status')->value ?? '?';
  $renewal  = $node->get('field_auto_renewal')->value ? 'YES' : 'NO';
  $endTs    = (int) ($node->get('field_end_date')->value ?? 0);
  $endDate  = $endTs > 0 ? date('Y-m-d H:i:s', $endTs) : 'N/A';
  $stripeId = $node->get('field_stripe_subscription_id')->value ?? '';

  printf("%-6s %-10s %-12s %-8s %-22s %-22s\n",
    $nid, "uid=$uid", $status, $renewal, $endDate, $stripeId ?: '—'
  );
}

echo str_repeat('─', 90) . "\n";

// ── Stripe active subscriptions ───────────────────────────────────────────────
if (empty($secretKey) || $secretKey === 'sk_test_PLACEHOLDER') {
  echo "\n  (Stripe not configured — skipping Stripe check)\n\n";
  exit(0);
}

echo "\n";
echo str_repeat('═', 90) . "\n";
echo "  Active Stripe Subscriptions\n";
echo str_repeat('═', 90) . "\n";
printf("%-30s %-12s %-10s %-22s %-10s\n", 'STRIPE SUB ID', 'STATUS', 'CANCEL EPE', 'CURRENT PERIOD END', 'CUSTOMER');
echo str_repeat('─', 90) . "\n";

try {
  $stripeSubs = \Stripe\Subscription::all(['limit' => 20, 'status' => 'all']);
  $found = 0;

  foreach ($stripeSubs->data as $sub) {
    $found++;
    $subArr    = $sub->toArray();
    $periodEnd = isset($subArr['current_period_end'])
      ? date('Y-m-d H:i:s', (int) $subArr['current_period_end'])
      : 'N/A';
    $cancelEpe = !empty($subArr['cancel_at_period_end']) ? 'YES' : 'NO';
    printf("%-30s %-12s %-10s %-22s %-10s\n",
      $subArr['id'] ?? $sub->id,
      $subArr['status'] ?? '?',
      $cancelEpe,
      $periodEnd,
      $subArr['customer'] ?? '?'
    );
  }

  if ($found === 0) {
    echo "  (no subscriptions found in Stripe)\n";
  }
} catch (\Exception $e) {
  echo "  Stripe error: " . $e->getMessage() . "\n";
}

echo str_repeat('─', 90) . "\n";
echo "\n";

// ── Cancel helper ─────────────────────────────────────────────────────────────
echo "To cancel a specific Stripe subscription immediately:\n";
echo "  stripe subscriptions cancel <STRIPE_SUB_ID>\n\n";
echo "To cancel ALL active Stripe subscriptions (cleanup):\n";
echo "  ddev drush php:script scripts/cancel-all-stripe-subs.php\n\n";
