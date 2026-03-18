#!/usr/bin/env python3
"""
StepUp Tours — API Test Script
Genera un archivo Markdown con los resultados de todos los endpoints.
Uso: python3 test_api.py
Output: api_results.md
"""

import urllib.request
import urllib.error
import json
import base64
import ssl
import datetime

BASE = "https://stepuptours.ddev.site"
OUTPUT_FILE = "api_results.md"

TOUR_MADRID = "71cdf528-1eba-49a0-860c-41d556fc765e"
USER_AUTH   = "86a2d84f-6437-4657-a271-404c2552b968"
USER_PRO    = "2151c6d3-4d7a-493f-81c7-1b94e712f64e"

CREDS = {
    "john_traveler": base64.b64encode(b"john_traveler:traveler123").decode(),
    "maria_guide":   base64.b64encode(b"maria_guide:guide123").decode(),
    "admin":         base64.b64encode(b"admin:admin").decode(),
}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

lines = []

# ── Helpers ───────────────────────────────────────────────────────────────────

def fetch(url, user=None):
    headers = {"Accept": "application/vnd.api+json"}
    if user and user in CREDS:
        headers["Authorization"] = f"Basic {CREDS[user]}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            return json.loads(resp.read().decode()), resp.status, None
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except Exception:
            body = {}
        return body, e.code, str(e)
    except Exception as e:
        return {}, 0, str(e)

def w(*args):
    lines.append(" ".join(str(a) for a in args))

def h1(text): w(f"\n# {text}\n")
def h2(text): w(f"\n## {text}\n")
def h3(text): w(f"\n### {text}\n")

def badge(status_code):
    return f"`✅ {status_code}`" if 200 <= status_code < 300 else f"`❌ {status_code}`"

def extract_included(data):
    result = {}
    for item in data.get("included", []):
        result[item.get("id")] = item.get("attributes", {})
    return result

def resolve_rel(rel_data, inc):
    if not rel_data:
        return "—"
    if isinstance(rel_data, list):
        names = []
        for r in rel_data:
            attrs = inc.get(r.get("id", ""), {})
            names.append(attrs.get("name") or attrs.get("title") or "—")
        return ", ".join(names) if names else "—"
    attrs = inc.get(rel_data.get("id", ""), {})
    return attrs.get("name") or attrs.get("title") or "—"

def fmt(value):
    if value is None: return "—"
    if isinstance(value, bool): return "✅" if value else "❌"
    if isinstance(value, dict): return (value.get("value") or str(value))[:120]
    return str(value)

def section(label, url, user, renderer):
    user_label = f"`{user}`" if user else "`anónimo`"
    w(f"\n---\n")
    h3(label)
    w(f"**Usuario:** {user_label}  ")
    w(f"**URL:**")
    w(f"```")
    w(url)
    w(f"```")
    data, status, err = fetch(url, user)
    w(f"**Estado:** {badge(status)}\n")
    if err and status == 0:
        w(f"> ⚠️ Error de conexión: `{err}`\n")
        return
    if status >= 400:
        errors = data.get("errors", [])
        if errors:
            w("| Error | Detalle |")
            w("|---|---|")
            for e in errors:
                w(f"| {e.get('title','Error')} | {e.get('detail','—')} |")
        else:
            w(f"> ⚠️ Sin datos. Revisa permisos o UUID.\n")
        return
    renderer(data)

# ── Renderers ─────────────────────────────────────────────────────────────────

def render_tours(data):
    items = data.get("data", [])
    if not items:
        w("> Sin resultados.\n"); return
    inc = extract_included(data)
    w("| Title | Rating | Duración | Donaciones | Ciudad | País |")
    w("|---|---|---|---|---|---|")
    for item in items:
        a = item.get("attributes", {})
        rels = item.get("relationships", {})
        city = resolve_rel((rels.get("field_city") or {}).get("data"), inc)
        country = resolve_rel((rels.get("field_country") or {}).get("data"), inc)
        w(f"| {fmt(a.get('title'))} | {fmt(a.get('field_average_rate'))} | {fmt(a.get('field_duration'))} min | {fmt(a.get('field_donation_count'))} | {city} | {country} |")
    w(f"\n> **Total:** {len(items)} tour(s)\n")

