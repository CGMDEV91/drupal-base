#!/usr/bin/env bash
# test-renewal-fast.sh
#
# Simula N renovaciones de una suscripción YA ACTIVA usando Stripe Test Clocks.
#
# Premisa: el usuario ya tiene una suscripción activa con el primer cobro hecho.
# El script NO hace ningún cobro inicial — solo simula los renewals.
#
# Flujo:
#   1. Busca en Drupal un usuario con suscripción activa en plan Daily
#   2. Lee su stripe_customer_id, stripe_subscription_id y current_period_end reales
#   3. Lee de Stripe el PM real del usuario (brand/last4, solo informativo)
#   4. Crea un test clock con frozen_time = current_period_end - 1h
#      (justo antes del primer renewal)
#   5. Crea un customer clonado ligado al clock con pm_card_visa
#   6. Crea una subscription clonada con trial_end = current_period_end
#      → Stripe NO cobra nada al crear la subscription
#      → el primer cobro ocurre cuando el clock supera current_period_end
#   7. Avanza el clock N veces (+1 día) → cada avance dispara un renewal real
#      → webhook invoice.payment_succeeded → Drupal actualiza end_date y registra pago
#   8. Al terminar: elimina el test clock y reactiva el nodo de test en Drupal
#      (el nodo real del usuario NO se toca en ningún momento)
#
# REQUISITOS:
#   - Endpoint registrado en Stripe Dashboard → Developers → Webhooks:
#       https://<tu-ngrok-o-url-publica>/api/payment/webhook
#     Eventos: invoice.payment_succeeded, invoice.payment_failed,
#              customer.subscription.deleted, customer.subscription.updated
#   - stripe_webhook_secret configurado en Drupal (stepuptours.payment)
#   - ngrok o similar corriendo para exponer DDEV al exterior
#
# Uso:
#   ./scripts/test-renewal-fast.sh        # 3 renovaciones (default)
#   ./scripts/test-renewal-fast.sh 1      # 1 renovación
#   ./scripts/test-renewal-fast.sh 3 6    # 3 renovaciones, forzar uid=6

set -e

DDEV_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CYCLES="${1:-3}"
USER_UID_OVERRIDE="${2:-}"
STRIPE_API="https://api.stripe.com/v1"

# Variables globales para el trap de cleanup
CLOCK_ID=""
SUB_NID=""

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  StepUp Tours — Fast Renewal Test (Test Clocks)"
echo "  Simulando ${CYCLES} renovación/es"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── helpers ───────────────────────────────────────────────────────────────────

drush_sqlq() { cd "$DDEV_DIR" && ddev drush sqlq "$1" 2>&1; }

# --data-urlencode evita que '+', espacios u otros chars especiales
# se corrompan al enviarlos a la API de Stripe.
stripe_post() {
  local endpoint="$1"; shift
  local args=()
  for param in "$@"; do args+=(--data-urlencode "$param"); done
  curl -s -X POST "${STRIPE_API}/${endpoint}" \
    -u "${STRIPE_KEY}:" \
    "${args[@]}"
}

stripe_get()    { curl -s "${STRIPE_API}/${1}" -u "${STRIPE_KEY}:"; }
stripe_delete() { curl -s -X DELETE "${STRIPE_API}/${1}" -u "${STRIPE_KEY}:"; }

json_val() {
  local key="$1" json="$2"
  echo "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
    | head -1 | sed 's/.*"[^"]*"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/'
}

json_num() {
  local key="$1" json="$2"
  echo "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*[0-9]*" \
    | head -1 | sed 's/.*:[[:space:]]*//'
}

count_payments() {
  drush_sqlq \
    "SELECT COUNT(*) FROM node n
     INNER JOIN node__field_subscription fs ON fs.entity_id = n.nid
     WHERE n.type = 'subscription_payment'
       AND fs.field_subscription_target_id = ${1};" \
  | grep -E '^[0-9]+' | tail -1
}

