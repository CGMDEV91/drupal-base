<?php

/**
 * Script para importar ciudades más visitadas de la UE como taxonomy terms.
 *
 * Uso:
 *   drush php:script import_cities.php
 *
 * Requiere:
 *   - Vocabulario 'cities' creado con campo field_country (ref a taxonomía 'countries')
 *   - Vocabulario 'countries' creado y con los países ya importados
 */

$cities = [
  'France' => [
    'Paris', 'Nice', 'Lyon', 'Marseille', 'Bordeaux', 'Strasbourg', 'Toulouse', 'Montpellier',
  ],
  'Spain' => [
    'Madrid', 'Barcelona', 'Seville', 'Valencia', 'Granada', 'Bilbao', 'San Sebastián',
    'Málaga', 'Córdoba', 'Toledo', 'Salamanca', 'Palma de Mallorca', 'Las Palmas',
  ],
  'Italy' => [
    'Rome', 'Florence', 'Venice', 'Milan', 'Naples', 'Turin', 'Bologna',
    'Amalfi', 'Cinque Terre', 'Siena', 'Verona', 'Palermo',
  ],
  'Germany' => [
    'Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Dresden', 'Heidelberg',
    'Stuttgart', 'Nuremberg', 'Düsseldorf',
  ],
  'Netherlands' => [
    'Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Leiden', 'Delft',
  ],
  'Belgium' => [
    'Brussels', 'Bruges', 'Ghent', 'Antwerp', 'Liège',
  ],
  'Portugal' => [
    'Lisbon', 'Porto', 'Sintra', 'Faro', 'Évora', 'Braga',
  ],
  'Greece' => [
    'Athens', 'Thessaloniki', 'Santorini', 'Mykonos', 'Rhodes', 'Heraklion', 'Corfu',
  ],
  'Austria' => [
    'Vienna', 'Salzburg', 'Innsbruck', 'Graz', 'Hallstatt',
  ],
  'Czech Republic' => [
    'Prague', 'Brno', 'Český Krumlov', 'Karlovy Vary',
  ],
  'Hungary' => [
    'Budapest', 'Pécs', 'Eger', 'Debrecen',
  ],
  'Poland' => [
    'Krakow', 'Warsaw', 'Gdansk', 'Wroclaw', 'Poznan', 'Zakopane',
  ],
  'Sweden' => [
    'Stockholm', 'Gothenburg', 'Malmö', 'Uppsala',
  ],
  'Denmark' => [
    'Copenhagen', 'Aarhus', 'Odense',
  ],
  'Finland' => [
    'Helsinki', 'Turku', 'Rovaniemi',
  ],
  'Ireland' => [
    'Dublin', 'Galway', 'Cork', 'Killarney',
  ],
  'Croatia' => [
    'Dubrovnik', 'Split', 'Zagreb', 'Hvar', 'Pula',
  ],
  'Romania' => [
    'Bucharest', 'Cluj-Napoca', 'Brasov', 'Sibiu', 'Sinaia',
  ],
  'Bulgaria' => [
    'Sofia', 'Plovdiv', 'Varna', 'Veliko Tarnovo',
  ],
  'Slovakia' => [
    'Bratislava', 'Košice',
  ],
  'Slovenia' => [
    'Ljubljana', 'Bled', 'Piran',
  ],
  'Estonia' => [
    'Tallinn', 'Tartu',
  ],
  'Latvia' => [
    'Riga', 'Sigulda',
  ],
  'Lithuania' => [
    'Vilnius', 'Kaunas', 'Trakai',
  ],
  'Luxembourg' => [
    'Luxembourg City',
  ],
  'Malta' => [
    'Valletta', 'Mdina', 'Gozo',
  ],
  'Cyprus' => [
    'Nicosia', 'Limassol', 'Paphos',
  ],
];

$term_storage = \Drupal::entityTypeManager()->getStorage('taxonomy_term');

// Cache de países para no hacer query por cada ciudad
$country_cache = [];

$created = 0;
$skipped = 0;

foreach ($cities as $country_name => $city_list) {

  // Buscar el término de país
  if (!isset($country_cache[$country_name])) {
    $countries = $term_storage->loadByProperties([
      'vid' => 'countries',
      'name' => $country_name,
    ]);
    if (empty($countries)) {
      echo "⚠️  País no encontrado: {$country_name} — saltando sus ciudades.\n";
      $country_cache[$country_name] = NULL;
      continue;
    }
    $country_cache[$country_name] = reset($countries);
  }

  $country_term = $country_cache[$country_name];
  if (!$country_term) {
    continue;
  }

  foreach ($city_list as $city_name) {

    // Verificar si ya existe
    $existing = $term_storage->loadByProperties([
      'vid' => 'cities',
      'name' => $city_name,
    ]);

    if (!empty($existing)) {
      echo "⏭️  Ya existe: {$city_name}\n";
      $skipped++;
      continue;
    }

    $term = $term_storage->create([
      'vid' => 'cities',
      'name' => $city_name,
      'field_country' => [['target_id' => $country_term->id()]],
    ]);

    $term->save();
    echo "✅ Creada: {$city_name} ({$country_name})\n";
    $created++;
  }
}

echo "\n📊 Resumen: {$created} ciudades creadas, {$skipped} ya existían.\n";
