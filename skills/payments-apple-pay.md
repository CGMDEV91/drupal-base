# Skill: Payments — Stripe, Apple Pay, Google Pay, IAP

Stack tech. Pagos en apps móviles con React Native/Expo y backend Drupal.

---

## Opciones de Pago en este Proyecto

| Tipo | Caso de uso | Librería |
|------|-------------|---------|
| Stripe | Suscripciones de guías, donaciones | `@stripe/stripe-react-native` |
| Apple Pay | Pago rápido iOS (Stripe) | Integrado en Stripe SDK |
| Google Pay | Pago rápido Android (Stripe) | Integrado en Stripe SDK |
| In-App Purchase | Suscripciones App Store/Play | `expo-in-app-purchases` o `react-native-iap` |

**Regla para App Store**: Las suscripciones vendidas en iOS/Android deben pasar por IAP (comisión del 15-30%). Para suscripciones web o fuera de la app, se puede usar Stripe directamente.

---

## Stripe Setup

### Instalación
```bash
npx expo install @stripe/stripe-react-native
```

```bash
# Drupal: instalar módulo de pago (opcional, para webhooks)
composer require drupal/commerce_stripe
# O usar custom module con webhook handler
```

### Inicialización en App
```typescript
// app/_layout.tsx
import { StripeProvider } from '@stripe/stripe-react-native';

export default function RootLayout() {
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_KEY!}
      merchantIdentifier="merchant.com.stepuptours" // Apple Pay
      urlScheme="stepuptours"  // Para 3D Secure redirect
    >
      <Stack />
    </StripeProvider>
  );
}
```

---

## Flujo de Donación con Stripe

```
Usuario → App RN → Drupal API → Stripe API → Webhook → Drupal actualiza donation
```

### 1. Backend: Crear PaymentIntent (Drupal custom endpoint o controller)
```php
// web/modules/custom/stepup_payments/src/Controller/PaymentController.php
use Stripe\StripeClient;

public function createPaymentIntent(Request $request) {
  $stripe = new StripeClient($_ENV['STRIPE_SECRET_KEY']);
  $data = json_decode($request->getContent(), true);

  $intent = $stripe->paymentIntents->create([
    'amount' => (int)($data['amount'] * 100), // en céntimos
    'currency' => 'eur',
    'metadata' => [
      'tour_id' => $data['tour_id'],
      'donor_id' => $data['donor_id'],
      'guide_id' => $data['guide_id'],
    ],
  ]);

  return new JsonResponse(['client_secret' => $intent->client_secret]);
}
```

### 2. Frontend: Confirmar pago
```typescript
import { useStripe } from '@stripe/stripe-react-native';

function DonateButton({ tourId, amount }: { tourId: string; amount: number }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const handleDonate = async () => {
    // 1. Obtener client_secret del backend
    const { clientSecret } = await createDonationIntent(tourId, amount);

    // 2. Inicializar PaymentSheet
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      merchantDisplayName: 'StepUp Tours',
      applePay: { merchantCountryCode: 'ES' },
      googlePay: { merchantCountryCode: 'ES', testEnv: __DEV__ },
    });
    if (initError) { Alert.alert('Error', initError.message); return; }

    // 3. Mostrar sheet de pago
    const { error } = await presentPaymentSheet();
    if (!error) {
      Alert.alert('Gracias!', `Has donado €${amount} al guía`);
    }
  };

  return <TouchableOpacity onPress={handleDonate}><Text>Donar €{amount}</Text></TouchableOpacity>;
}
```

---

## Apple Pay (via Stripe)

Apple Pay se integra automáticamente cuando:
1. `merchantIdentifier` está configurado en `StripeProvider`
2. `applePay` está en `initPaymentSheet`
3. El certificado Apple Pay está registrado en Stripe Dashboard

```typescript
// Verificar si Apple Pay está disponible
import { useApplePay } from '@stripe/stripe-react-native';

const { isApplePaySupported } = useApplePay();
if (!isApplePaySupported) { /* mostrar alternativa */ }
```

### Entitlements iOS (app.json)
```json
{
  "expo": {
    "ios": {
      "entitlements": {
        "com.apple.developer.in-app-payments": ["merchant.com.stepuptours"]
      }
    }
  }
}
```

---

## Google Pay (via Stripe)

```typescript
// Verificar disponibilidad
import { usePlatformPay } from '@stripe/stripe-react-native';

const { isPlatformPaySupported } = usePlatformPay();
const isGooglePayAvailable = await isPlatformPaySupported({ googlePay: { testEnv: __DEV__ } });
```

Google Pay se activa automáticamente en Android cuando `googlePay` está en `initPaymentSheet`.

---

## Suscripciones con Stripe (Guías)

### Flujo
```
Guía → selecciona plan → App crea Stripe Customer + Subscription → Webhook → Drupal actualiza subscription node
```

