#!/bin/sh
# Essai complet dans un navigateur contre une vraie base PostgreSQL (supabase/schema.sql + règles RLS).
# Prérequis : PostgreSQL (psql) et Playwright avec Chromium.  Usage : sh tests/lancer.sh
set -e
ICI="$(cd "$(dirname "$0")" && pwd)"; RACINE="$ICI/.."
export PGUSER="${PGUSER:-postgres}"
TMP="$(mktemp -d)"
psql -q -d postgres -c "drop database if exists ehr_e2e" -c "create database ehr_e2e" >/dev/null 2>&1
psql -q -d ehr_e2e -v ON_ERROR_STOP=1 -f "$RACINE/supabase/tests/supabase_simule.sql" >/dev/null
psql -q -d ehr_e2e -v ON_ERROR_STOP=1 -f "$RACINE/supabase/schema.sql" >/dev/null
mkdir "$TMP/site"; cp -r "$RACINE/index.html" "$RACINE/style.css" "$RACINE/sb.js" "$RACINE/app.js" "$RACINE/assets" "$TMP/site/"
printf 'window.EHR_CONFIG = { url: "http://localhost:54322", cle: "sb_publishable_essai" };\n' > "$TMP/site/config.js"
node "$ICI/faux-supabase.js" 54322 ehr_e2e > "$TMP/serveur.log" 2>&1 & SERVEUR=$!
(cd "$TMP/site" && python3 -m http.server 8767 >/dev/null 2>&1) & SITE=$!
trap 'kill $SERVEUR $SITE 2>/dev/null' EXIT
sleep 1
IMAGES="${IMAGES:-$TMP/captures}" node "$ICI/parcours.js" | tee "$TMP/resultat.txt"
grep -q "TOUT EST OK" "$TMP/resultat.txt"
