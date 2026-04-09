<?php

namespace Drupal\stepuptours_config_filter\Plugin\ConfigFilter;

use Drupal\config_filter\Plugin\ConfigFilterBase;

/**
 * @ConfigFilter(
 *   id = "stepuptours_config_filter",
 *   label = "StepUp Tours Config Filter",
 *   weight = 10
 * )
 */
class StepUpToursConfigFilter extends ConfigFilterBase {

  /**
   * {@inheritdoc}
   */
  public function filterRead($name, $data) {
    $map = $this->getMap();
    if (isset($map[$name])) {
      $this->iterateMap($name, $data, $map[$name]);
    }
    return $data;
  }

  /**
   * {@inheritdoc}
   */
  public function filterWrite($name, array $data): array {
    $map = $this->getMap();
    if (isset($map[$name])) {
      $this->iterateMap($name, $data, $map[$name], 'export');
    }
    return $data;
  }

  /**
   * Returns map of config fields with env variables.
   */
  protected function getMap(): array {
    return [
      'stepuptours_api.payment' => [
        'stripe_secret_key'            => 'STEPUP_TOURS_STRIPE_SECRET_KEY',
        'stripe_publishable_key'       => 'STEPUP_TOURS_STRIPE_PUBLISHABLE_KEY',
        'stripe_webhook_secret'        => 'STEPUP_TOURS_STRIPE_WEBHOOK_KEY',
      ],
    ];
  }

  /**
   * Iterates and set the correct values on config import and export.
   */
  protected function iterateMap($name, &$data, $mapPerName, $type = 'import'): void {
    foreach ($mapPerName as $key => $value) {
      if (is_array($value)) {
        $this->iterateMap($name, $data[$key], $value, $type);
      }
      elseif (!(is_array($value))) {
        $data[$key] = '';
        if ($type === 'import') {
          $data[$key] = getenv($value);
        }
      }
    }
  }

}