### Backend: Crear suscripción
```php
public function createSubscription(Request $request) {
  $stripe = new StripeClient($_ENV['STRIPE_SECRET_KEY']);
  $data = json_decode($request->getContent(), true);

  // 1. Crear/obtener cliente Stripe
  $customer = $stripe->customers->create([
    'email' => $data['email'],
    'name' => $data['name'],
    'metadata' => ['drupal_uid' => $data['user_id']],
  ]);

  // 2. Crear SetupIntent para guardar método de pago
  $setup = $stripe->setupIntents->create([
    'customer' => $customer->id,
    'payment_method_types' => ['card'],
  ]);

  return new JsonResponse([
    'customer_id' => $customer->id,
    'setup_intent_secret' => $setup->client_secret,
  ]);
}
```

### Frontend: Guardar tarjeta + suscribir
```typescript
import { useStripe } from '@stripe/stripe-react-native';

const { confirmSetupIntent } = useStripe();

// Guardar método de pago
const { setupIntent, error } = await confirmSetupIntent(setupIntentSecret, {
  paymentMethodType: 'Card',
});

// Luego llamar al backend para crear la suscripción Stripe con ese payment method
await subscribeToPlan({ planId, customerId, paymentMethodId: setupIntent.paymentMethodId });
```

---

## Webhook de Stripe → Drupal

```php
// web/modules/custom/stepup_payments/src/Controller/StripeWebhookController.php
public function handle(Request $request) {
  $payload = $request->getContent();
  $sig_header = $request->headers->get('stripe-signature');
  $endpoint_secret = $_ENV['STRIPE_WEBHOOK_SECRET'];

  try {
    $event = \Stripe\Webhook::constructEvent($payload, $sig_header, $endpoint_secret);
  } catch (\Exception $e) {
    return new Response('', 400);
  }

  switch ($event->type) {
    case 'payment_intent.succeeded':
      $this->handleDonationSuccess($event->data->object);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      $this->handleSubscriptionUpdate($event->data->object);
      break;
    case 'customer.subscription.deleted':
      $this->handleSubscriptionCancelled($event->data->object);
      break;
  }

  return new Response('', 200);
}

private function handleDonationSuccess(\Stripe\PaymentIntent $intent) {
  $tourId = $intent->metadata->tour_id;
  $amount = $intent->amount / 100; // centavos → euros

  // Crear donation node en Drupal
  $donation = Node::create([
    'type' => 'donation',
    'title' => "Donation to tour {$tourId}",
    'field_amount' => $amount,
    'field_status' => 'completed',
    // ...
  ]);
  $donation->save();

  // Actualizar contador del tour
  $tour = \Drupal\node\Entity\Node::load($tourId);
  $tour->set('field_donation_count', $tour->get('field_donation_count')->value + 1);
  $tour->set('field_donation_total', $tour->get('field_donation_total')->value + $amount);
  $tour->save();
}
```

---

## In-App Purchases (IAP) — Para App Store/Play Store

Para cumplir con las políticas de Apple y Google, las suscripciones compradas desde la app nativa deben pasar por IAP.

### expo-in-app-purchases
```bash
npx expo install expo-in-app-purchases
```

```typescript
import * as InAppPurchases from 'expo-in-app-purchases';

// Configurar
await InAppPurchases.connectAsync();

// Obtener productos
const { responseCode, results } = await InAppPurchases.getProductsAsync([
  'com.stepuptours.premium_monthly',
  'com.stepuptours.premium_annual',
]);

// Suscribir listener de compra
InAppPurchases.setPurchaseListener(({ responseCode, results, errorCode }) => {
  if (responseCode === InAppPurchases.IAPResponseCode.OK) {
    results!.forEach(async (purchase) => {
      if (!purchase.acknowledged) {
        // Verificar receipt con backend y actualizar suscripción
        await verifyReceipt(purchase.transactionReceipt);
        await InAppPurchases.finishTransactionAsync(purchase, true);
      }
    });
  }
});

// Comprar
await InAppPurchases.purchaseItemAsync('com.stepuptours.premium_monthly');
```

---

## Variables de Entorno Requeridas

```env
# .env (no commitear)
EXPO_PUBLIC_STRIPE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...          # Solo backend
STRIPE_WEBHOOK_SECRET=whsec_...        # Solo backend
```

---

## Split de Ingresos (Donaciones)

Lógica implementada en `professional_profile.field_revenue_percentage`:
```
guide_revenue = amount * (revenue_percentage / 100)
platform_revenue = amount - guide_revenue
```

Ejemplo: donación de €5, guía con 70% → guía recibe €3.50, plataforma €1.50.

Con Stripe Connect:
```php
$stripe->transfers->create([
  'amount' => (int)($guideRevenue * 100),
  'currency' => 'eur',
  'destination' => $guide->stripe_connect_account_id,
  'transfer_group' => "donation_{$donationId}",
]);
```