def render_tour_detail(data):
    item = data.get("data", {})
    if not item:
        w("> Sin resultados.\n"); return
    inc = extract_included(data)
    a = item.get("attributes", {})
    rels = item.get("relationships", {})
    w("| Campo | Valor |")
    w("|---|---|")
    w(f"| Title | {fmt(a.get('title'))} |")
    w(f"| Duración | {fmt(a.get('field_duration'))} min |")
    w(f"| Rating medio | {fmt(a.get('field_average_rate'))} |")
    w(f"| Donaciones | {fmt(a.get('field_donation_count'))} |")
    w(f"| Total donado | {fmt(a.get('field_donation_total'))} € |")
    w(f"| Ciudad | {resolve_rel((rels.get('field_city') or {}).get('data'), inc)} |")
    w(f"| País | {resolve_rel((rels.get('field_country') or {}).get('data'), inc)} |")
    w(f"| Autor | {resolve_rel((rels.get('uid') or {}).get('data'), inc)} |")
    for i in [1, 2, 3]:
        biz = (rels.get(f"field_featured_business_{i}") or {}).get("data")
        w(f"| Negocio slot {i} | {resolve_rel(biz, inc) if biz else '—'} |")
    desc = a.get("field_description")
    if desc:
        text = desc.get("value", "") if isinstance(desc, dict) else str(desc)
        w(f"\n**Descripción:**\n\n> {text[:300]}{'...' if len(text) > 300 else ''}\n")

def render_steps(data):
    items = data.get("data", [])
    if not items:
        w("> Sin steps.\n"); return
    inc = extract_included(data)
    w("| Orden | Title | Completados | Negocio | Lat | Lon |")
    w("|---|---|---|---|---|---|")
    for item in items:
        a = item.get("attributes", {})
        rels = item.get("relationships", {})
        biz = (rels.get("field_featured_business") or {}).get("data")
        loc = a.get("field_location") or {}
        w(f"| {fmt(a.get('field_order'))} | {fmt(a.get('title'))} | {fmt(a.get('field_total_completed'))} | {resolve_rel(biz, inc) if biz else '—'} | {fmt(loc.get('lat'))} | {fmt(loc.get('lon'))} |")

def render_activity(data):
    items = data.get("data", [])
    if not items:
        w("> Sin actividad registrada para este usuario en este tour.\n"); return
    inc = extract_included(data)
    w("| Campo | Valor |")
    w("|---|---|")
    for item in items:
        a = item.get("attributes", {})
        rels = item.get("relationships", {})
        w(f"| Tour | {resolve_rel((rels.get('field_tour') or {}).get('data'), inc)} |")
        w(f"| Favorito | {fmt(a.get('field_is_favorite'))} |")
        w(f"| Guardado | {fmt(a.get('field_is_saved'))} |")
        w(f"| Completado | {fmt(a.get('field_is_completed'))} |")
        w(f"| Rating | {fmt(a.get('field_user_rating'))} |")
        w(f"| Completado el | {fmt(a.get('field_completed_at', ''))[:19]} |")
        w(f"| XP otorgados | {fmt(a.get('field_xp_awarded'))} |")

def render_user_tours(data):
    items = data.get("data", [])
    if not items:
        w("> Sin actividad registrada.\n"); return
    inc = extract_included(data)
    w("| Tour | Favorito | Guardado | Completado | Rating | XP |")
    w("|---|---|---|---|---|---|")
    for item in items:
        a = item.get("attributes", {})
        rels = item.get("relationships", {})
        tour = resolve_rel((rels.get("field_tour") or {}).get("data"), inc)
        w(f"| {tour} | {fmt(a.get('field_is_favorite'))} | {fmt(a.get('field_is_saved'))} | {fmt(a.get('field_is_completed'))} | {fmt(a.get('field_user_rating'))} | {fmt(a.get('field_xp_awarded'))} |")

