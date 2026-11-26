/* Faux Supabase pour les essais : imite les routes d'authentification et la partie de PostgREST
   qu'utilise l'application, en exécutant le SQL sur une vraie base PostgreSQL (avec les vraies règles RLS).
   Usage : PGHOST=/tmp/pg node faux-supabase.js <port> <base> */
const http = require("http");
const { spawn } = require("child_process");
const crypto = require("crypto");

const PORT = Number(process.argv[2] || 54321);
const BASE = process.argv[3] || "ehr";
const CLE = "sb_publishable_essai";
const motsDePasse = new Map();     // email -> mot de passe
const jetons = new Map();          // jeton d'accès -> uid
const renouvellements = new Map(); // jeton de renouvellement -> uid
const journal = [];

function lit(s) { return s === null || s === undefined ? "null" : "'" + String(s).replace(/'/g, "''") + "'"; }

function psql(sql, uid) {
  const script = "\\set ON_ERROR_STOP 1\n\\set VERBOSITY verbose\nbegin;\n" +
    (uid ? "select set_config('request.jwt.claim.sub', " + lit(uid) + ", true) \\g /dev/null\nset local role authenticated;\n" : "") +
    sql + ";\ncommit;\n";
  return new Promise((ok) => {
    const p = spawn("psql", ["-X", "-A", "-t", "-q", "-d", BASE], { env: process.env });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      if (code === 0) return ok({ sortie: out.trim() });
      const m = /ERROR:\s+([0-9A-Z]{5}):\s+(.*)/.exec(err);
      ok({ erreur: { code: m ? m[1] : "XX000", message: m ? m[2].trim() : err.trim(), details: null, hint: null } });
    });
    p.stdin.end(script);
  });
}

/* Arbre logique PostgREST : or=(a.op.v,and(b.op.v,c.op.v)) -> SQL */
function logique(texte, joint) {
  const morceaux = [];
  let prof = 0, debut = 0, guill = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (c === '"') guill = !guill;
    else if (!guill && c === "(") prof++;
    else if (!guill && c === ")") prof--;
    else if (!guill && c === "," && prof === 0) { morceaux.push(texte.slice(debut, i)); debut = i + 1; }
  }
  morceaux.push(texte.slice(debut));
  return "(" + morceaux.map((m) => {
    const g = /^(and|or)\((.*)\)$/.exec(m);
    if (g) return logique(g[2], g[1]);
    return condition(m);
  }).join(" " + joint + " ") + ")";
}
const OPS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };
function condition(m) {
  const i = m.indexOf("."), j = m.indexOf(".", i + 1);
  const col = m.slice(0, i), op = m.slice(i + 1, j);
  let v = m.slice(j + 1);
  if (!/^[a-z_]+$/.test(col)) throw new Error("colonne " + col);
  if (op === "in") return col + " in (" + v.replace(/^\(|\)$/g, "").split(",").map((x) => lit(x.replace(/^"|"$/g, ""))).join(",") + ")";
  if (!OPS[op]) throw new Error("opérateur " + op);
  v = v.replace(/^"|"$/g, "");
  return col + " " + OPS[op] + " " + lit(v);
}
function filtres(params) {
  const conds = [];
  for (const [k, v] of params) {
    if (["select", "order", "limit", "on_conflict"].includes(k)) continue;
    if (k === "or") conds.push(logique(v.replace(/^\(|\)$/g, ""), "or"));
    else conds.push(condition(k + "." + v));
  }
  return conds.length ? " where " + conds.join(" and ") : "";
}
function colonnes(sel) {
  const l = (sel || "*").split(",");
  l.forEach((c) => { if (!/^([a-z_]+|\*)$/.test(c)) throw new Error("select " + c); });
  return l.join(",");
}
function ordre(o) {
  if (!o) return "";
  return " order by " + o.split(",").map((x) => { const [c, s] = x.split("."); if (!/^[a-z_]+$/.test(c)) throw new Error(c); return c + (s === "desc" ? " desc" : " asc"); }).join(",");
}

const SRF = [];
const VOID = [];
const TABLES = ["organisations", "organisations_codes", "profils", "diplomes", "offres", "candidatures", "employes", "conges"];

function session(uid, email) {
  const a = "acc-" + crypto.randomBytes(8).toString("hex"), r = "ref-" + crypto.randomBytes(8).toString("hex");
  jetons.set(a, uid); renouvellements.set(r, uid);
  return { access_token: a, token_type: "bearer", expires_in: 3600, refresh_token: r, user: { id: uid, email } };
}