get_end_date() {
  local ts
  ts=$(drush_sqlq \
    "SELECT field_end_date_value FROM node__field_end_date
     WHERE entity_id = ${1};" \
  | grep -E '^[0-9]+' | tail -1)
  [ -n "$ts" ] && [ "$ts" -gt 0 ] 2>/dev/null \
    && (date -d "@${ts}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null \
        || date -r "${ts}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null) \
    || echo "N/A"
}

get_status() {
  drush_sqlq \
    "SELECT field_subscription_status_value
     FROM node__field_subscription_status WHERE entity_id = ${1};" \
  | grep -E '^(active|cancelled|expired|past_due)' | tail -1
}

wait_clock_ready() {
  local clock_id="$1" max_wait="${2:-60}"
  local step=3 waited=0 status
  while [ "$waited" -lt "$max_wait" ]; do
    sleep $step
    waited=$((waited + step))
    status=$(stripe_get "test_helpers/test_clocks/${clock_id}" \
      | grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' \
      | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
    if [ "$status" = "ready" ]; then
      echo "    ✓ Clock listo (${waited}s)"
      return 0
    fi
    echo "    · ${waited}s — clock status: ${status:-desconocido}"
  done
  echo "    ✗ Timeout esperando clock ready (${max_wait}s)"
  return 1
}

wait_for_payment() {
  local sub_nid="$1" expected="$2" max_wait="${3:-120}"
  local step=5 waited=0 current
  while [ "$waited" -lt "$max_wait" ]; do
    sleep $step
    waited=$((waited + step))
    current=$(count_payments "$sub_nid")
    if [ "${current:-0}" -ge "${expected:-1}" ] 2>/dev/null; then
      echo "    ✓ Payment registrado en Drupal (${waited}s)"
      return 0
    fi
    echo "    · ${waited}s — pagos: ${current} / esperados: ${expected} | end_date: $(get_end_date "$sub_nid")"
  done
  echo "    ✗ Timeout (${max_wait}s) — pagos: $(count_payments "$sub_nid") / esperados: ${expected}"
  return 1
}

# Cleanup automático al salir (éxito, error o Ctrl+C)
cleanup() {
  if [ -n "${CLOCK_ID}" ]; then
    echo ""
    echo "▶ Limpiando test clock..."
    stripe_delete "test_helpers/test_clocks/${CLOCK_ID}" > /dev/null \
      && echo "  ✓ Test clock eliminado" \
      || echo "  ~ No se pudo eliminar — hazlo manualmente en el Dashboard"
  fi

  # Reactivar el nodo de test: al borrar el clock, Stripe dispara
  # customer.subscription.deleted → webhook → nodo marcado 'expired'.
  # Lo reactivamos para que quede en estado coherente.
  if [ -n "${SUB_NID}" ]; then
    echo ""
    echo "▶ Reactivando nodo de test en Drupal (nid: $SUB_NID)..."
    REACTIVATE=$(cd "$DDEV_DIR" && ddev drush php-eval "
\$node = \Drupal::entityTypeManager()->getStorage('node')->load(${SUB_NID});
if (\$node) {
  \$node->set('field_subscription_status', 'active');
  \$node->set('field_auto_renewal', TRUE);
  \$node->save();
  echo 'OK';
}
" 2>/dev/null || true)
    echo "$REACTIVATE" | grep -q 'OK' \
      && echo "  ✓ Nodo reactivado (status: active)" \
      || echo "  ~ No se pudo reactivar el nodo"
  fi
}

trap cleanup EXIT

# ── 0. Verificaciones ─────────────────────────────────────────────────────────

echo "▶ Verificando prerrequisitos..."
command -v curl &>/dev/null || { echo "  ✗ curl no encontrado."; exit 1; }
echo "  ✓ curl disponible"
echo ""

# ── 1. Leer configuración de Stripe desde Drupal ──────────────────────────────

echo "▶ Leyendo configuración de Stripe..."

STRIPE_KEY=$(cd "$DDEV_DIR" && ddev drush php-eval \
  "echo \Drupal::config('stepuptours.payment')->get('stripe_secret_key');" 2>/dev/null \
| grep '^sk_test_' | tail -1)

[ -z "$STRIPE_KEY" ] && { echo "  ✗ No se encontró stripe_secret_key."; exit 1; }

echo "  ✓ Stripe key: ${STRIPE_KEY:0:12}..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Los webhooks van al endpoint registrado en el Dashboard."
echo "  Asegúrate de que ngrok/tunnel esté activo y el endpoint"
echo "  registrado en: https://dashboard.stripe.com/test/webhooks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "¿El endpoint está registrado y ngrok está activo? [s/N] " CONFIRM
[[ "$CONFIRM" =~ ^[sS]$ ]] || { echo "  Configúralo antes de continuar."; exit 0; }
echo ""

# ── 2. Buscar usuario con suscripción activa en plan Daily ────────────────────

echo "▶ Buscando usuario con suscripción activa en plan Daily..."

if [ -n "$USER_UID_OVERRIDE" ]; then
  USER_UID="$USER_UID_OVERRIDE"
  echo "  · Usando uid forzado: $USER_UID"
else
  USER_UID=$(drush_sqlq \
    "SELECT nu.field_user_target_id
     FROM node__field_user nu
     INNER JOIN node__field_subscription_status ns ON ns.entity_id = nu.entity_id
     INNER JOIN node__field_plan np ON np.entity_id = nu.entity_id
     INNER JOIN node__field_billing_cycle bc ON bc.entity_id = np.field_plan_target_id
     WHERE ns.field_subscription_status_value = 'active'
       AND bc.field_billing_cycle_value = 'day'
       AND nu.bundle = 'subscription'
     LIMIT 1;" \
  | grep -E '^[0-9]+' | tail -1)
fi

[ -z "$USER_UID" ] && {
  echo "  ✗ No se encontró ningún usuario con suscripción activa en plan Daily."
  echo "    Crea una suscripción manualmente o pasa el uid como 2º argumento:"
  echo "    ./scripts/test-renewal-fast.sh 3 <uid>"
  exit 1
}

USER_NAME=$(drush_sqlq \
  "SELECT name FROM users_field_data WHERE uid = ${USER_UID};" \
| grep -v '^$' | tail -1)

echo "  ✓ Usuario: ${USER_NAME} (uid: $USER_UID)"
echo ""

# ── 3. Leer suscripción activa del usuario en Drupal ─────────────────────────

echo "▶ Leyendo suscripción activa del usuario..."

REAL_SUB_NID=$(drush_sqlq \
  "SELECT nu.entity_id
   FROM node__field_user nu
   INNER JOIN node__field_subscription_status ns ON ns.entity_id = nu.entity_id
   INNER JOIN node__field_plan np ON np.entity_id = nu.entity_id
   INNER JOIN node__field_billing_cycle bc ON bc.entity_id = np.field_plan_target_id
   WHERE nu.field_user_target_id = ${USER_UID}
     AND ns.field_subscription_status_value = 'active'
     AND bc.field_billing_cycle_value = 'day'
     AND nu.bundle = 'subscription'
   LIMIT 1;" \
| grep -E '^[0-9]+' | tail -1)

[ -z "$REAL_SUB_NID" ] && {
  echo "  ✗ No se encontró nodo subscription activo para uid $USER_UID."
  exit 1
}

REAL_STRIPE_CUSTOMER_ID=$(drush_sqlq \
  "SELECT field_stripe_customer_id_value
   FROM node__field_stripe_customer_id
   WHERE entity_id = ${REAL_SUB_NID};" \
| grep -v '^$' | tail -1)

REAL_STRIPE_SUB_ID=$(drush_sqlq \
  "SELECT field_stripe_subscription_id_value
   FROM node__field_stripe_subscription_id
   WHERE entity_id = ${REAL_SUB_NID};" \
| grep -v '^$' | tail -1)

PLAN_NID=$(drush_sqlq \
  "SELECT field_plan_target_id FROM node__field_plan
   WHERE entity_id = ${REAL_SUB_NID};" \
| grep -E '^[0-9]+' | tail -1)

# current_period_end desde Drupal (field_end_date de la sub real)
REAL_PERIOD_END=$(drush_sqlq \
  "SELECT field_end_date_value FROM node__field_end_date
   WHERE entity_id = ${REAL_SUB_NID};" \
| grep -E '^[0-9]+' | tail -1)

echo "  ✓ Subscription nid    : $REAL_SUB_NID  ← no se tocará"
echo "  ✓ Stripe customer     : $REAL_STRIPE_CUSTOMER_ID"
echo "  ✓ Stripe subscription : $REAL_STRIPE_SUB_ID"
echo "  ✓ Plan nid            : $PLAN_NID"
echo "  ✓ Period end (real)   : $(date -d "@${REAL_PERIOD_END}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -r "${REAL_PERIOD_END}" '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── 4. Verificar current_period_end contra Stripe ────────────────────────────
# Usar el valor de Stripe como fuente de verdad por si Drupal está desincronizado.

echo "▶ Verificando current_period_end en Stripe..."

REAL_SUB_RESP=$(stripe_get "subscriptions/${REAL_STRIPE_SUB_ID}")

# Stripe API 2024+: current_period_end puede estar a nivel de item
STRIPE_PERIOD_END=$(json_num "current_period_end" "$REAL_SUB_RESP")
if [ -z "$STRIPE_PERIOD_END" ] || [ "$STRIPE_PERIOD_END" = "0" ]; then
  # Intentar desde items[0]
  STRIPE_PERIOD_END=$(echo "$REAL_SUB_RESP" \
    | grep -o '"current_period_end"[[:space:]]*:[[:space:]]*[0-9]*' \
    | head -2 | tail -1 | sed 's/.*:[[:space:]]*//')
fi

# Fallback a Drupal si Stripe no devuelve el valor
if [ -z "$STRIPE_PERIOD_END" ] || [ "$STRIPE_PERIOD_END" = "0" ]; then
  echo "  ~ No se pudo leer current_period_end de Stripe, usando Drupal"
  STRIPE_PERIOD_END="$REAL_PERIOD_END"
fi

PERIOD_END_DATE=$(date -d "@${STRIPE_PERIOD_END}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null \
  || date -r "${STRIPE_PERIOD_END}" '+%Y-%m-%d %H:%M:%S')

echo "  ✓ current_period_end (Stripe): $PERIOD_END_DATE (ts: $STRIPE_PERIOD_END)"
echo ""

# ── 5. Leer plan desde Drupal ─────────────────────────────────────────────────

echo "▶ Leyendo datos del plan..."

PLAN_PRICE=$(drush_sqlq \
  "SELECT field_price_value FROM node__field_price
   WHERE entity_id = ${PLAN_NID};" \
| grep -E '^[0-9]+(\.[0-9]+)?$' | tail -1)

PLAN_LABEL=$(drush_sqlq \
  "SELECT title FROM node_field_data WHERE nid = ${PLAN_NID};" \
| grep -v '^$' | tail -1)

PLAN_UUID=$(drush_sqlq \
  "SELECT uuid FROM node WHERE nid = ${PLAN_NID};" \
| grep -E '^[0-9a-f-]{36}$' | tail -1)

[ -z "$PLAN_PRICE" ] && { echo "  ✗ No se encontró precio del plan."; exit 1; }

echo "  ✓ Plan: '${PLAN_LABEL}' (nid: $PLAN_NID, precio: €${PLAN_PRICE}/day)"
echo ""

# ── 6. Leer PM del customer real en Stripe (solo informativo) ─────────────────

echo "▶ Leyendo método de pago del customer real en Stripe..."

REAL_CUSTOMER_RESP=$(stripe_get "customers/${REAL_STRIPE_CUSTOMER_ID}?expand[]=invoice_settings.default_payment_method")
REAL_PM_BRAND=$(echo "$REAL_CUSTOMER_RESP" \
  | grep -o '"brand"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
REAL_PM_LAST4=$(echo "$REAL_CUSTOMER_RESP" \
  | grep -o '"last4"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -1 | sed 's/.*"\([^"]*\)".*/\1/')

if [ -n "$REAL_PM_BRAND" ] && [ -n "$REAL_PM_LAST4" ]; then
  echo "  ✓ PM real del usuario  : ${REAL_PM_BRAND} ****${REAL_PM_LAST4}"
  echo "  · PM del clone         : pm_card_visa (Visa 4242, equivalente funcional)"
  echo "    Un PM solo puede estar adjunto a un customer — no se puede transferir."
else
  echo "  ~ No se pudo leer el PM real (se usará pm_card_visa)"
fi
echo ""

# ── 7. Crear Test Clock ───────────────────────────────────────────────────────
# frozen_time = current_period_end - 1h
# El clock arranca justo antes del primer renewal, sin cobro inicial.

echo "▶ Creando Stripe Test Clock..."

CLOCK_START_TS=$((STRIPE_PERIOD_END - 3600))
CLOCK_START_DATE=$(date -d "@${CLOCK_START_TS}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null \
  || date -r "${CLOCK_START_TS}" '+%Y-%m-%d %H:%M:%S')

CLOCK_RESP=$(stripe_post "test_helpers/test_clocks" \
  "frozen_time=${CLOCK_START_TS}" \
  "name=StepUp ${USER_NAME} $(date '+%Y-%m-%d %H:%M')")

CLOCK_ID=$(json_val "id" "$CLOCK_RESP")

if [ -z "$CLOCK_ID" ] || [[ "$CLOCK_ID" != clock_* ]]; then
  echo "  ✗ No se pudo crear el Test Clock."
  echo "    Respuesta: $CLOCK_RESP"
  exit 1
fi

echo "  ✓ Test Clock  : $CLOCK_ID"
echo "  · Frozen time : $CLOCK_START_DATE (1h antes del primer renewal)"
echo ""

# ── 8. Crear customer clonado ligado al test clock ────────────────────────────

echo "▶ Creando customer clonado ligado al test clock..."

CUSTOMER_RESP=$(stripe_post "customers" \
  "email=testclock-${USER_UID}@stepuptours.test" \
  "name=${USER_NAME} (test clock)" \
  "test_clock=${CLOCK_ID}" \
  "payment_method=pm_card_visa" \
  "invoice_settings[default_payment_method]=pm_card_visa" \
  "metadata[user_uid]=${USER_UID}" \
  "metadata[real_customer_id]=${REAL_STRIPE_CUSTOMER_ID}" \
  "metadata[test_clock]=true")

CUSTOMER_ID=$(json_val "id" "$CUSTOMER_RESP")

if [ -z "$CUSTOMER_ID" ] || [[ "$CUSTOMER_ID" != cus_* ]]; then
  echo "  ✗ No se pudo crear el customer clonado."
  echo "    Respuesta: $CUSTOMER_RESP"
  exit 1
fi

echo "  ✓ Customer clonado: $CUSTOMER_ID"

# Recuperar el pm_... real generado por Stripe al adjuntar pm_card_visa
PM_LIST_RESP=$(curl -s "${STRIPE_API}/customers/${CUSTOMER_ID}/payment_methods?type=card" \
  -u "${STRIPE_KEY}:")

PM_ID=$(echo "$PM_LIST_RESP" \
  | grep -o '"id"[[:space:]]*:[[:space:]]*"pm_[^"]*"' \
  | head -1 | sed 's/.*"\(pm_[^"]*\)".*/\1/')

if [ -z "$PM_ID" ]; then
  echo "  ✗ No se encontró PM real en el customer clonado."
  echo "    Respuesta: $PM_LIST_RESP"
  exit 1
fi

echo "  ✓ PM del customer clonado: $PM_ID"
echo ""

# ── 9. Crear Stripe Price ─────────────────────────────────────────────────────

echo "▶ Creando Stripe Price..."

AMOUNT_CENTS=$(awk "BEGIN {printf \"%d\", ${PLAN_PRICE} * 100}")

PRICE_RESP=$(stripe_post "prices" \
  "unit_amount=${AMOUNT_CENTS}" \
  "currency=eur" \
  "recurring[interval]=day" \
  "product_data[name]=${PLAN_LABEL} (test clock)" \
  "metadata[plan_uuid]=${PLAN_UUID}" \
  "metadata[plan_nid]=${PLAN_NID}")

PRICE_ID=$(json_val "id" "$PRICE_RESP")

[ -z "$PRICE_ID" ] && {
  echo "  ✗ No se pudo crear el Price. Resp: $PRICE_RESP"
  exit 1
}

echo "  ✓ Price: $PRICE_ID"
echo ""

# ── 10. Crear subscription clonada con trial_end = current_period_end ─────────
# trial_end = STRIPE_PERIOD_END → Stripe NO cobra nada al crear la subscription.
# El primer cobro real ocurre cuando el clock supere STRIPE_PERIOD_END.
# Esto simula exactamente el estado de una suscripción ya activa esperando renewal.

echo "▶ Creando subscription clonada..."
echo "  · trial_end = $PERIOD_END_DATE"
echo "  · Sin cobro inicial — primer cobro = primer renewal al avanzar el clock"
echo ""

STRIPE_SUB_RESP=$(stripe_post "subscriptions" \
  "customer=${CUSTOMER_ID}" \
  "items[0][price]=${PRICE_ID}" \
  "default_payment_method=${PM_ID}" \
  "collection_method=charge_automatically" \
  "trial_end=${STRIPE_PERIOD_END}" \
  "metadata[plan_uuid]=${PLAN_UUID}" \
  "metadata[plan_nid]=${PLAN_NID}" \
  "metadata[user_uid]=${USER_UID}" \
  "metadata[billing_cycle]=day" \
  "metadata[customer_id]=${CUSTOMER_ID}" \
  "metadata[test_clock]=true" \
  "metadata[real_sub_id]=${REAL_STRIPE_SUB_ID}")

STRIPE_SUB_ID=$(json_val "id" "$STRIPE_SUB_RESP")

if [ -z "$STRIPE_SUB_ID" ] || [[ "$STRIPE_SUB_ID" != sub_* ]]; then
  echo "  ✗ No se pudo crear la subscription clonada."
  echo "    Respuesta: $STRIPE_SUB_RESP"
  exit 1
fi

echo "  ✓ Stripe Subscription clonada: $STRIPE_SUB_ID"
echo ""

# ── 11. Crear nodo Drupal de test manualmente ─────────────────────────────────
# Al usar trial_end, Stripe genera un $0 invoice que NO dispara
# invoice.payment_succeeded (o lo dispara con amount_paid=0 y tu webhook lo
# ignora correctamente). Creamos el nodo de test directamente para que el
# bucle de renovaciones tenga un nodo al que enlazar los pagos.

echo "▶ Creando nodo Drupal de test..."

SUB_NID=$(cd "$DDEV_DIR" && ddev drush php-eval "
\$node = \Drupal::entityTypeManager()->getStorage('node')->create([
  'type'                         => 'subscription',
  'title'                        => 'TestClock ${USER_NAME} $(date +%Y-%m-%d)',
  'status'                       => 1,
  'uid'                          => ${USER_UID},
  'field_user'                   => ['target_id' => ${USER_UID}],
  'field_plan'                   => ['target_id' => ${PLAN_NID}],
  'field_subscription_status'    => 'active',
  'field_start_date'             => ${CLOCK_START_TS},
  'field_end_date'               => ${STRIPE_PERIOD_END},
  'field_auto_renewal'           => TRUE,
  'field_stripe_subscription_id' => '${STRIPE_SUB_ID}',
  'field_stripe_customer_id'     => '${CUSTOMER_ID}',
]);
\$node->save();
echo \$node->id();
" 2>/dev/null | grep -E '^[0-9]+' | tail -1)

[ -z "$SUB_NID" ] && { echo "  ✗ No se pudo crear el nodo Drupal de test."; exit 1; }

echo "  ✓ Nodo de test creado: nid $SUB_NID"
echo ""
echo "  Estado inicial del nodo de test:"
echo "    nodo test  : $SUB_NID"
echo "    nodo real  : $REAL_SUB_NID  ← intacto"
echo "    status     : $(get_status $SUB_NID)"
echo "    end_date   : $(get_end_date $SUB_NID)"
echo "    pagos      : 0 (el primer cobro real ocurre en el ciclo 1)"
echo ""

PAYMENTS_BEFORE=0

# ── 12. Bucle de renovaciones ─────────────────────────────────────────────────
# Cada ciclo avanza el clock 1 día más allá del period_end actual.
# Stripe procesa el renewal → invoice.payment_succeeded → webhook →
# handleInvoicePaymentSucceeded() actualiza end_date y crea subscription_payment.

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Simulando ${CYCLES} renovación/es (+1 día por ciclo)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# El primer avance debe superar STRIPE_PERIOD_END (trial_end).
# Partimos desde CLOCK_START_TS y sumamos 1 día + 1h por ciclo.
CURRENT_CLOCK_TS=$CLOCK_START_TS
ALL_PASSED=true

for CYCLE in $(seq 1 "$CYCLES"); do
  echo "── Ciclo ${CYCLE} / ${CYCLES} ────────────────────────────────────"

  PAYMENTS_BEFORE_CYCLE=$(count_payments "$SUB_NID")
  EXPECTED=$((PAYMENTS_BEFORE_CYCLE + 1))

  # +1 día + 1 hora de margen sobre el period_end actual
  CURRENT_CLOCK_TS=$((CURRENT_CLOCK_TS + 86400 + 3600))
  TARGET_DATE=$(date -d "@${CURRENT_CLOCK_TS}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null \
    || date -r "${CURRENT_CLOCK_TS}" '+%Y-%m-%d %H:%M:%S')

  echo "  Avanzando test clock → $TARGET_DATE"

  ADVANCE_RESP=$(stripe_post \
    "test_helpers/test_clocks/${CLOCK_ID}/advance" \
    "frozen_time=${CURRENT_CLOCK_TS}")

  if echo "$ADVANCE_RESP" | grep -q '"error"'; then
    echo "  ✗ Error avanzando el clock: $ADVANCE_RESP"
    ALL_PASSED=false
    continue
  fi

  echo "  ✓ Clock avanzado — esperando que Stripe procese (advancing → ready)..."
  echo ""

  wait_clock_ready "$CLOCK_ID" 60 || true

  echo "  Esperando webhook invoice.payment_succeeded en Drupal..."
  wait_for_payment "$SUB_NID" "$EXPECTED" 120 || ALL_PASSED=false

  echo ""
  echo "  Estado Drupal ciclo ${CYCLE}:"
  echo "    status   : $(get_status $SUB_NID)"
  echo "    end_date : $(get_end_date $SUB_NID)"
  echo "    pagos    : $(count_payments $SUB_NID)"
  echo ""

  [ "$CYCLE" -lt "$CYCLES" ] && sleep 3
done

# ── 13. Resumen final ─────────────────────────────────────────────────────────
# trap EXIT ejecuta cleanup() automáticamente:
#   - elimina el test clock
#   - reactiva el nodo de test en Drupal

PAYMENTS_FINAL=$(count_payments "$SUB_NID")

echo "═══════════════════════════════════════════════════════"
echo "  RESUMEN FINAL"
echo "═══════════════════════════════════════════════════════"
echo "  Usuario           : ${USER_NAME} (uid: $USER_UID)"
echo "  Nodo real         : $REAL_SUB_NID  ← intacto"
echo "  Nodo test         : $SUB_NID"
echo "  Stripe sub test   : $STRIPE_SUB_ID"
echo "  Pagos test        : $PAYMENTS_FINAL (esperados: ${CYCLES})"
echo ""

if $ALL_PASSED && [ "${PAYMENTS_FINAL:-0}" -ge "${CYCLES}" ] 2>/dev/null; then
  echo "  ✓✓ TEST PASADO — ${CYCLES} renovación/es simuladas correctamente"
else
  echo "  ✗✗ TEST FALLIDO"
  echo ""
  echo "  Diagnóstico:"
  echo "    ddev drush watchdog:show --type=stepuptours_api --count=20"
  echo "    https://dashboard.stripe.com/test/events"
  echo "    Drupal nid test : $SUB_NID"
  echo "    Stripe sub test : $STRIPE_SUB_ID"
fi

echo "═══════════════════════════════════════════════════════"
echo ""
# cleanup() se ejecuta aquí automáticamente via trap EXIT