def render_user_profile(data):
    item = data.get("data", {})
    if not item:
        w("> Sin resultados.\n"); return
    inc = extract_included(data)
    a = item.get("attributes", {})
    rels = item.get("relationships", {})
    country = resolve_rel((rels.get("field_country") or {}).get("data"), inc)
    w("| Campo | Valor |")
    w("|---|---|")
    w(f"| Username | {fmt(a.get('name'))} |")
    w(f"| Nombre público | {fmt(a.get('field_public_name'))} |")
    w(f"| Email | {fmt(a.get('mail'))} |")
    w(f"| Registrado | {fmt(a.get('created', ''))[:19]} |")
    w(f"| País | {country} |")
    w(f"| XP | {fmt(a.get('field_experience_points'))} |")

def render_donations(data):
    items = data.get("data", [])
    if not items:
        w("> Sin donaciones.\n"); return
    inc = extract_included(data)
    w("| Tour | Importe | Estado | Guía € | Plataforma € | Fecha |")
    w("|---|---|---|---|---|---|")
    for item in items:
        a = item.get("attributes", {})
        rels = item.get("relationships", {})
        tour = resolve_rel((rels.get("field_tour") or {}).get("data"), inc)
        w(f"| {tour} | {fmt(a.get('field_amount'))} | {fmt(a.get('field_status'))} | {fmt(a.get('field_guide_revenue'))} | {fmt(a.get('field_platform_revenue'))} | {fmt(a.get('created', ''))[:10]} |")

def render_professional_profile(data):
    raw = data.get("data", [])
    item = raw[0] if isinstance(raw, list) and raw else (raw if isinstance(raw, dict) else {})
    if not item:
        w("> Sin perfil profesional.\n"); return
    a = item.get("attributes", {})
    w("| Campo | Valor |")
    w("|---|---|")
    w(f"| Nombre legal | {fmt(a.get('field_full_name'))} |")
    w(f"| Tax ID | {fmt(a.get('field_tax_id'))} |")
    w(f"| Titular cuenta | {fmt(a.get('field_account_holder'))} |")
    w(f"| Revenue % | {fmt(a.get('field_revenue_percentage'))} % |")

def render_subscription(data):
    raw = data.get("data", [])
    if not raw:
        w("> Sin suscripción activa.\n"); return
    inc = extract_included(data)
    item = raw[0] if isinstance(raw, list) else raw
    a = item.get("attributes", {})
    rels = item.get("relationships", {})
    plan_id = (rels.get("field_plan") or {}).get("data", {})
    plan_attrs = inc.get(plan_id.get("id", ""), {}) if plan_id else {}
    w("| Campo | Valor |")
    w("|---|---|")
    w(f"| Estado | {fmt(a.get('field_subscription_status'))} |")
    w(f"| Plan | {fmt(plan_attrs.get('title'))} |")
    w(f"| Tipo | {fmt(plan_attrs.get('field_plan_type'))} |")
    w(f"| Precio | {fmt(plan_attrs.get('field_price'))} € |")
    w(f"| Ciclo | {fmt(plan_attrs.get('field_billing_cycle'))} |")
    w(f"| Inicio | {fmt(a.get('field_start_date', ''))[:10]} |")
    w(f"| Fin | {fmt(a.get('field_end_date', ''))[:10]} |")
    w(f"| Renovación auto | {fmt(a.get('field_auto_renewal'))} |")
    w(f"| Slots detalle | {fmt(plan_attrs.get('field_max_featured_detail'))} |")
    w(f"| Slots steps | {fmt(plan_attrs.get('field_max_featured_steps'))} (-1=ilimitado) |")
    w(f"| Max idiomas | {fmt(plan_attrs.get('field_max_languages'))} (-1=ilimitado) |")
    w(f"| Negocio por step | {fmt(plan_attrs.get('field_featured_per_step'))} |")

def render_my_tours(data):
    items = data.get("data", [])
    if not items:
        w("> Sin tours creados.\n"); return
    inc = extract_included(data)
    w("| Title | Rating | Duración | Donaciones | Total € | Publicado | Ciudad |")
    w("|---|---|---|---|---|---|---|")
    for item in items:
        a = item.get("attributes", {})
        rels = item.get("relationships", {})
        city = resolve_rel((rels.get("field_city") or {}).get("data"), inc)
        w(f"| {fmt(a.get('title'))} | {fmt(a.get('field_average_rate'))} | {fmt(a.get('field_duration'))} min | {fmt(a.get('field_donation_count'))} | {fmt(a.get('field_donation_total'))} | {fmt(a.get('status'))} | {city} |")

