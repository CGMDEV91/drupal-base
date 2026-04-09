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
   * Se ejecuta cuando Drupal LEE config de bbdd para usarla en runtime.
   * Inyecta los valores de env vars en memoria.
   */
  public function filterRead($name, $data) {
    return $this->injectEnvVars($name, $data);
  }

  /**
   * {@inheritdoc}
   * Se ejecuta cuando el cim va a ESCRIBIR en bbdd.
   * Inyecta los valores de env vars para que queden persistidos.
   */
  public function filterWrite($name, array $data) {
    return $this->injectEnvVars($name, $data);
  }

  /**
   * {@inheritdoc}
   * Se ejecuta cuando Drupal LEE del sync storage (YML) durante el cim.
   * Inyecta env vars en lo que viene del YML antes de comparar/escribir.
   */
  public function filterReadPersist($name, $data) {
    return $this->injectEnvVars($name, $data);
  }

  /**
   * Inyecta valores de env vars en la config.
   */
  protected function injectEnvVars($name, $data) {
    if ($name === 'stepuptours_api.payment' && is_array($data)) {
      $data['stripe_secret_key']      = getenv('STEPUP_TOURS_STRIPE_SECRET_KEY') ?: '';
      $data['stripe_publishable_key'] = getenv('STEPUP_TOURS_STRIPE_PUBLISHABLE_KEY') ?: '';
      $data['stripe_webhook_secret']  = getenv('STEPUP_TOURS_STRIPE_WEBHOOK_KEY') ?: '';
    }
    return $data;
  }

}