async function traiter(meth, url, corps, entetes) {
  const p = url.searchParams, chemin = url.pathname;
  if (entetes.apikey !== CLE) return [401, { message: "No API key found in request" }];

  /* ----- Authentification (imitation de GoTrue, confirmation par e-mail désactivée) ----- */
  if (chemin === "/auth/v1/signup") {
    if (motsDePasse.has(corps.email)) return [422, { code: 422, error_code: "user_already_exists", msg: "User already registered" }];
    if (!corps.password || corps.password.length < 8) return [422, { code: 422, error_code: "weak_password", msg: "Password should be at least 8 characters." }];
    const r = await psql("insert into auth.users (email, raw_user_meta_data) values (" + lit(corps.email) + ", " + lit(JSON.stringify(corps.data || {})) + "::jsonb) returning id");
    if (r.erreur) return [500, r.erreur];
    motsDePasse.set(corps.email, corps.password);
    return [200, session(r.sortie, corps.email)];
  }
  if (chemin === "/auth/v1/token" && p.get("grant_type") === "password") {
    if (motsDePasse.get(corps.email) !== corps.password) return [400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }];
    const r = await psql("select id from auth.users where email = " + lit(corps.email));
    return [200, session(r.sortie, corps.email)];
  }
  if (chemin === "/auth/v1/token" && p.get("grant_type") === "refresh_token") {
    const uid = renouvellements.get(corps.refresh_token);
    if (!uid) return [400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }];
    renouvellements.delete(corps.refresh_token);
    return [200, session(uid, "")];
  }
  if (chemin === "/auth/v1/logout") return [204];
  if (chemin === "/auth/v1/recover") return [200, {}];

  const jeton = (entetes.authorization || "").replace(/^Bearer /, "");
  const uid = jetons.get(jeton);
  if (chemin === "/auth/v1/user" && meth === "PUT") {
    if (!uid) return [401, { msg: "invalid JWT" }];
    const r = await psql("select email from auth.users where id = " + lit(uid));
    motsDePasse.set(r.sortie, corps.password);
    return [200, { id: uid }];
  }
  if (!chemin.startsWith("/rest/v1/")) return [404, { message: "route inconnue" }];
  if (jeton && !uid) return [401, { code: "PGRST301", message: "JWT expired" }];

  /* ----- PostgREST ----- */
  let sql;
  const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(chemin);
  if (m) {
    const args = Object.entries(corps || {}).map(([k, v]) => k + " => " + (typeof v === "boolean" ? String(v) : lit(v))).join(", ");
    if (SRF.includes(m[1])) sql = "select coalesce(json_agg(t), '[]') from " + m[1] + "(" + args + ") t";
    else if (VOID.includes(m[1])) sql = "select " + m[1] + "(" + args + ") \\g /dev/null\nselect ''";
    else sql = "select to_json(" + m[1] + "(" + args + "))";
  } else {
    const table = chemin.slice(9);
    if (!TABLES.includes(table)) return [404, { message: "table" }];
    const sel = colonnes(p.get("select"));
    if (meth === "GET") {
      sql = "select coalesce(json_agg(t), '[]') from (select " + sel + " from " + table + filtres(p) + ordre(p.get("order")) + (p.get("limit") ? " limit " + Number(p.get("limit")) : "") + ") t";
    } else if (meth === "PATCH") {
      const cles = Object.keys(corps);
      sql = "with u as (update " + table + " set (" + cles.join(",") + ") = (select " + cles.join(",") + " from jsonb_populate_record(null::" + table + ", " + lit(JSON.stringify(corps)) + "::jsonb))" + filtres(p) + " returning " + sel + ") select coalesce(json_agg(u), '[]') from u";
    } else if (meth === "POST") {
      const lignes = Array.isArray(corps) ? corps : [corps];
      const cles = Object.keys(lignes[0]);
      let conflit = "";
      if (p.get("on_conflict")) conflit = " on conflict (" + p.get("on_conflict") + ") do update set " + cles.map((c) => c + " = excluded." + c).join(", ");
      sql = "with i as (insert into " + table + " (" + cles.join(",") + ") select " + cles.join(",") + " from jsonb_populate_recordset(null::" + table + ", " + lit(JSON.stringify(lignes)) + "::jsonb)" + conflit + " returning " + sel + ") select coalesce(json_agg(i), '[]') from i";
    } else if (meth === "DELETE") {
      sql = "with d as (delete from " + table + filtres(p) + " returning 1) select ''";
    } else return [405, { message: "méthode" }];
  }
  const r = await psql(sql, uid);
  if (r.erreur) {
    const statut = r.erreur.code === "42501" ? (uid ? 403 : 401) : r.erreur.code.startsWith("23") ? 409 : 400;
    return [statut, r.erreur];
  }
  if (meth === "POST" && !m && !/return=representation/.test(entetes.prefer || "")) return [201];
  if ((m && VOID.includes(m[1])) || (!m && meth === "DELETE")) return [204];
  return [200, JSON.parse(r.sortie || "null")];
}

http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "apikey, authorization, content-type, prefer", "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  let b = "";
  req.on("data", (d) => (b += d));
  req.on("end", async () => {
    const url = new URL(req.url, "http://localhost");
    let reponse;
    try { reponse = await traiter(req.method, url, b ? JSON.parse(b) : undefined, req.headers); }
    catch (e) { reponse = [400, { message: "faux serveur : " + e.message }]; }
    journal.push(req.method + " " + url.pathname + " -> " + reponse[0]);
    res.writeHead(reponse[0], { ...cors, "Content-Type": "application/json" });
    res.end(reponse[1] === undefined ? "" : JSON.stringify(reponse[1]));
  });
}).listen(PORT, () => console.log("faux Supabase prêt sur " + PORT));
process.on("SIGTERM", () => { console.log(journal.join("\n")); process.exit(0); });