def render_all_tours_admin(data):
    items = data.get("data", [])
    if not items:
        w("> Sin tours.\n"); return
    inc = extract_included(data)
    w("| Title | Rating | Donaciones | Total € | Publicado | Autor | Ciudad |")
    w("|---|---|---|---|---|---|---|")
    for item in items:
        a = item.get("attributes", {})
        rels = item.get("relationships", {})
        city = resolve_rel((rels.get("field_city") or {}).get("data"), inc)
        autor = resolve_rel((rels.get("uid") or {}).get("data"), inc)
        w(f"| {fmt(a.get('title'))} | {fmt(a.get('field_average_rate'))} | {fmt(a.get('field_donation_count'))} | {fmt(a.get('field_donation_total'))} | {fmt(a.get('status'))} | {autor} | {city} |")

def render_all_subscriptions(data):
    items = data.get("data", [])
    if not items:
        w("> Sin suscripciones activas.\n"); return
    inc = extract_included(data)
    w("| Usuario | Plan | Ciclo | Precio | Inicio | Fin | Renovación |")
    w("|---|---|---|---|---|---|---|")
    for item in items:
        a = item.get("attributes", {})
        rels = item.get("relationships", {})
        user_id = (rels.get("field_user") or {}).get("data", {})
        plan_id = (rels.get("field_plan") or {}).get("data", {})
        plan_a = inc.get(plan_id.get("id", ""), {}) if plan_id else {}
        user_a = inc.get(user_id.get("id", ""), {}) if user_id else {}
        w(f"| {user_a.get('name','—')} | {fmt(plan_a.get('title'))} | {fmt(plan_a.get('field_billing_cycle'))} | {fmt(plan_a.get('field_price'))} € | {fmt(a.get('field_start_date',''))[:10]} | {fmt(a.get('field_end_date',''))[:10]} | {fmt(a.get('field_auto_renewal'))} |")

def render_professional_profiles(data):
    items = data.get("data", [])
    if not items:
        w("> Sin perfiles.\n"); return
    inc = extract_included(data)
    w("| Usuario | Email | Nombre legal | Tax ID | Revenue % |")
    w("|---|---|---|---|---|")
    for item in items:
        a = item.get("attributes", {})
        rels = item.get("relationships", {})
        user_id = (rels.get("field_user") or {}).get("data", {})
        user_a = inc.get(user_id.get("id", ""), {}) if user_id else {}
        w(f"| {user_a.get('name','—')} | {user_a.get('mail','—')} | {fmt(a.get('field_full_name'))} | {fmt(a.get('field_tax_id'))} | {fmt(a.get('field_revenue_percentage'))} % |")

def render_plans(data):
    items = data.get("data", [])
    if not items:
        w("> Sin planes.\n"); return
    w("| Plan | Tipo | Ciclo | Precio | Slots detalle | Slots steps | Idiomas | Por step | Activo |")
    w("|---|---|---|---|---|---|---|---|---|")
    for item in items:
        a = item.get("attributes", {})
        w(f"| {fmt(a.get('title'))} | {fmt(a.get('field_plan_type'))} | {fmt(a.get('field_billing_cycle'))} | {fmt(a.get('field_price'))} € | {fmt(a.get('field_max_featured_detail'))} | {fmt(a.get('field_max_featured_steps'))} | {fmt(a.get('field_max_languages'))} | {fmt(a.get('field_featured_per_step'))} | {fmt(a.get('status'))} |")

def render_businesses(data):
    items = data.get("data", [])
    if not items:
        w("> Sin negocios activos.\n"); return
    w("| Nombre | Estado | Web |")
    w("|---|---|---|")
    for item in items:
        a = item.get("attributes", {})
        web = a.get("field_website") or {}
        url_val = web.get("uri", "—") if isinstance(web, dict) else fmt(web)
        w(f"| {fmt(a.get('title'))} | {fmt(a.get('field_status'))} | {url_val} |")

