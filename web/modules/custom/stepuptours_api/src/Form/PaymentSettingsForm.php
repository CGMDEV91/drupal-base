<?php

declare(strict_types=1);

namespace Drupal\stepuptours_api\Form;

use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;

/**
 * Stripe & payment settings form.
 */
class PaymentSettingsForm extends ConfigFormBase {

  /**
   * {@inheritdoc}
   */
  protected function getEditableConfigNames(): array {
    return ['stepuptours_api.payment'];
  }

  /**
   * {@inheritdoc}
   */
  public function getFormId(): string {
    return 'stepuptours_api_payment_settings';
  }

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state): array {
    $config = $this->config('stepuptours_api.payment');

    $form['stripe'] = [
      '#type'  => 'details',
      '#title' => $this->t('Stripe Keys'),
      '#open'  => TRUE,
    ];

    $sk = $config->get('stripe_secret_key') ?? '';
    $pk = $config->get('stripe_publishable_key') ?? '';
    $wh = $config->get('stripe_webhook_secret') ?? '';

    $form['stripe']['stripe_publishable_key'] = [
      '#type'          => 'textfield',
      '#title'         => $this->t('Publishable Key'),
      '#default_value' => $pk,
      '#description'   => $this->t('Starts with <code>pk_test_</code> or <code>pk_live_</code>.'),
      '#attributes'    => ['autocomplete' => 'off'],
    ];

    $form['stripe']['stripe_secret_key'] = [
      '#type'          => 'textfield',
      '#title'         => $this->t('Secret Key'),
      '#default_value' => $sk,
      '#description'   => $this->t('Starts with <code>sk_test_</code> or <code>sk_live_</code>. Leave blank to keep current value.'),
      '#attributes'    => ['autocomplete' => 'new-password'],
    ];

    $form['stripe']['stripe_webhook_secret'] = [
      '#type'          => 'textfield',
      '#title'         => $this->t('Webhook Secret'),
      '#default_value' => $wh,
      '#description'   => $this->t('Starts with <code>whsec_</code>. Leave blank to keep current value.'),
      '#attributes'    => ['autocomplete' => 'new-password'],
    ];

    $form['payment'] = [
      '#type'  => 'details',
      '#title' => $this->t('Payment Settings'),
      '#open'  => TRUE,
    ];

    $form['payment']['platform_revenue_percentage'] = [
      '#type'          => 'number',
      '#title'         => $this->t('Platform Revenue Percentage'),
      '#default_value' => $config->get('platform_revenue_percentage') ?? 20,
      '#min'           => 0,
      '#max'           => 100,
      '#step'          => 1,
      '#field_suffix'  => '%',
      '#description'   => $this->t('Percentage of each payment kept by the platform. The rest goes to the guide.'),
    ];

    return parent::buildForm($form, $form_state);
  }

  /**
   * {@inheritdoc}
   */
  public function validateForm(array &$form, FormStateInterface $form_state): void {
    $pk = $form_state->getValue('stripe_publishable_key');
    $sk = $form_state->getValue('stripe_secret_key');
    $wh = $form_state->getValue('stripe_webhook_secret');

    if (!empty($pk) && !str_starts_with($pk, 'pk_')) {
      $form_state->setErrorByName('stripe_publishable_key', $this->t('Publishable key must start with pk_'));
    }
    if (!empty($sk) && !str_starts_with($sk, 'sk_')) {
      $form_state->setErrorByName('stripe_secret_key', $this->t('Secret key must start with sk_'));
    }
    if (!empty($wh) && !str_starts_with($wh, 'whsec_')) {
      $form_state->setErrorByName('stripe_webhook_secret', $this->t('Webhook secret must start with whsec_'));
    }
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state): void {
    $config = $this->configFactory()->getEditable('stepuptours_api.payment');

    $pk = trim($form_state->getValue('stripe_publishable_key'));
    $sk = trim($form_state->getValue('stripe_secret_key'));
    $wh = trim($form_state->getValue('stripe_webhook_secret'));

    if (!empty($pk)) {
      $config->set('stripe_publishable_key', $pk);
    }
    // Only overwrite secrets if a new value was submitted.
    if (!empty($sk)) {
      $config->set('stripe_secret_key', $sk);
    }
    if (!empty($wh)) {
      $config->set('stripe_webhook_secret', $wh);
    }

    $config->set('platform_revenue_percentage', (int) $form_state->getValue('platform_revenue_percentage'));
    $config->save();

    parent::submitForm($form, $form_state);
  }

}
