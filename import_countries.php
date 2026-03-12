<?php

/**
 * Script para importar países de la UE como taxonomy terms.
 *
 * Uso:
 *   drush php:script import_countries.php
 *
 * Requiere:
 *   - Vocabulario 'countries' creado previamente desde la UI
 */

$countries = [
  'Austria',
  'Belgium',
  'Bulgaria',
  'Croatia',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hungary',
  'Ireland',
  'Italy',
  'Latvia',
  'Lithuania',
  'Luxembourg',
  'Malta',
  'Netherlands',
  'Poland',
  'Portugal',
  'Romania',
  'Slovakia',
  'Slovenia',
  'Spain',
  'Sweden',
];

$term_storage = \Drupal::entityTypeManager()->getStorage('taxonomy_term');

$created = 0;
$skipped = 0;

foreach ($countries as $country_name) {
  $existing = $term_storage->loadByProperties([
    'vid' => 'countries',
    'name' => $country_name,
  ]);

  if (!empty($existing)) {
    echo "⏭️  Ya existe: {$country_name}\n";
    $skipped++;
    continue;
  }

  $term = $term_storage->create([
    'vid' => 'countries',
    'name' => $country_name,
  ]);

  $term->save();
  echo "✅ Creado: {$country_name}\n";
  $created++;
}

echo "\n📊 Resumen: {$created} países creados, {$skipped} ya existían.\n";