# ══════════════════════════════════════════════════════════════════════════════
# REPORTE
# ══════════════════════════════════════════════════════════════════════════════

now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
h1("StepUp Tours — API Test Results")
w(f"> Generado el: `{now}`  ")
w(f"> Base URL: `{BASE}`\n")
w("## Índice\n")
w("1. [Endpoints públicos](#endpoints-públicos)")
w("2. [Usuario autenticado — john_traveler](#usuario-autenticado--john_traveler)")
w("3. [Usuario profesional — maria_guide](#usuario-profesional--maria_guide)")
w("4. [Administrador — admin](#administrador--admin)\n")

# BLOQUE 1: PÚBLICO
h2("Endpoints públicos")

section("01 — Homepage: todos los tours",
    f"{BASE}/jsonapi/node/tour?filter[status]=1&sort=-field_average_rate&page[limit]=20&page[offset]=0&fields[node--tour]=title,field_description,field_image,field_average_rate,field_duration,field_donation_count,field_city,field_country&include=field_city,field_country",
    None, render_tours)

section("02 — Homepage: tours por país (Spain)",
    f"{BASE}/jsonapi/node/tour?filter[status]=1&filter[field_country.name]=Spain&sort=-field_average_rate&page[limit]=20&fields[node--tour]=title,field_image,field_average_rate,field_duration,field_city&include=field_city",
    None, render_tours)

section("03 — Homepage: tours con rating >= 4",
    f"{BASE}/jsonapi/node/tour?filter[status]=1&filter[rate][condition][path]=field_average_rate&filter[rate][condition][operator]=>=&filter[rate][condition][value]=4&sort=-field_average_rate&page[limit]=20&fields[node--tour]=title,field_image,field_average_rate,field_duration,field_city&include=field_city",
    None, render_tours)

section("04 — Tour detail: Historic Madrid",
    f"{BASE}/jsonapi/node/tour/{TOUR_MADRID}?include=field_city,field_country,field_featured_business_1,field_featured_business_2,field_featured_business_3,uid",
    None, render_tour_detail)

# BLOQUE 2: AUTHENTICATED
h2("Usuario autenticado — john_traveler")

section("05 — Steps del tour Madrid",
    f"{BASE}/jsonapi/node/tour_step?filter[field_tour.id]={TOUR_MADRID}&sort=field_order&include=field_featured_business",
    "john_traveler", render_steps)

section("06 — Actividad en tour Madrid",
    f"{BASE}/jsonapi/node/tour_user_activity?filter[field_user.id]={USER_AUTH}&filter[field_tour.id]={TOUR_MADRID}&include=field_steps_completed",
    "john_traveler", render_activity)

section("07 — Perfil de john_traveler",
    f"{BASE}/jsonapi/user/user/{USER_AUTH}?fields[user--user]=name,field_public_name,mail,created,field_experience_points&include=field_country",
    "john_traveler", render_user_profile)

section("08 — Todos los tours (favoritos, guardados, completados)",
    f"{BASE}/jsonapi/node/tour_user_activity?filter[field_user.id]={USER_AUTH}&fields[node--tour_user_activity]=field_is_favorite,field_is_saved,field_is_completed,field_user_rating,field_completed_at,field_xp_awarded&include=field_tour,field_tour.field_city&fields[node--tour]=title,field_image,field_average_rate,field_duration,field_city",
    "john_traveler", render_user_tours)

section("09 — Donaciones realizadas",
    f"{BASE}/jsonapi/node/donation?filter[field_user.id]={USER_AUTH}&sort=-created&include=field_tour,field_currency&fields[node--donation]=field_amount,field_currency,field_guide_revenue,field_platform_revenue,created&fields[node--tour]=title",
    "john_traveler", render_donations)

# BLOQUE 3: PROFESSIONAL
h2("Usuario profesional — maria_guide")

section("05b — Steps del tour Madrid",
    f"{BASE}/jsonapi/node/tour_step?filter[field_tour.id]={TOUR_MADRID}&sort=field_order&include=field_featured_business",
    "maria_guide", render_steps)

