#!/usr/bin/env bash
# test-subscription-renewal.sh
# Simula una renovación automática de suscripción usando una Stripe Subscription real.
#
# Prerequisitos:
#   - stripe CLI instalado y autenticado (stripe login)
#   - stripe listen corriendo en otra terminal
#   - El usuario ya tiene una suscripción activa creada desde la app
#
# Uso: ./scripts/test-subscription-renewal.sh

set -e

WEBHOOK_URL="https://stepuptours.ddev.site/api/payment/webhook"
DDEV_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  StepUp Tours — Subscription Renewal Test"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Obtener datos de la suscripción activa desde Drupal ────────────────────

echo "▶ Buscando suscripción activa con plan 'day' en Drupal..."

# Stripe subscription ID
STRIPE_SUB_ID=$(cd "$DDEV_DIR" && ddev drush sqlq \
  "SELECT fss.field_stripe_subscription_id_value
   FROM node__field_stripe_subscription_id fss
   INNER JOIN node__field_subscription_status fst
     ON fss.entity_id = fst.entity_id
   INNER JOIN node__field_plan fp ON fss.entity_id = fp.entity_id
   INNER JOIN node__field_billing_cycle fbc ON fp.field_plan_target_id = fbc.entity_id
   WHERE fst.field_subscription_status_value = 'active'
     AND fbc.field_billing_cycle_value = 'day'
   LIMIT 1;" 2>&1 | grep '^sub_' | tail -1)

# Stripe customer ID
STRIPE_CUSTOMER_ID=$(cd "$DDEV_DIR" && ddev drush sqlq \
  "SELECT fsc.field_stripe_customer_id_value
   FROM node__field_stripe_customer_id fsc
   INNER JOIN node__field_subscription_status fst
     ON fsc.entity_id = fst.entity_id
   WHERE fst.field_subscription_status_value = 'active'
   LIMIT 1;" 2>&1 | grep '^cus_' | tail -1)

# Node UUID de la suscripción (para contar pagos antes/después)
SUB_NODE_UUID=$(cd "$DDEV_DIR" && ddev drush sqlq \
  "SELECT n.uuid
   FROM node n
   INNER JOIN node__field_subscription_status fst ON n.nid = fst.entity_id
   INNER JOIN node__field_plan fp ON n.nid = fp.entity_id
   INNER JOIN node__field_billing_cycle fbc ON fp.field_plan_target_id = fbc.entity_id
   WHERE fst.field_subscription_status_value = 'active'
     AND fbc.field_billing_cycle_value = 'day'
   LIMIT 1;" 2>&1 | grep -E '^[0-9a-f-]{36}$' | tail -1)

if [ -z "$STRIPE_SUB_ID" ] || [ "$STRIPE_SUB_ID" = "NULL" ]; then
  echo ""
  echo "✗ ERROR: No se encontró ninguna suscripción activa con plan 'day'."
  echo ""
  echo "  Pasos para crearla:"
  echo "  1. Abre la app → Dashboard → Subscription"
  echo "  2. Selecciona el plan 'Daily'"
  echo "  3. Paga con tarjeta de test: 4242 4242 4242 4242"
  echo "  4. Vuelve a ejecutar este script"
  echo ""
  exit 1
fi

echo "  ✓ Stripe Subscription ID : $STRIPE_SUB_ID"
echo "  ✓ Stripe Customer ID     : $STRIPE_CUSTOMER_ID"
echo "  ✓ Drupal Subscription UUID: $SUB_NODE_UUID"
echo ""

# ── 2. Contar pagos existentes antes del test ─────────────────────────────────

PAYMENTS_BEFORE=$(cd "$DDEV_DIR" && ddev drush sqlq \
  "SELECT COUNT(*)
   FROM node__field_subscription sp
   INNER JOIN node n ON sp.entity_id = n.nid
   WHERE n.type = 'subscription_payment'
     AND sp.field_subscription_target_id = (
       SELECT nid FROM node WHERE uuid = '$SUB_NODE_UUID' LIMIT 1
     );" 2>&1 | grep -E '^[0-9]' | tail -1)

echo "  Pagos registrados antes del test: $PAYMENTS_BEFORE"
echo ""

# ── 3. Verificar que stripe listen está corriendo ─────────────────────────────

echo "▶ Verificando stripe CLI..."
if ! command -v stripe &> /dev/null; then
  echo ""
  echo "✗ ERROR: stripe CLI no encontrado."
  echo "  Instálalo: https://stripe.com/docs/stripe-cli"
  echo ""
  exit 1
fi

echo "  ✓ stripe CLI disponible"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  IMPORTANTE: Asegúrate de tener en OTRA terminal:"
echo ""
echo "  stripe listen --forward-to $WEBHOOK_URL"
echo ""
echo "  Si no lo tienes corriendo, los webhooks no llegarán."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "¿Tienes stripe listen corriendo? [s/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
  echo ""
  echo "  Abre otra terminal y ejecuta:"
  echo "  stripe listen --forward-to $WEBHOOK_URL"
  echo ""
  exit 0
fi
echo ""

# ── 4. Verificar estado en Stripe y disparar renovación ───────────────────────

echo "▶ Consultando estado de la suscripción en Stripe..."

SUB_JSON=$(stripe subscriptions retrieve "$STRIPE_SUB_ID" 2>/dev/null)

# Extraer status (busca la primera línea con "status" que tenga un valor conocido)
SUB_STATUS=$(echo "$SUB_JSON" | grep '"status"' | head -1 \
  | sed 's/.*"status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

echo "  Estado actual en Stripe: $SUB_STATUS"
echo ""

if [ "$SUB_STATUS" = "trialing" ]; then
  echo "▶ Suscripción en trial — terminando el trial ahora..."
  echo "  Stripe creará la primera invoice de cobro real automáticamente."
  echo ""
  # Terminar el trial inmediatamente. Stripe:
  #   1. Crea una invoice por el primer período real (1 día para el plan daily)
  #   2. La cobra al default_payment_method del customer
  #   3. Dispara invoice.payment_succeeded → webhook → Drupal actualiza
  stripe subscriptions update "$STRIPE_SUB_ID" --trial-end=now > /dev/null 2>&1
  echo "  ✓ Trial terminado"

elif [ "$SUB_STATUS" = "active" ]; then
  echo "▶ Suscripción activa — reiniciando ciclo de facturación..."
  echo "  Stripe creará una invoice de prorrateado con cobro real."
  echo ""
  # Resetear el billing cycle anchor a ahora.
  # Stripe crea una invoice de prorrateado (cobro real) inmediatamente.
  # Con proration_behavior=always_invoice la invoice se emite al instante.
  stripe subscriptions update "$STRIPE_SUB_ID" \
    --billing-cycle-anchor=now \
    --proration-behavior=always_invoice > /dev/null 2>&1
  echo "  ✓ Ciclo reiniciado"

else
  echo ""
  echo "✗ Estado de Stripe no compatible con este test: '$SUB_STATUS'"
  echo ""
  echo "  Este script solo funciona con suscripciones en estado:"
  echo "    - trialing (acabas de suscribirte, trial no ha expirado)"
  echo "    - active   (primer período ya cobrado)"
  echo ""
  echo "  Si la suscripción está cancelada o expirada, crea una nueva:"
  echo "  1. Abre la app → Dashboard → Subscription"
  echo "  2. Selecciona el plan 'Test (1 min)'"
  echo "  3. Paga con tarjeta 4242 4242 4242 4242"
  echo "  4. Vuelve a ejecutar este script"
  echo ""
  exit 1
fi

echo ""

# ── 5. Esperar a que el webhook sea procesado ─────────────────────────────────

echo "▶ Esperando procesamiento del webhook (hasta 90s con reintentos)..."
echo "  (Stripe puede tardar hasta 60s en crear la invoice, cobrarla y enviar el webhook)"

# Retry loop: check every 10s for up to 90s
WAIT_MAX=90
WAIT_STEP=10
WAITED=0
PAYMENTS_NOW="$PAYMENTS_BEFORE"

while [ "$PAYMENTS_NOW" = "$PAYMENTS_BEFORE" ] && [ "$WAITED" -lt "$WAIT_MAX" ]; do
  sleep $WAIT_STEP
  WAITED=$((WAITED + WAIT_STEP))
  PAYMENTS_NOW=$(cd "$DDEV_DIR" && ddev drush sqlq \
    "SELECT COUNT(*) FROM node__field_stripe_subscription_id fs
     INNER JOIN node__field_plan fp ON fp.entity_id = fs.entity_id
     INNER JOIN node_field_data nd ON nd.nid = fs.entity_id
     WHERE nd.type = 'subscription_payment'
     AND fs.field_stripe_subscription_id_value = '$STRIPE_SUB_ID'" \
    2>&1 | grep -E '^[0-9]' | tail -1)
  if [ "$PAYMENTS_NOW" != "$PAYMENTS_BEFORE" ]; then
    echo "  ✓ Webhook procesado tras ${WAITED}s"
  else
    echo "  · Esperando... ${WAITED}s / ${WAIT_MAX}s (pagos: ${PAYMENTS_NOW})"
  fi
done

# ── 6. Verificar resultado en Drupal ─────────────────────────────────────────

echo ""
echo "▶ Verificando resultado en Drupal..."

PAYMENTS_AFTER=$(cd "$DDEV_DIR" && ddev drush sqlq \
  "SELECT COUNT(*)
   FROM node__field_subscription sp
   INNER JOIN node n ON sp.entity_id = n.nid
   WHERE n.type = 'subscription_payment'
     AND sp.field_subscription_target_id = (
       SELECT nid FROM node WHERE uuid = '$SUB_NODE_UUID' LIMIT 1
     );" 2>&1 | grep -E '^[0-9]' | tail -1)

END_DATE_TS=$(cd "$DDEV_DIR" && ddev drush sqlq \
  "SELECT field_end_date_value
   FROM node__field_end_date
   WHERE entity_id = (
     SELECT nid FROM node WHERE uuid = '$SUB_NODE_UUID' LIMIT 1
   );" 2>&1 | grep -E '^[0-9]' | tail -1)

# Convertir timestamp a fecha legible si hay valor
if [ -n "$END_DATE_TS" ] && [ "$END_DATE_TS" -gt 0 ] 2>/dev/null; then
  END_DATE=$(date -d "@$END_DATE_TS" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || \
             date -r "$END_DATE_TS" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || \
             echo "$END_DATE_TS")
else
  END_DATE="${END_DATE_TS:-N/A}"
fi

STATUS=$(cd "$DDEV_DIR" && ddev drush sqlq \
  "SELECT field_subscription_status_value
   FROM node__field_subscription_status
   WHERE entity_id = (
     SELECT nid FROM node WHERE uuid = '$SUB_NODE_UUID' LIMIT 1
   );" 2>&1 | grep -E '^(active|cancelled|expired|past_due)' | tail -1)

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  RESULTADO"
echo "═══════════════════════════════════════════════════════"
echo "  Estado suscripción : $STATUS"
echo "  Fecha fin          : $END_DATE"
echo "  Pagos antes        : $PAYMENTS_BEFORE"
echo "  Pagos después      : $PAYMENTS_AFTER"
echo ""

if [ "${PAYMENTS_AFTER:-0}" -gt "${PAYMENTS_BEFORE:-0}" ] 2>/dev/null; then
  echo "  ✓ TEST PASADO — Se creó un nuevo subscription_payment"
  echo "  ✓ El autorenewal funciona correctamente"
else
  echo "  ✗ TEST FALLIDO — No se creó nuevo payment"
  echo ""
  echo "  Posibles causas:"
  echo "    1. El webhook aún no llegó (espera 5s más y re-ejecuta sólo la"
  echo "       verificación con: ddev drush sqlq 'SELECT COUNT(*) ...')"
  echo "    2. stripe listen no está corriendo"
  echo "    3. Revisa los logs: ddev drush watchdog:show --type=stepuptours_api --count=10"
fi

echo "═══════════════════════════════════════════════════════"
echo ""