section("10 — Perfil de facturación",
    f"{BASE}/jsonapi/node/professional_profile?filter[field_user.id]={USER_PRO}&fields[node--professional_profile]=field_full_name,field_tax_id,field_address,field_account_holder,field_revenue_percentage",
    "maria_guide", render_professional_profile)

section("11 — Suscripción activa",
    f"{BASE}/jsonapi/node/subscription?filter[field_user.id]={USER_PRO}&filter[field_subscription_status]=active&include=field_plan&fields[node--subscription]=field_subscription_status,field_start_date,field_end_date,field_auto_renewal,field_last_payment_at&fields[node--subscription_plan]=title,field_plan_type,field_price,field_billing_cycle,field_max_featured_detail,field_max_featured_steps,field_max_languages,field_featured_per_step",
    "maria_guide", render_subscription)

section("12 — Tours creados",
    f"{BASE}/jsonapi/node/tour?filter[uid.id]={USER_PRO}&sort=-created&include=field_city&fields[node--tour]=title,field_image,field_average_rate,field_duration,field_donation_count,field_donation_total,status,created,field_city",
    "maria_guide", render_my_tours)

section("13 — Donaciones recibidas en mis tours",
    f"{BASE}/jsonapi/node/donation?filter[field_tour.uid.id]={USER_PRO}&sort=-created&include=field_tour,field_currency&fields[node--donation]=field_amount,field_guide_revenue,field_platform_revenue,field_currency,created&fields[node--tour]=title",
    "maria_guide", render_donations)

# BLOQUE 4: ADMIN
h2("Administrador — admin")

section("05c — Steps del tour Madrid",
    f"{BASE}/jsonapi/node/tour_step?filter[field_tour.id]={TOUR_MADRID}&sort=field_order&include=field_featured_business",
    "admin", render_steps)

section("14 — Todos los tours del sistema",
    f"{BASE}/jsonapi/node/tour?sort=-created&page[limit]=50&include=field_city,uid&fields[node--tour]=title,field_average_rate,field_donation_count,field_donation_total,status,created,field_city&fields[user--user]=name,field_public_name",
    "admin", render_all_tours_admin)

section("15 — Todas las donaciones",
    f"{BASE}/jsonapi/node/donation?sort=-created&page[limit]=50&include=field_tour,field_user,field_currency&fields[node--donation]=field_amount,field_guide_revenue,field_platform_revenue,created&fields[node--tour]=title&fields[user--user]=name,field_public_name",
    "admin", render_donations)

section("16 — Todas las suscripciones activas",
    f"{BASE}/jsonapi/node/subscription?filter[field_subscription_status]=active&sort=-field_start_date&include=field_user,field_plan&fields[node--subscription]=field_subscription_status,field_start_date,field_end_date,field_auto_renewal,field_last_payment_at&fields[user--user]=name,field_public_name&fields[node--subscription_plan]=title,field_plan_type,field_price,field_billing_cycle",
    "admin", render_all_subscriptions)

section("17 — Todos los perfiles profesionales",
    f"{BASE}/jsonapi/node/professional_profile?sort=-created&include=field_user&fields[node--professional_profile]=field_full_name,field_tax_id,field_address,field_revenue_percentage,created&fields[user--user]=name,mail,field_public_name",
    "admin", render_professional_profiles)

section("18 — Planes de suscripción",
    f"{BASE}/jsonapi/node/subscription_plan?filter[status]=1&sort=field_price&fields[node--subscription_plan]=title,field_plan_type,field_billing_cycle,field_price,field_max_featured_detail,field_max_featured_steps,field_max_languages,field_featured_per_step,field_auto_renewal,status",
    "admin", render_plans)

section("19 — Negocios activos",
    f"{BASE}/jsonapi/node/business?filter[field_status]=active&sort=title&fields[node--business]=title,field_description,field_website,field_status&include=field_category",
    "admin", render_businesses)

# ── Escribir archivo ──────────────────────────────────────────────────────────
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"✅ Reporte generado: {OUTPUT_FILE}")
