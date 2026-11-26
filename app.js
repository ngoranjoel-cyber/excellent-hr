/* Excellent HR — application connectée (comptes réels, base Supabase partagée).
   Trois types de comptes : candidat, entreprise (recrutement + RH), école.
   Toute personne reliée à une fiche salarié voit aussi l'espace « Mes congés ». */
"use strict";

/* ============ Outils ============ */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fr = (d) => { if (!d) return "—"; const [y, m, j] = String(d).slice(0, 10).split("-"); return `${j}/${m}/${y}`; };
const joursAvant = (d) => Math.ceil((new Date(d + "T12:00") - new Date()) / 864e5);
const nomComplet = (p) => p ? (`${p.prenoms || ""} ${p.nom || ""}`).trim() || "Sans nom" : "—";
const initiales = (t) => String(t || "?").split(/\s+/).filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
const inListe = (ids) => "in.(" + ids.map((x) => `"${x}"`).join(",") + ")";
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200); }
function modal(html) { closeModal(); const m = document.createElement("div"); m.className = "modal-bg"; m.innerHTML = `<div class="modal">${html}</div>`; m.onclick = (e) => { if (e.target === m) m.remove(); }; document.body.appendChild(m); return m; }
function closeModal() { document.querySelector(".modal-bg")?.remove(); }
function occupe(bouton, promesse, ok) {
  if (bouton) { bouton.disabled = true; bouton.dataset.t = bouton.textContent; bouton.textContent = "Patientez…"; }
  return promesse.then((r) => { if (ok) toast(ok); return r; })
    .catch((e) => { toast(e.message || "Une erreur est survenue."); if (e.code === "session") { ME = null; go("connexion"); } throw e; })
    .finally(() => { if (bouton && document.body.contains(bouton)) { bouton.disabled = false; bouton.textContent = bouton.dataset.t; } });
}
const valeur = (id) => ($("#" + id)?.value || "").trim();

/* Jours fériés fixes en Côte d'Ivoire (le serveur applique la même règle) */
const FERIES = ["01-01", "05-01", "08-07", "08-15", "11-01", "11-15", "12-25"];
const estFerie = (d) => FERIES.includes(d.toISOString().slice(5, 10));
function joursOuvres(du, au) { let n = 0; const d = new Date(du + "T12:00"), f = new Date(au + "T12:00"); while (d <= f) { const w = d.getDay(); if (w !== 0 && w !== 6 && !estFerie(d)) n++; d.setDate(d.getDate() + 1); } return n; }

/* ============ Session et profil ============ */
let ME = null; // { id, email, profil, org, code, employes: [] }
async function chargerMoi() {
  const u = SB.utilisateur();
  if (!u) { ME = null; return; }
  const [p] = await SB.lire("profils", "id=eq." + u.id);
  if (!p) { ME = null; SB.deconnecter(); return; }
  ME = { id: u.id, email: u.email, profil: p, org: null, code: "", employes: [] };
  const taches = [SB.lire("employes", "user_id=eq." + u.id).then((l) => (ME.employes = l))];
  if (p.org_id) {
    taches.push(SB.lire("organisations", "id=eq." + p.org_id).then((l) => (ME.org = l[0] || null)));
    taches.push(SB.lire("organisations_codes", "org_id=eq." + p.org_id).then((l) => (ME.code = l[0]?.code || "")));
  }
  await Promise.all(taches);
}
const TYPES = { candidat: "Diplômé(e) ou étudiant(e)", entreprise: "Entreprise", ecole: "École ou université" };

/* Icônes (traits simples, 24×24) */
const IC = {
  maison: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  tdb: '<circle cx="12" cy="12" r="9"/><path d="M12 12l4-4"/><path d="M12 7v1M7 12h1M16 12h1"/>',
  offres: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  candidats: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c.7-3.6 3.3-5.5 6.5-5.5s5.8 1.9 6.5 5.5"/><path d="M18 8v6M15 11h6"/>',
  personnel: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><path d="M14 15.5c.8-.9 1.8-1.4 3-1.4 2.3 0 4 1.6 4.5 4.4"/>',
  conges: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/>',
  ecole: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/>',
  profil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5"/>',
  entretien: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  orga: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M10 21v-4h4v4"/>',
  connexion: '<path d="M14 4h5v16h-5"/><path d="M3 12h11M10 8l4 4-4 4"/>',
  loupe: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  oeil: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  points: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  sms: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',
  croix: '<path d="M6 6l12 12M18 6L6 18"/>',
  coche: '<path d="M5 12l5 5 9-10"/>',
  bas: '<path d="M6 9l6 6 6-6"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  idee: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  fusee: '<path d="M14 4c3 0 6 3 6 6-2 4-6 7-8 8l-6-6c1-2 4-6 8-8z"/><circle cx="14.5" cy="9.5" r="1.5"/><path d="M6 12l-3 1 3 3M12 18l-1 3-3-3"/>',
  lecture: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/>',
  grille: '<path d="M5 5h2v2H5zM11 5h2v2h-2zM17 5h2v2h-2zM5 11h2v2H5zM11 11h2v2h-2zM17 11h2v2h-2zM5 17h2v2H5zM11 17h2v2h-2zM17 17h2v2h-2z"/>'
};
const ico = (n, t = 20) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;
/* Carré de score coloré (bleu ≥ 75, orange ≥ 60, jaune en dessous, gris sans score) */
const carre = (s) => `<div class="carre ${s == null ? "c-gris" : s >= 75 ? "c-bleu" : s >= 60 ? "c-orange" : "c-jaune"}">${s == null ? "…" : s}</div>`;
const tuile = (v, l, icone) => `<div class="card tuile">${icone ? `<span class="ic">${ico(icone, 18)}</span>` : ""}<div class="v">${v}</div><div class="l">${l}</div></div>`;
/* Anneau (donut) en SVG */
function donut(val, max, texte, couleur) {
  const r = 52, c = 2 * Math.PI * r, p = max ? Math.max(0, Math.min(1, val / max)) : 0;
  return `<svg width="140" height="140" viewBox="0 0 140 140"><circle cx="70" cy="70" r="${r}" fill="none" stroke="#EEF0F5" stroke-width="13"/><circle cx="70" cy="70" r="${r}" fill="none" stroke="${couleur || "var(--green)"}" stroke-width="13" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 70 70)"/><text x="70" y="79" text-anchor="middle" font-size="28" font-weight="800" fill="var(--nuit)">${texte}</text></svg>`;
}
/* Radar (toile d'araignée) des critères, valeurs sur 100 */
function radar(vals, noms) {
  const n = vals.length, cx = 180, cy = 120, R = 80, pt = (i, k) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k]; };
  let s = `<svg viewBox="0 0 360 245" width="100%" style="max-width:380px">`;
  [0.25, 0.5, 0.75, 1].forEach((k) => { s += `<polygon points="${vals.map((_, i) => pt(i, k).join(",")).join(" ")}" fill="none" stroke="#DDE2EC"/>`; });
  vals.forEach((_, i) => { const [x, y] = pt(i, 1); s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#DDE2EC"/>`; const [lx, ly] = pt(i, 1.22); s += `<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${esc(noms[i])}</text>`; });
  s += `<polygon points="${vals.map((v, i) => pt(i, Math.max(0.04, v / 100)).join(",")).join(" ")}" fill="rgba(14,26,68,.72)" stroke="var(--nuit)" stroke-width="1.5"/>`;
  const moy = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  s += `<rect x="${cx - 26}" y="${cy - 15}" width="52" height="30" rx="7" fill="#fff" stroke="#DDE2EC"/><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="16" font-weight="800" fill="var(--nuit)">${moy}</text>`;
  return s + "</svg>";
}
function salut() { const h = new Date().getHours(); return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir"; }
function bandeau(titre, sous, action) {
  const ref = "EHR-" + String(ME.id || "").replace(/[^0-9a-f]/gi, "").slice(0, 6).toUpperCase();
  const jour = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `<section class="chemise"><div class="chemise-onglet">${sous}</div><div class="chemise-corps"><div class="photo-id">${esc(initiales(nomComplet(ME.profil)))}</div><div class="sp"><p class="ref">Dossier n° ${ref} · ${jour}</p><h1>${esc(nomComplet(ME.profil))}</h1></div>${action ? `<div class="chemise-act">${action}</div>` : ""}</div></section>`;
}
function menuAct(el) { const m = el.closest(".menu-act"), ouvert = m.classList.contains("ouvert"); document.querySelectorAll(".menu-act.ouvert").forEach((x) => x.classList.remove("ouvert")); if (!ouvert) m.classList.add("ouvert"); }
document.addEventListener("click", (e) => { if (!e.target.closest(".menu-act")) document.querySelectorAll(".menu-act.ouvert").forEach((x) => x.classList.remove("ouvert")); });

/* ============ Navigation ============ */
function pages() {
  if (!ME) return [["accueil", "Accueil", "maison"], ["connexion", "Se connecter", "connexion"]];
  const t = ME.profil.type, l = [];
  if (t === "candidat") l.push(["candidat", "Mon espace", "maison"], ["entretien", "Entretien IA", "entretien"]);
  if (t === "entreprise") l.push(...(ME.org ? [["tableau", "Tableau de bord", "tdb"], ["offres", "Offres", "offres"], ["recruteur", "Candidatures", "candidats"], ["rh", "Personnel", "personnel"]] : [["organisation", "Mon entreprise", "orga"]]));
  if (t === "ecole") l.push(ME.org ? ["ecole", "Insertion", "ecole"] : ["organisation", "Mon école", "orga"]);
  if (ME.employes.length) l.push(["employe", "Mes congés", "conges"]);
  l.push(["profil", "Profil", "profil"]);
  return l;
}
const CACHEES = { fiche: "rh" }; /* pages sans bouton : la page parente reste allumée */
function pageDepart() { return pages()[0][0]; }
let page = "accueil", rendu = 0, recherche = "";
function go(p) { page = p; try { history.replaceState(null, "", "#" + p); } catch (e) { } render(); window.scrollTo(0, 0); }
function chercher(e) {
  if (e.key !== "Enter" || !ME) return;
  recherche = e.target.value.trim();
  const t = ME.profil.type;
  if (t === "candidat") { filtre.q = recherche; go("candidat"); }
  else if (t === "entreprise" && ME.org) { filtreRecr.q = recherche; filtreRH = recherche; go(page === "rh" || page === "fiche" ? "rh" : "recruteur"); }
  else if (t === "ecole" && ME.org) { filtreEcole = recherche; go("ecole"); }
}
async function render() {
  const liste = pages();
  const parent = CACHEES[page];
  if (!liste.some(([k]) => k === page) && !(parent && liste.some(([k]) => k === parent))) page = liste[0][0];
  const actif = parent || page;
  document.body.classList.toggle("public", !ME);
  $("#nav").innerHTML = ME ? liste.map(([k, l, i], idx) => `${idx === liste.length - 1 ? '<span class="sep"></span>' : ""}<button class="${k === actif ? "on" : ""}" onclick="go('${k}')" title="${l}">${ico(i, 22)}<span>${l}</span></button>`).join("") : "";
  $("#qui").innerHTML = ME
    ? `<span class="avatar sm" title="${esc(ME.email || "")}" onclick="go('profil')">${esc(initiales(nomComplet(ME.profil)))}</span>`
    : `<button class="btn ghost sm" onclick="go('accueil')">Accueil</button><button class="btn bleu sm" onclick="modeAuth='connexion';go('connexion')">Se connecter</button>`;
  const ch = $("#recherche");
  if (ch) { ch.disabled = !ME; ch.placeholder = !ME ? "Connectez-vous pour rechercher" : ME.profil.type === "candidat" ? "Rechercher une offre, une entreprise…" : ME.profil.type === "ecole" ? "Rechercher un diplômé par nom" : "Rechercher un candidat ou un collègue par nom"; }
  const n = ++rendu;
  $("#app").innerHTML = `<p class="muted">Chargement…</p>`;
  let html;
  try { html = await VIEWS[page](); }
  catch (e) {
    if (e.code === "session") { ME = null; html = await VIEWS.connexion(); page = "connexion"; }
    else html = `<div class="alert red"><b>Impossible d'afficher cette page.</b><div class="small">${esc(e.message)}</div><button class="btn sm" style="margin-top:10px" onclick="render()">Réessayer</button></div>`;
  }
  if (n === rendu) $("#app").innerHTML = html;
}

/* ============ Écrans ============ */
const VIEWS = {};

/* ---- Accueil public ---- */
VIEWS.accueil = async () => `
<section class="hero">
  <div>
    <span class="pill p-gold">Recrutement + gestion RH</span>
    <h1 style="margin-top:12px">Les bons talents, au bon poste, avec une décision humaine.</h1>
    <p class="sub" style="font-size:17px">Excellent HR relie les diplômés, les écoles et les entreprises : diplômes vérifiés, entretien assisté par l'IA, puis gestion du personnel dans le même outil.</p>
    <div class="row">
      <button class="btn" onclick="inscrireComme('candidat')">Je cherche un emploi</button>
      <button class="btn gold" onclick="inscrireComme('entreprise')">Je recrute</button>
      <button class="btn ghost" onclick="inscrireComme('ecole')">Je représente une école</button>
    </div>
    <p class="small muted" style="margin-top:12px">Déjà inscrit(e) ? <a href="#" onclick="go('connexion');return false">Se connecter</a></p>
  </div>
  <img src="assets/logo.png" alt="Excellent HR">
</section>
<div class="grid g3" style="margin-top:22px">
  <div class="card space"><h3>Diplômés &amp; étudiants</h3><p class="muted">Profil avec diplôme vérifié par votre école, offres d'emploi et de stage, entretien IA, suivi des candidatures. <b>Gratuit.</b></p></div>
  <div class="card space s2"><h3>Écoles &amp; universités</h3><p class="muted">Validation des diplômes déclarés par vos anciens élèves et suivi de leur insertion.</p></div>
  <div class="card space s3"><h3>Entreprises</h3><p class="muted">Offres, présélection par score, short-list à valider, puis dossiers du personnel, contrats et congés.</p></div>
</div>
<div class="alert navy" style="margin-top:22px"><b>L'IA recommande, l'humain décide.</b> Aucun candidat n'est rejeté automatiquement, et aucun critère lié au sexe, à l'âge, à l'origine, à la religion, à l'apparence ou à l'accent n'est utilisé.</div>`;

/* ---- Connexion / inscription ---- */
let modeAuth = "connexion", typeChoisi = "candidat";
function inscrireComme(t) { typeChoisi = t; modeAuth = "inscription"; go("connexion"); }
VIEWS.connexion = async () => {
  if (!SB.configure()) return `<div class="alert red"><b>Application pas encore reliée à la base de données.</b><div class="small">Remplissez le fichier <code>config.js</code> avec l'adresse et la clé publique de votre projet Supabase (voir README).</div></div>`;
  const ins = modeAuth === "inscription";
  return `<div class="phone"><div class="card">
  <div class="onglets"><button class="${!ins ? "on" : ""}" onclick="modeAuth='connexion';render()">Se connecter</button><button class="${ins ? "on" : ""}" onclick="modeAuth='inscription';render()">Créer un compte</button></div>
  ${ins ? `
   <label>Je suis</label>
   <div class="choix-type">${Object.entries(TYPES).map(([k, l]) => `<button type="button" class="${k === typeChoisi ? "on" : ""}" onclick="typeChoisi='${k}';render()">${l}</button>`).join("")}</div>
   <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
    <div><label for="f-prenoms">Prénoms</label><input type="text" id="f-prenoms" autocomplete="given-name"></div>
    <div><label for="f-nom">Nom</label><input type="text" id="f-nom" autocomplete="family-name"></div>
   </div>
   <label for="f-tel" style="margin-top:10px">Téléphone</label><input type="tel" id="f-tel" autocomplete="tel" placeholder="07 00 00 00 00">` : ""}
  <label for="f-email" style="margin-top:10px">E-mail</label><input type="email" id="f-email" autocomplete="email">
  <label for="f-mdp" style="margin-top:10px">Mot de passe${ins ? " (8 caractères au moins)" : ""}</label><input type="password" id="f-mdp" autocomplete="${ins ? "new-password" : "current-password"}">
  ${ins ? `<label style="margin-top:12px;display:flex;gap:8px;align-items:flex-start;color:var(--ink);font-weight:500"><input type="checkbox" id="f-ok" style="margin-top:4px"> J'accepte que mes informations soient enregistrées par Excellent HR et partagées uniquement avec les entreprises à qui je postule, l'école où j'ai déclaré un diplôme et mon employeur.</label>` : ""}
  <button class="btn" style="width:100%;margin-top:14px" onclick="${ins ? "inscription(this)" : "connexion(this)"}">${ins ? "Créer mon compte" : "Se connecter"}</button>
  ${!ins ? `<p class="small" style="text-align:center;margin-top:12px"><a href="#" onclick="motDePasseOublie();return false">Mot de passe oublié ?</a></p>` : ""}
  <p class="small muted" id="msgAuth" style="margin-top:10px"></p>
 </div></div>`;
};
async function connexion(b) {
  const email = valeur("f-email"), mdp = $("#f-mdp").value;
  if (!email || !mdp) return toast("Saisissez votre e-mail et votre mot de passe.");
  await occupe(b, SB.connecter(email, mdp));
  await chargerMoi(); toast("Bienvenue " + (ME?.profil.prenoms || "")); go(pageDepart());
}
async function inscription(b) {
  const d = { type: typeChoisi, prenoms: valeur("f-prenoms"), nom: valeur("f-nom"), telephone: valeur("f-tel") };
  const email = valeur("f-email"), mdp = $("#f-mdp").value;
  if (!d.prenoms || !d.nom) return toast("Indiquez vos prénoms et votre nom.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Adresse e-mail invalide.");
  if (mdp.length < 8) return toast("Mot de passe trop court : au moins 8 caractères.");
  if (!$("#f-ok").checked) return toast("Merci de cocher la case d'accord.");
  const r = await occupe(b, SB.inscrire(email, mdp, d));
  if (!r.session) { $("#msgAuth").innerHTML = "<b>Compte créé.</b> Ouvrez le lien reçu par e-mail pour confirmer votre adresse, puis connectez-vous."; modeAuth = "connexion"; return; }
  modeAuth = "connexion"; await chargerMoi(); toast("Compte créé. Bienvenue !"); go(pageDepart());
}
function motDePasseOublie() {
  const email = valeur("f-email");
  if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Saisissez d'abord votre e-mail dans le champ.");
  occupe(null, SB.oublie(email), "Si un compte existe, un lien de réinitialisation vient d'être envoyé.").catch(() => { });
}

/* ---- Profil ---- */
VIEWS.profil = async () => {
  const p = ME.profil, cand = p.type === "candidat";
  return `<h1>Mon profil</h1><p class="sub">${esc(TYPES[p.type])} · ${esc(ME.email || "")}</p>
<div class="grid g2">
 <div class="card"><h3>Mes informations</h3>
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
   <div><label for="p-prenoms">Prénoms</label><input type="text" id="p-prenoms" value="${esc(p.prenoms)}"></div>
   <div><label for="p-nom">Nom</label><input type="text" id="p-nom" value="${esc(p.nom)}"></div>
   <div><label for="p-tel">Téléphone</label><input type="tel" id="p-tel" value="${esc(p.telephone)}"></div>
   <div><label for="p-ville">Ville</label><input type="text" id="p-ville" value="${esc(p.ville)}"></div>
  </div>
  ${cand ? `<label for="p-formation" style="margin-top:10px">Formation (diplôme, école)</label><input type="text" id="p-formation" value="${esc(p.formation)}" placeholder="Master Génie pétrolier — INP-HB">` : ""}
  <button class="btn" style="margin-top:14px" onclick="enregistrerProfil(this)">Enregistrer</button>
 </div>
 <div>
  ${ME.org ? `<div class="card"><h3>${p.type === "ecole" ? "Mon école" : "Mon entreprise"}</h3><p><b>${esc(ME.org.nom)}</b><br><span class="muted small">${esc([ME.org.ville, ME.org.secteur].filter(Boolean).join(" · "))}</span></p>
   <div class="alert gold small">Code pour vos collègues : <b class="code">${esc(ME.code)}</b><br>Ils créent un compte « ${esc(TYPES[p.type])} » puis saisissent ce code.</div></div>` : ""}
  <div class="card" style="margin-top:${ME.org ? 14 : 0}px"><h3>Je suis salarié(e)</h3><p class="small muted">Votre service RH utilise Excellent HR ? Saisissez le code qu'il vous a remis pour accéder à vos congés.</p>
   <div class="row"><input type="text" id="p-code" placeholder="Code (8 caractères)" style="flex:1;text-transform:uppercase"><button class="btn" onclick="lierEmploye(this)">Relier</button></div></div>
  <div class="card" style="margin-top:14px"><h3>Compte</h3>
   <label for="p-mdp">Nouveau mot de passe</label><div class="row"><input type="password" id="p-mdp" autocomplete="new-password" style="flex:1"><button class="btn ghost" onclick="changerMdp(this)">Changer</button></div>
   <div class="row" style="margin-top:16px"><button class="btn ghost" onclick="deconnexion()">Se déconnecter</button><span class="sp"></span><button class="btn red sm" onclick="supprimerCompte()">Supprimer mon compte</button></div></div>
 </div>
</div>`;
};
async function enregistrerProfil(b) {
  const v = { prenoms: valeur("p-prenoms"), nom: valeur("p-nom"), telephone: valeur("p-tel"), ville: valeur("p-ville") };
  if (ME.profil.type === "candidat") v.formation = valeur("p-formation");
  const [p] = await occupe(b, SB.modifier("profils", "id=eq." + ME.id, v), "Profil enregistré");
  if (p) ME.profil = p; render();
}
async function lierEmploye(b) {
  const c = valeur("p-code"); if (!c) return toast("Saisissez le code.");
  await occupe(b, SB.rpc("lier_employe", { p_code: c }), "Compte relié à votre fiche salarié");
  await chargerMoi(); go("employe");
}
async function changerMdp(b) { const m = $("#p-mdp").value; if (m.length < 8) return toast("Au moins 8 caractères."); await occupe(b, SB.nouveauMotDePasse(m), "Mot de passe changé"); $("#p-mdp").value = ""; }
function deconnexion() { SB.deconnecter(); ME = null; modeAuth = "connexion"; toast("Vous êtes déconnecté(e)"); go("accueil"); }
function supprimerCompte() {
  modal(`<h2>Supprimer votre compte ?</h2><p>Votre profil, vos diplômes déclarés, vos candidatures et vos demandes de congé seront effacés définitivement. Cette action ne peut pas être annulée.</p>
  <label for="conf-sup">Tapez SUPPRIMER pour confirmer</label><input type="text" id="conf-sup">
  <div class="row" style="margin-top:14px"><span class="sp"></span><button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn red" onclick="if(valeur('conf-sup')==='SUPPRIMER')confirmerSuppression(this);else toast('Tapez SUPPRIMER')">Supprimer</button></div>`);
}
async function confirmerSuppression(b) { await occupe(b, SB.rpc("supprimer_mon_compte")); SB.deconnecter(); ME = null; closeModal(); toast("Compte supprimé"); go("accueil"); }

/* ---- Créer ou rejoindre son entreprise / école ---- */
VIEWS.organisation = async () => {
  const e = ME.profil.type === "entreprise", quoi = e ? "votre entreprise" : "votre école";
  return `<h1>${e ? "Mon entreprise" : "Mon école"}</h1><p class="sub">Dernière étape : reliez votre compte à ${quoi}.</p>
<div class="grid g2">
 <div class="card"><h3>Créer ${quoi}</h3><p class="small muted">Vous êtes la première personne de ${quoi} sur Excellent HR.</p>
  <label for="o-nom">Nom</label><input type="text" id="o-nom" placeholder="${e ? "Lagune Énergie" : "INP-HB"}">
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
   <div><label for="o-ville">Ville</label><input type="text" id="o-ville"></div>
   <div><label for="o-secteur">${e ? "Secteur" : "Type d'établissement"}</label><input type="text" id="o-secteur" placeholder="${e ? "Énergie" : "Grande école"}"></div>
  </div>
  <button class="btn" style="margin-top:14px" onclick="creerOrg(this)">Créer</button></div>
 <div class="card"><h3>Rejoindre ${quoi}</h3><p class="small muted">Un(e) collègue l'a déjà inscrite : demandez-lui le code (dans son Profil).</p>
  <label for="o-code">Code</label><input type="text" id="o-code" style="text-transform:uppercase" placeholder="ABC123">
  <button class="btn gold" style="margin-top:14px" onclick="rejoindreOrg(this)">Rejoindre</button></div>
</div>`;
};
async function creerOrg(b) {
  if (valeur("o-nom").length < 2) return toast("Indiquez le nom.");
  const r = await occupe(b, SB.rpc("creer_organisation", { p_nom: valeur("o-nom"), p_ville: valeur("o-ville"), p_secteur: valeur("o-secteur") }));
  await chargerMoi(); toast("Créé. Code pour vos collègues : " + r.code); go(pageDepart());
}
async function rejoindreOrg(b) { if (!valeur("o-code")) return toast("Saisissez le code."); await occupe(b, SB.rpc("rejoindre_organisation", { p_code: valeur("o-code") }), "Bienvenue dans l'équipe"); await chargerMoi(); go(pageDepart()); }

/* ---- Espace candidat ---- */
let filtre = { q: "", type: "", ville: "" }, CAND = null;
const STATUTS = { "Entretien IA à passer": "p-gold", "Entretien IA passé": "p-navy", "Présélectionné(e)": "p-green", "Retenu(e)": "p-green", "Non retenu(e)": "p-red" };
/* Compatibilité estimée (simple, transparente) : ville et mots communs entre la formation et l'offre. */
function compat(o) {
  const p = ME.profil, mots = (t) => new Set(String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((m) => m.length > 3));
  const f = mots(p.formation + " " + (CAND?.diplomes || []).map((d) => d.intitule + " " + d.filiere).join(" ")), t = mots(o.titre + " " + o.secteur + " " + o.description);
  let s = 50, communs = 0; f.forEach((m) => { if (t.has(m)) communs++; });
  if (p.ville && o.ville && p.ville.toLowerCase() === o.ville.toLowerCase()) s += 15;
  return Math.min(98, s + Math.min(33, communs * 11));
}
async function chargerCandidat() {
  const [diplomes, candidatures, offres, ecoles] = await Promise.all([
    SB.lire("diplomes", "user_id=eq." + ME.id + "&order=cree_le.asc"),
    SB.lire("candidatures", "user_id=eq." + ME.id + "&order=cree_le.desc"),
    SB.lire("offres", "statut=eq.ouverte&order=cree_le.desc"),
    SB.lire("organisations", "type=eq.ecole&order=nom.asc")]);
  const ids = [...new Set([...offres.map((o) => o.org_id)])];
  const manquantes = candidatures.map((c) => c.offre_id).filter((id) => !offres.some((o) => o.id === id));
  const autres = manquantes.length ? await SB.lire("offres", "id=" + inListe(manquantes)) : [];
  const toutes = [...offres, ...autres];
  const orgIds = [...new Set(toutes.map((o) => o.org_id))];
  const orgs = orgIds.length ? await SB.lire("organisations", "id=" + inListe(orgIds)) : [];
  CAND = { diplomes, candidatures, offres, toutes, ecoles, orgs: Object.fromEntries(orgs.map((o) => [o.id, o])) };
  void ids;
}
const nomOrg = (id) => CAND?.orgs[id]?.nom || "Entreprise";
VIEWS.candidat = async () => {
  await chargerCandidat();
  const p = ME.profil, verifie = CAND.diplomes.some((d) => d.statut === "valide");
  const champs = [p.prenoms, p.nom, p.telephone, p.ville, p.formation, CAND.diplomes.length ? "x" : ""];
  const compl = Math.round(champs.filter(Boolean).length / champs.length * 100);
  const aFaire = CAND.candidatures.filter((x) => x.statut === "Entretien IA à passer");
  const presel = CAND.candidatures.filter((x) => ["Présélectionné(e)", "Retenu(e)"].includes(x.statut)).length;
  const villes = [...new Set(CAND.offres.map((o) => o.ville).filter(Boolean))];
  return bandeau("", "Espace Diplômés &amp; étudiants" + (p.ville ? " · " + esc(p.ville) : ""), verifie ? '<span class="pill p-green">Diplôme vérifié</span>' : CAND.diplomes.length ? '<span class="pill p-gray">Diplôme en attente</span>' : "") + `
<div class="grid g4" style="margin-bottom:16px">
 ${tuile(compl + "<small>%</small>", "profil complété", "profil")}
 ${tuile(CAND.candidatures.length, "candidatures", "offres")}
 ${tuile(aFaire.length, "entretiens à passer", "entretien")}
 ${tuile(presel, "présélections", "fusee")}
</div>
${aFaire.map((c) => { const o = CAND.toutes.find((x) => x.id === c.offre_id) || {}; return `<div class="alert gold" style="margin-bottom:14px"><div class="row"><div class="sp"><b>Entretien IA à passer</b><div class="small">${esc(o.titre)} — ${esc(nomOrg(o.org_id))}${o.limite ? " · avant le " + fr(o.limite) : ""}</div></div><button class="btn bleu sm" onclick="ouvrirEntretien('${c.id}')">${ico("lecture", 16)} ${c.consentement ? "Reprendre l'entretien" : "Commencer l'entretien"}</button></div></div>`; }).join("")}
<div class="grid g-tdb">
 <div class="card"><div class="row" style="margin-bottom:10px"><h3 class="sp" style="margin:0">Offres pour vous</h3><span class="small muted">${CAND.offres.length} offre(s)</span></div>
  <div class="grid filt" style="gap:8px;margin-bottom:6px;grid-template-columns:2fr 1fr 1fr">
   <input type="search" placeholder="Poste, entreprise, secteur…" value="${esc(filtre.q)}" oninput="filtre.q=this.value;majOffres()">
   <select onchange="filtre.type=this.value;majOffres()"><option value="">Tous types</option>${["Emploi", "Stage", "Alternance"].map((t) => `<option ${filtre.type === t ? "selected" : ""}>${t}</option>`).join("")}</select>
   <select onchange="filtre.ville=this.value;majOffres()"><option value="">Toutes villes</option>${villes.map((v) => `<option ${filtre.ville === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
  </div>
  <div id="offres">${listeOffres()}</div>
  <p class="small muted" style="margin:10px 0 0">Le carré indique une compatibilité estimée à partir de votre formation et de votre ville.</p>
 </div>
 <div>
  <div class="card">
   <div class="row"><div class="avatar xl">${esc(initiales(nomComplet(p)))}</div><div class="sp"><b style="font-size:16px">${esc(nomComplet(p))}</b><div class="small muted">${esc([p.formation, p.ville].filter(Boolean).join(" · ") || "Complétez votre profil")}</div></div></div>
   <div class="bar-h" style="margin-top:14px"><i style="width:${compl}%"></i></div>
   <div class="small muted" style="margin-top:6px">Profil complété à ${compl} %${compl < 100 ? ` · <a href="#" onclick="go('profil');return false">compléter</a>` : ""}</div>
  </div>
  <div class="card" style="margin-top:14px"><div class="row" style="margin-bottom:6px"><h3 class="sp" style="margin:0">Mes diplômes</h3><button class="btn sm ghost" onclick="ajouterDiplome()">+ Déclarer</button></div>
   ${CAND.diplomes.length ? CAND.diplomes.map((d) => `<div class="ligne"><span class="sq ${d.statut === "valide" ? "v" : d.statut === "refuse" ? "r" : "k"}"></span><div class="sp"><b>${esc(d.intitule)}</b><div class="small muted">${esc((CAND.ecoles.find((e) => e.id === d.ecole_id) || {}).nom || "")}${d.annee ? " · " + d.annee : ""}</div></div><span class="pill ${d.statut === "valide" ? "p-green" : d.statut === "refuse" ? "p-red" : "p-gray"}">${d.statut === "valide" ? "✔ Vérifié" : d.statut === "refuse" ? "Non reconnu" : "En attente de l'école"}</span>${d.statut !== "valide" ? `<button class="ico-btn" onclick="retirerDiplome('${d.id}',this)" title="Retirer">${ico("croix", 15)}</button>` : ""}</div>`).join("") : '<p class="small muted">Déclarez votre diplôme : votre école le vérifiera et vous obtiendrez le badge « Diplôme vérifié ».</p>'}
  </div>
  <div class="card" style="margin-top:14px"><h3>Mes candidatures</h3>
   ${CAND.candidatures.length ? CAND.candidatures.map((x) => { const o = CAND.toutes.find((y) => y.id === x.offre_id) || {}; return `<div class="ligne"><div class="avatar sm" style="cursor:default">${esc(initiales(nomOrg(o.org_id)))}</div><div class="sp"><b>${esc(o.titre || "Offre retirée")}</b><div class="small muted">${esc(nomOrg(o.org_id))} · ${esc(o.ville || "")}</div></div><span class="pill ${STATUTS[x.statut] || "p-gray"}">${esc(x.statut)}</span></div>`; }).join("") : '<p class="small muted">Aucune candidature pour le moment.</p>'}
  </div>
 </div>
</div>`;
};
function listeOffres() {
  const deja = new Set(CAND.candidatures.map((x) => x.offre_id));
  const l = CAND.offres.filter((o) => (!filtre.type || o.type === filtre.type) && (!filtre.ville || o.ville === filtre.ville) && (!filtre.q || (o.titre + nomOrg(o.org_id) + o.secteur).toLowerCase().includes(filtre.q.toLowerCase())))
    .map((o) => ({ o, c: compat(o) })).sort((a, b) => b.c - a.c);
  return l.length ? l.map(({ o, c }) => `<div class="candidat">${carre(c)}<div class="qui"><b>${esc(o.titre)}</b><span class="small muted">${esc(nomOrg(o.org_id))} · ${esc(o.ville)} · ${o.type}${o.limite ? " · jusqu'au " + fr(o.limite) : ""}</span>${o.description ? `<div class="small" style="margin-top:3px">${esc(o.description.slice(0, 130))}${o.description.length > 130 ? "…" : ""}</div>` : ""}</div>${deja.has(o.id) ? '<span class="pill p-gray">Déjà postulé</span>' : `<button class="btn bleu sm" onclick="postuler('${o.id}',this)">Postuler</button>`}</div>`).join("") : '<div class="vide">Aucune offre ne correspond pour le moment.</div>';
}
function majOffres() { $("#offres").innerHTML = listeOffres(); }
async function postuler(id, b) {
  const r = await occupe(b, SB.rpc("postuler", { p_offre: id }));
  toast("Candidature envoyée. Passez l'entretien IA pour la compléter."); ouvrirEntretien(r.id);
}
function ajouterDiplome() {
  if (!CAND.ecoles.length) return modal(`<h2>Aucune école inscrite</h2><p>Votre école n'utilise pas encore Excellent HR. Proposez-lui de s'inscrire gratuitement : elle pourra vérifier votre diplôme.</p><div class="row"><span class="sp"></span><button class="btn" onclick="closeModal()">Compris</button></div>`);
  modal(`<h2>Déclarer un diplôme</h2>
  <label for="d-ecole">École</label><select id="d-ecole">${CAND.ecoles.map((e) => `<option value="${e.id}">${esc(e.nom)}${e.ville ? " — " + esc(e.ville) : ""}</option>`).join("")}</select>
  <label for="d-int" style="margin-top:10px">Intitulé du diplôme</label><input type="text" id="d-int" placeholder="Master Génie pétrolier">
  <div class="grid" style="grid-template-columns:2fr 1fr;gap:10px;margin-top:10px"><div><label for="d-fil">Filière</label><input type="text" id="d-fil" placeholder="Génie pétrolier"></div><div><label for="d-an">Année</label><input type="number" id="d-an" min="1960" max="2100" value="${new Date().getFullYear()}"></div></div>
  <div class="row" style="margin-top:14px"><span class="sp"></span><button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn" onclick="envoyerDiplome(this)">Envoyer à l'école</button></div>`);
}
async function envoyerDiplome(b) {
  if (valeur("d-int").length < 2) return toast("Indiquez l'intitulé du diplôme.");
  await occupe(b, SB.ajouter("diplomes", { ecole_id: valeur("d-ecole"), intitule: valeur("d-int"), filiere: valeur("d-fil"), annee: Number(valeur("d-an")) || null }), "Diplôme envoyé à l'école pour vérification");
  closeModal(); render();
}
async function retirerDiplome(id, b) { await occupe(b, SB.supprimer("diplomes", "id=eq." + id), "Diplôme retiré"); render(); }

/* ---- Entretien assisté par l'IA ---- */
let candEntretien = null;
function ouvrirEntretien(id) { candEntretien = id; go("entretien"); }
function questions(o, ent) {
  return [
    { q: `Présentez votre parcours et ce qui vous amène vers ce poste : ${o.titre}.`, relance: "Merci. Quel élément de votre formation vous sera le plus utile dès le premier mois ?" },
    { q: "Décrivez une situation où vous avez résolu un problème concret. Qu'avez-vous fait, exactement ?", relance: "Quel a été le résultat mesurable de votre action ?" },
    { q: "Comment organisez-vous votre travail pour respecter les délais et la qualité attendue ?", relance: "Pouvez-vous citer un outil ou une méthode que vous avez déjà utilisé ?" },
    { q: "Racontez une expérience de travail en équipe qui ne s'est pas passée comme prévu.", relance: "Que feriez-vous différemment aujourd'hui ?" },
    { q: `Pourquoi souhaitez-vous rejoindre ${ent} en particulier ?`, relance: "Où vous voyez-vous dans trois ans ?" }];
}
VIEWS.entretien = async () => {
  const toutes = await SB.lire("candidatures", "user_id=eq." + ME.id + "&statut=eq." + encodeURIComponent("Entretien IA à passer") + "&order=cree_le.asc");
  let c = toutes.find((x) => x.id === candEntretien) || toutes[0];
  if (!c && candEntretien) { const [fini] = await SB.lire("candidatures", "id=eq." + candEntretien); if (fini && fini.statut !== "Entretien IA à passer") c = fini; }
  if (!c) return `<h1>Entretien IA</h1><p class="sub">Vos entretiens en ligne</p><div class="card vide">${ico("entretien", 34)}<h3 style="margin-top:10px">Aucun entretien à passer</h3><p>Postulez à une offre : l'entretien IA vous sera proposé aussitôt.</p><button class="btn bleu" onclick="go('candidat')">Voir les offres</button></div>`;
  candEntretien = c.id;
  const [o] = await SB.lire("offres", "id=eq." + c.offre_id);
  const [org] = await SB.lire("organisations", "id=eq." + o.org_id);
  const Q = questions(o, org?.nom || "cette entreprise");
  const fini = c.statut !== "Entretien IA à passer";
  const i = fini ? Q.length : c.etape;
  /* Colonne des modules (comme une formation) */
  const etapes = `<div class="etapes">
   <div class="et ${c.consentement ? "fait" : "cours"}"><span class="rond">${c.consentement ? ico("coche", 14) : ico("lecture", 14)}</span><b>Introduction</b>${c.consentement ? '<span class="termine">Terminé</span>' : ""}</div>
   ${Q.map((_, k) => `<div class="et ${k < i ? "fait" : k === i && c.consentement && !fini ? "cours" : ""}"><span class="rond">${k < i ? ico("coche", 14) : ico("lecture", 14)}</span><b>Question ${k + 1}</b>${k < i ? '<span class="termine">Terminé</span>' : ""}</div>`).join("")}
  </div>`;
  const tete = `<div class="entete"><div><h1>Entretien IA</h1><p class="sub">${esc(o.titre)} · ${esc(org?.nom)}</p></div><span class="pill p-navy">5 questions · ~15 min</span></div>`;
  if (fini) return tete + `<div class="module">${etapes}<div class="card" style="text-align:center"><div style="font-size:42px">✅</div><h2>Entretien envoyé</h2><p class="muted">Vos réponses ont été transmises à ${esc(org?.nom)}. Un recruteur examinera votre candidature : l'IA ne prend aucune décision seule.</p><button class="btn bleu" onclick="candEntretien=null;go('candidat')">Retour à mon espace</button></div></div>`;
  if (!c.consentement) return tete + `<div class="module">${etapes}<div class="card">
   <span class="pill p-gold">Introduction</span><h2 style="margin-top:10px">Avant de commencer</h2>
   <div class="alert navy small"><ul style="margin:0;padding-left:18px"><li>Vous répondez par écrit à des questions posées automatiquement.</li><li>Seul le contenu de vos réponses est évalué (pas votre visage, votre voix ou votre accent).</li><li>Le score de cette version est une estimation simple, sans IA réelle ; la décision revient toujours à un recruteur.</li><li>Votre progression est enregistrée : vous pouvez reprendre plus tard.</li></ul></div>
   <label style="margin-top:14px;display:flex;gap:8px;align-items:flex-start;color:var(--ink);font-weight:500"><input type="checkbox" id="ok" style="margin-top:4px"> J'ai compris et j'accepte de passer cet entretien.</label>
   <div class="row" style="margin-top:14px"><button class="btn ghost sm" onclick="retirerCandidature('${c.id}',this)">Retirer ma candidature</button><span class="sp"></span><button class="btn bleu" onclick="consentir(this)">Commencer</button></div></div></div>`;
  const q = Q[i], rep = c.reponses[i] || {};
  return tete + `<div class="module">${etapes}<div class="card">
   <div class="row"><span class="small muted">Question ${i + 1} sur ${Q.length}</span><span class="sp"></span><span class="small muted">Progression enregistrée</span></div>
   <div class="prog">${Q.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
   <div class="small muted">🤖 Assistant Excellent HR</div>
   <div class="bubble">${esc(q.q)}</div>
   ${rep.r1 ? `<div class="bubble me">${esc(rep.r1)}</div><div class="small muted">🤖 Relance</div><div class="bubble">${esc(q.relance)}</div>` : ""}
   <textarea id="rep" placeholder="Écrivez votre réponse…" maxlength="3000"></textarea>
   <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost" onclick="go('candidat')">Plus tard</button><button class="btn bleu" id="btnRep" onclick="repondre(this)">${!rep.r1 ? "Suivant" : (i < Q.length - 1 ? "Question suivante" : "Terminer l'entretien")}</button></div>
  </div></div>`;
};
async function consentir(b) { if (!$("#ok").checked) return toast("Merci de cocher la case d'accord."); await occupe(b, SB.rpc("entretien_consentir", { p_cand: candEntretien })); render(); }
async function repondre(b) {
  const t = $("#rep").value.trim(); if (t.length < 10) return toast("Merci de développer un peu votre réponse.");
  const r = await occupe(b, SB.rpc("entretien_repondre", { p_cand: candEntretien, p_texte: t }));
  if (r.termine) toast("Entretien terminé et envoyé"); render();
}
async function retirerCandidature(id, b) { await occupe(b, SB.rpc("retirer_candidature", { p_cand: id }), "Candidature retirée"); candEntretien = null; go("candidat"); }

/* ---- Entreprise : offres ---- */
let offreChoisie = null;
/* ---- Entreprise : tableau de bord ---- */
VIEWS.tableau = async () => {
  const [offres, employes] = await Promise.all([SB.lire("offres", "org_id=eq." + ME.org.id + "&order=cree_le.desc"), SB.lire("employes", "org_id=eq." + ME.org.id)]);
  const cands = offres.length ? await SB.lire("candidatures", "offre_id=" + inListe(offres.map((o) => o.id)) + "&order=cree_le.desc") : [];
  const conges = employes.length ? await SB.lire("conges", "employe_id=" + inListe(employes.map((e) => e.id)) + "&statut=eq." + encodeURIComponent("En attente")) : [];
  const ids = [...new Set(cands.slice(0, 6).map((c) => c.user_id))];
  const profils = ids.length ? await SB.lire("profils", "id=" + inListe(ids)) : [];
  const P = Object.fromEntries(profils.map((p) => [p.id, p]));
  const notes = cands.filter((c) => c.scores).map((c) => scoreDe(c, offres.find((o) => o.id === c.offre_id).poids));
  const moy = notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : 0;
  const crit = [0, 1, 2, 3].map((i) => { const l = cands.filter((c) => c.scores).map((c) => c.scores[i]); return l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : 0; });
  const ouvertes = offres.filter((o) => o.statut === "ouverte");
  const fins = employes.filter((e) => e.fin && joursAvant(e.fin) <= 45 && joursAvant(e.fin) >= 0).length;
  const passes = cands.filter((c) => c.scores).length;
  const taux = cands.length ? Math.round(passes / cands.length * 100) : 0;
  const coul = moy >= 75 ? "var(--green)" : moy >= 60 ? "var(--orange)" : "var(--red)";
  return bandeau(esc(ME.profil.prenoms.split(" ")[0] || ""), "Tableau de bord · " + esc(ME.org.nom), `<button class="btn bleu" onclick="go('offres');setTimeout(()=>formOffre(),300)">${ico("plus", 16)} Publier une offre</button>`) + `
<div class="grid g-tdb" style="align-items:start">
 <div class="grid" style="gap:16px;align-content:start">
  <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:16px">
   ${tuile(taux + "<small>%</small>", "entretiens passés", "candidats")}
   ${tuile(cands.length, "candidatures", "idee")}
   ${tuile(ouvertes.length, "offres ouvertes", "fusee")}
  </div>
  <div class="card"><h3>Score moyen des candidats</h3>
   <div class="donut">
    <div class="vals">
     <span style="background:var(--green-l);color:var(--green)">${notes.length ? Math.max(...notes) : "—"}</span>
     <span style="background:var(--orange-l);color:#B5531A">${notes.length ? moy : "—"}</span>
     <span style="background:var(--red-l);color:var(--red)">${notes.length ? Math.min(...notes) : "—"}</span>
    </div>
    ${donut(moy, 100, notes.length ? moy : "—", coul)}
    <div class="sp barres">${ouvertes.slice(0, 4).map((o) => { const l = cands.filter((c) => c.offre_id === o.id), p = l.filter((c) => c.scores).length; return `<div class="small" style="margin-top:6px">${esc(o.titre)}</div><div class="b"><div class="bar-h ${p ? "vert" : "gold"}"><i style="width:${l.length ? Math.round(p / l.length * 100) : 0}%"></i></div><span class="small muted">${p}/${l.length}</span></div>`; }).join("") || '<p class="small muted">Aucune offre ouverte.</p>'}</div>
   </div>
   <p class="small muted" style="margin:8px 0 0">Meilleur, moyen et plus faible score des entretiens terminés ; barres : entretiens passés par offre.</p>
  </div>
  <div class="card"><h3>Dernières candidatures</h3>
   ${cands.slice(0, 6).map((c) => { const o = offres.find((x) => x.id === c.offre_id); return `<div class="ligne" style="cursor:pointer" onclick="offreChoisie='${o.id}';go('recruteur')"><span style="color:var(--muted)">${ico("idee", 16)}</span><div class="sp"><b>${esc(nomComplet(P[c.user_id]))}</b><div class="small muted">${esc(o.titre)}</div></div>${c.scores ? `<b>${scoreDe(c, o.poids)}</b>` : ""}<span class="pill ${STATUTS[c.statut] || "p-gray"}">${esc(c.statut)}</span></div>`; }).join("") || '<div class="vide">Aucune candidature pour le moment.</div>'}
  </div>
 </div>
 <div class="grid" style="gap:16px;align-content:start">
  <div class="card"><h3>Personnel</h3>
   <div class="ligne"><span class="sp">Salariés</span><b>${employes.length}</b></div>
   <div class="ligne"><span class="sp">Congés à valider</span><b style="color:${conges.length ? "var(--orange)" : "inherit"}">${conges.length}</b></div>
   <div class="ligne"><span class="sp">Contrats finissant sous 45 jours</span><b style="color:${fins ? "var(--red)" : "inherit"}">${fins}</b></div>
   <button class="btn ghost sm" style="margin-top:10px" onclick="go('rh')">Ouvrir le personnel</button>
  </div>
  <div class="card"><h3>Analyse des entretiens</h3>
   <div style="text-align:center">${radar(crit, ["Technique", "Expérience", "Communication", "Motivation"])}</div>
   <p class="small muted" style="margin:0">Moyenne des candidats sur chaque critère (sur 100).</p>
  </div>
 </div>
</div>`;
};

/* ---- Entreprise : offres ---- */
VIEWS.offres = async () => {
  const offres = await SB.lire("offres", "org_id=eq." + ME.org.id + "&order=cree_le.desc");
  const cands = offres.length ? await SB.lire("candidatures", "offre_id=" + inListe(offres.map((o) => o.id)) + "&select=offre_id,statut") : [];
  const n = (id, f) => cands.filter((c) => c.offre_id === id && (!f || f(c))).length;
  return `<div class="entete"><div><h1>Offres</h1><p class="sub">${esc(ME.org.nom)} · ${offres.length} offre(s)</p></div><button class="btn bleu" onclick="formOffre()">+ Publier une offre</button></div>
<div class="card" style="overflow-x:auto">${offres.length ? `<table><tr><th>Offre</th><th>Type</th><th>Candidatures</th><th>Entretiens passés</th><th>Statut</th><th></th></tr>
${offres.map((o) => `<tr><td><b>${esc(o.titre)}</b><div class="small muted">${esc(o.ville)} · publiée le ${fr(o.cree_le)}</div></td><td>${o.type}</td><td><b>${n(o.id)}</b></td><td>${n(o.id, (c) => c.statut !== "Entretien IA à passer")}</td>
<td><span class="pill ${o.statut === "ouverte" ? "p-green" : "p-gray"}">${o.statut === "ouverte" ? "Ouverte" : "Fermée"}</span></td>
<td><div class="row" style="justify-content:flex-end"><button class="btn sm" onclick="offreChoisie='${o.id}';go('recruteur')">Candidatures</button><button class="btn sm ghost" onclick="formOffre('${o.id}')">Modifier</button></div></td></tr>`).join("")}</table>` : '<div class="vide">Aucune offre. Publiez la première : elle sera visible par tous les candidats inscrits.</div>'}</div>`;
};

/* ---- Entreprise : candidatures (entonnoir + filtres + liste) ---- */
let filtreRecr = { q: "", tri: "score", verifie: false, statut: "" };
VIEWS.recruteur = async () => {
  const offres = await SB.lire("offres", "org_id=eq." + ME.org.id + "&order=cree_le.desc");
  if (!offres.length) return `<h1>Candidatures</h1><p class="sub">Publiez d'abord une offre.</p><div class="card vide"><button class="btn bleu" onclick="go('offres')">Mes offres</button></div>`;
  const o = offres.find((x) => x.id === offreChoisie) || offres[0]; offreChoisie = o.id;
  const toutes = await SB.lire("candidatures", "offre_id=eq." + o.id);
  const ids = toutes.map((c) => c.user_id);
  const [profils, diplomes] = ids.length ? await Promise.all([SB.lire("profils", "id=" + inListe(ids)), SB.lire("diplomes", "user_id=" + inListe(ids) + "&statut=eq.valide")]) : [[], []];
  const emps = await SB.lire("employes", "org_id=eq." + ME.org.id + "&select=candidature_id");
  PRE = { o, toutes, profils: Object.fromEntries(profils.map((p) => [p.id, p])), verifies: new Set(diplomes.map((d) => d.user_id)), embauches: new Set(emps.map((e) => e.candidature_id)) };
  const embauches = toutes.filter((c) => PRE.embauches.has(c.id)).length;
  const etapes = [
    [toutes.length, "Candidatures"],
    [toutes.filter((c) => c.shortlist || ["Présélectionné(e)", "Retenu(e)"].includes(c.statut)).length, "Présélection"],
    [toutes.filter((c) => c.scores).length, "Entretiens"],
    [toutes.filter((c) => ["Présélectionné(e)", "Retenu(e)"].includes(c.statut)).length, "Proposition"],
    [embauches, "Recrutement"]];
  const f = filtreRecr, q = f.q.toLowerCase();
  let list = toutes.map((c) => ({ c, p: PRE.profils[c.user_id], s: c.scores ? scoreDe(c, o.poids) : null }))
    .filter(({ c, p }) => (!q || (nomComplet(p) + " " + (p?.formation || "")).toLowerCase().includes(q)) && (!f.verifie || PRE.verifies.has(c.user_id)) && (!f.statut || c.statut === f.statut));
  list.sort((a, b) => f.tri === "nom" ? nomComplet(a.p).localeCompare(nomComplet(b.p)) : (b.s ?? -1) - (a.s ?? -1));
  const nb = toutes.filter((c) => c.shortlist && c.statut === "Entretien IA passé").length;
  const puces = [f.tri === "score" ? "Trier par score" : "Trier par nom", f.verifie ? "Diplôme vérifié" : "", f.statut, f.q ? "« " + f.q + " »" : ""].filter(Boolean);
  return `<div class="entete"><div><h1>Candidatures</h1>
 <select onchange="offreChoisie=this.value;render()" style="max-width:420px;margin-top:6px;font-weight:700;color:var(--nuit)">${offres.map((x) => `<option value="${x.id}" ${x.id === o.id ? "selected" : ""}>${esc(x.titre)}${x.statut === "fermee" ? " (fermée)" : ""}</option>`).join("")}</select></div>
 <button class="btn ghost" onclick="ouvrirPoids()">Grille d'évaluation</button>
 <button class="btn bleu" ${o.shortlist_validee || !nb ? "disabled" : ""} onclick="validerSL()">${o.shortlist_validee ? "Short-list validée ✔" : "Valider la short-list (" + nb + ")"}</button></div>
<div class="entonnoir">${etapes.map(([n, l]) => `<div class="et ${n ? "on" : ""}"><div class="n">${n || "–"}</div><div class="l">${l}</div></div>`).join("")}</div>
<div class="recr">
 <div class="card filtres"><h3>Filtres :</h3>
  <div class="row" style="gap:6px">${puces.map((x) => `<span class="puce">${esc(x)}</span>`).join("")}</div>
  <label for="r-tri">Trier</label><select id="r-tri" onchange="filtreRecr.tri=this.value;render()"><option value="score" ${f.tri === "score" ? "selected" : ""}>Par score</option><option value="nom" ${f.tri === "nom" ? "selected" : ""}>Par nom</option></select>
  <label for="r-st">Statut</label><select id="r-st" onchange="filtreRecr.statut=this.value;render()"><option value="">Tous</option>${Object.keys(STATUTS).map((s) => `<option ${f.statut === s ? "selected" : ""}>${s}</option>`).join("")}</select>
  <label style="display:flex;gap:8px;align-items:center;color:var(--ink);font-weight:500;margin-top:14px"><input type="checkbox" ${f.verifie ? "checked" : ""} onchange="filtreRecr.verifie=this.checked;render()"> Diplôme vérifié seulement</label>
  ${puces.length > 1 || f.q ? `<button class="btn ghost sm" style="margin-top:14px" onclick="filtreRecr={q:'',tri:'score',verifie:false,statut:''};render()">Effacer les filtres</button>` : ""}
  <p class="small muted" style="margin:16px 0 0">Score : estimation simple (sans IA réelle). Lisez les réponses avant de décider.</p>
 </div>
 <div>
  <div class="barre-recherche"><input type="search" id="r-q" placeholder="Nom, formation…" value="${esc(f.q)}" onkeydown="if(event.key==='Enter'){filtreRecr.q=this.value.trim();render()}"><button class="btn" onclick="filtreRecr.q=$('#r-q').value.trim();render()">Rechercher</button></div>
  <div class="liste-cand">${list.length ? list.map(({ c, p, s }) => { const emb = PRE.embauches.has(c.id); return `<div class="candidat ${c.shortlist ? "sel" : ""}">
   <input type="checkbox" title="Short-list" ${c.shortlist ? "checked" : ""} ${o.shortlist_validee || c.statut !== "Entretien IA passé" ? "disabled" : ""} onchange="basculerSL('${c.id}',this)">
   ${carre(s)}
   <div class="avatar">${esc(initiales(nomComplet(p)))}</div>
   <div class="qui"><b>${esc(nomComplet(p))}</b><span class="small muted">${PRE.verifies.has(c.user_id) ? "✔ Diplôme vérifié" : "Diplôme non vérifié"}${p?.formation ? " · " + esc(p.formation) : ""}</span></div>
   <span class="pill ${emb ? "p-green" : STATUTS[c.statut] || "p-gray"}">${emb ? "Recruté(e)" : esc(c.statut)}</span>
   ${c.scores ? `<button class="btn sm ghost" onclick="detail('${c.id}')">${ico("oeil", 15)} Détail</button>` : ""}
   <div class="menu-act"><button class="ico-btn" onclick="menuAct(this)" title="Actions">${ico("points", 16)}</button><div class="menu">
    ${c.scores ? `<button onclick="detail('${c.id}')">${ico("oeil", 16)} Voir les réponses</button>` : ""}
    ${p?.telephone ? `<a href="tel:${esc(p.telephone.replace(/\s/g, ""))}">${ico("tel", 16)} Appeler</a><a href="sms:${esc(p.telephone.replace(/\s/g, ""))}">${ico("sms", 16)} Envoyer un SMS</a>` : `<span class="small muted" style="padding:8px 10px;display:block">Pas de téléphone renseigné</span>`}
    ${c.scores && !emb ? `<button onclick="formEmbauche('${c.id}')">${ico("coche", 16)} Retenir et passer en RH</button>` : ""}
    ${c.statut !== "Non retenu(e)" && !emb ? `<button onclick="refuser('${c.id}',null)">${ico("croix", 16)} Ne pas retenir</button>` : ""}
   </div></div>
  </div>`; }).join("") : '<div class="card vide">Aucune candidature ne correspond.</div>'}</div>
 </div>
</div>`;
};

async function formOffre(id) {
  const o = id ? (await SB.lire("offres", "id=eq." + id))[0] : { titre: "", ville: ME.org.ville || "", type: "Emploi", secteur: ME.org.secteur || "", description: "", limite: "", statut: "ouverte" };
  modal(`<h2>${id ? "Modifier l'offre" : "Publier une offre"}</h2>
  <label for="of-titre">Intitulé du poste</label><input type="text" id="of-titre" value="${esc(o.titre)}" placeholder="Ingénieur(e) procédés junior">
  <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">
   <div><label for="of-ville">Ville</label><input type="text" id="of-ville" value="${esc(o.ville)}"></div>
   <div><label for="of-type">Type</label><select id="of-type">${["Emploi", "Stage", "Alternance"].map((t) => `<option ${o.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
   <div><label for="of-lim">Date limite</label><input type="date" id="of-lim" value="${o.limite || ""}"></div>
  </div>
  <label for="of-sect" style="margin-top:10px">Secteur</label><input type="text" id="of-sect" value="${esc(o.secteur)}">
  <label for="of-desc" style="margin-top:10px">Description (missions, profil recherché)</label><textarea id="of-desc" maxlength="4000">${esc(o.description)}</textarea>
  ${id ? `<label style="margin-top:10px;display:flex;gap:8px;color:var(--ink);font-weight:500"><input type="checkbox" id="of-ouv" ${o.statut === "ouverte" ? "checked" : ""}> Offre ouverte aux candidatures</label>` : ""}
  <div class="row" style="margin-top:14px">${id ? `<button class="btn red sm" onclick="supprimerOffre('${id}',this)">Supprimer</button>` : ""}<span class="sp"></span><button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn" onclick="enregistrerOffre(${id ? `'${id}'` : "null"},this)">${id ? "Enregistrer" : "Publier"}</button></div>`);
}
async function enregistrerOffre(id, b) {
  const v = { titre: valeur("of-titre"), ville: valeur("of-ville"), type: valeur("of-type"), secteur: valeur("of-sect"), description: valeur("of-desc"), limite: valeur("of-lim") || null };
  if (v.titre.length < 2) return toast("Indiquez l'intitulé du poste.");
  if (id) { v.statut = $("#of-ouv").checked ? "ouverte" : "fermee"; await occupe(b, SB.modifier("offres", "id=eq." + id, v), "Offre enregistrée"); }
  else { v.org_id = ME.org.id; await occupe(b, SB.ajouter("offres", v), "Offre publiée"); }
  closeModal(); render();
}
function supprimerOffre(id) {
  modal(`<h2>Supprimer cette offre ?</h2><p>Les candidatures et les entretiens reçus pour cette offre seront aussi effacés. Pour simplement arrêter les candidatures, décochez plutôt « Offre ouverte ».</p>
  <div class="row"><span class="sp"></span><button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn red" onclick="confirmerSupprOffre('${id}',this)">Supprimer définitivement</button></div>`);
}
async function confirmerSupprOffre(id, b) { await occupe(b, SB.supprimer("offres", "id=eq." + id), "Offre supprimée"); closeModal(); render(); }

/* ---- Entreprise : présélection ---- */
const CRIT = ["Compétences techniques", "Expérience / mises en situation", "Communication", "Motivation / adéquation"];
let PRE = null;
const scoreDe = (c, p) => { if (!c.scores) return 0; const t = p.reduce((a, b) => a + b, 0) || 1; return Math.round(c.scores.reduce((a, s, i) => a + s * p[i], 0) / t); };
async function basculerSL(id, cb) { cb.disabled = true; try { await occupe(null, SB.rpc("basculer_shortlist", { p_cand: id })); } catch (e) { } render(); }
function validerSL() {
  const sl = PRE.toutes.filter((c) => c.shortlist && c.statut === "Entretien IA passé");
  modal(`<h2>Valider la short-list ?</h2><p>Les ${sl.length} candidat(e)s suivant(e)s passeront au statut « Présélectionné(e) » et le verront dans leur espace :</p><ul>${sl.map((c) => `<li>${esc(nomComplet(PRE.profils[c.user_id]))} — ${scoreDe(c, PRE.o.poids)}/100</li>`).join("")}</ul><p class="small muted">Les autres gardent le statut « Entretien IA passé » jusqu'à votre décision.</p><div class="row"><span class="sp"></span><button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn gold" onclick="confirmerSL(this)">Confirmer</button></div>`);
}
async function confirmerSL(b) { await occupe(b, SB.rpc("valider_shortlist", { p_offre: PRE.o.id }), "Short-list validée"); closeModal(); render(); }
function detail(id) {
  const c = PRE.toutes.find((x) => x.id === id), p = PRE.profils[c.user_id], o = PRE.o, s = scoreDe(c, o.poids);
  const Q = questions(o, ME.org.nom), emb = PRE.embauches.has(c.id);
  modal(`<div class="row"><h2 class="sp" style="margin:0">${esc(nomComplet(p))}</h2><span class="score">${s}/100</span></div>
  <p class="small muted">${esc(p?.formation || "")} · ${PRE.verifies.has(c.user_id) ? "✔ Diplôme vérifié par l'école" : "Diplôme non vérifié"}${p?.telephone ? " · " + esc(p.telephone) : ""}</p>
  ${c.scores.map((v, i) => `<div class="crit"><span>${CRIT[i]} <span class="muted">(${o.poids[i]} %)</span></span><div class="bar-h"><i style="width:${v}%"></i></div><b>${v}</b></div>`).join("")}
  <p class="small muted" style="margin-top:8px">${esc(c.resume || "")}</p>
  <h3 style="margin-top:16px">Réponses à l'entretien</h3>
  ${Q.map((q, i) => { const r = c.reponses[i] || {}; return `<p class="small" style="margin:10px 0 2px"><b>${i + 1}. ${esc(q.q)}</b></p><p class="small">${esc(r.r1 || "—")}</p><p class="small muted" style="margin:4px 0 2px"><i>${esc(q.relance)}</i></p><p class="small">${esc(r.r2 || "—")}</p>`; }).join("")}
  <div class="row" style="margin-top:14px">${c.statut !== "Non retenu(e)" && !emb ? `<button class="btn ghost sm" onclick="refuser('${c.id}',this)">Ne pas retenir</button>` : ""}<span class="sp"></span><button class="btn ghost" onclick="closeModal()">Fermer</button>
  <button class="btn" ${emb ? "disabled" : ""} onclick="formEmbauche('${c.id}')">${emb ? "Déjà dans le personnel" : "Retenir et passer en RH"}</button></div>`);
}
async function refuser(id, b) { await occupe(b, SB.rpc("refuser_candidature", { p_cand: id }), "Candidature marquée « Non retenu(e) »"); closeModal(); render(); }
function formEmbauche(id) {
  const o = PRE.o;
  modal(`<h2>Retenir et passer en RH</h2><p class="small muted">${esc(nomComplet(PRE.profils[PRE.toutes.find((x) => x.id === id).user_id]))} sera ajouté(e) au personnel et pourra demander ses congés depuis son compte.</p>
  <label for="e-poste">Poste</label><input type="text" id="e-poste" value="${esc(o.titre)}">
  <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">
   <div><label for="e-contrat">Contrat</label><select id="e-contrat">${["CDI", "CDD", "Stage", "Alternance"].map((t) => `<option ${t === (o.type === "Stage" ? "Stage" : o.type === "Alternance" ? "Alternance" : "CDD") ? "selected" : ""}>${t}</option>`).join("")}</select></div>
   <div><label for="e-fin">Fin (si CDD/stage)</label><input type="date" id="e-fin"></div>
   <div><label for="e-serv">Service</label><input type="text" id="e-serv"></div>
  </div>
  <div class="row" style="margin-top:14px"><span class="sp"></span><button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn" onclick="embaucher('${id}',this)">Confirmer</button></div>`);
}
async function embaucher(id, b) {
  await occupe(b, SB.rpc("embaucher", { p_cand: id, p_poste: valeur("e-poste"), p_contrat: valeur("e-contrat"), p_fin: valeur("e-fin") || null, p_service: valeur("e-serv") }), "Ajouté(e) au personnel");
  closeModal(); go("rh");
}
function ouvrirPoids() {
  const p = [...PRE.o.poids]; window._poids = p;
  modal(`<h2>Grille d'évaluation</h2><p class="small muted">La même grille s'applique à tous les candidats de l'offre. Total : <b id="tot">${p.reduce((a, b) => a + b)}</b> %</p>
  ${CRIT.map((c, i) => `<div class="crit" style="grid-template-columns:170px 1fr 46px"><span>${c}</span><input type="range" min="0" max="70" step="5" value="${p[i]}" oninput="_poids[${i}]=+this.value;this.parentNode.lastElementChild.textContent=this.value+' %';$('#tot').textContent=_poids.reduce((a,b)=>a+b)"><b>${p[i]} %</b></div>`).join("")}
  <div class="row" style="margin-top:14px"><button class="btn ghost sm" onclick="_poids=[40,25,20,15];appliquerPoids(this)">Par défaut (40/25/20/15)</button><span class="sp"></span><button class="btn" onclick="appliquerPoids(this)">Appliquer</button></div>`);
}
async function appliquerPoids(b) {
  if (!_poids.some((x) => x > 0)) return toast("Au moins un critère doit compter.");
  await occupe(b, SB.modifier("offres", "id=eq." + PRE.o.id, { poids: _poids }), "Grille appliquée"); closeModal(); render();
}

/* ---- Entreprise : gestion du personnel ---- */
/* ---- Entreprise : personnel ---- */
let RH = null, filtreRH = "", ficheId = null, ongletFiche = "dossier";
VIEWS.rh = async () => {
  const employes = await SB.lire("employes", "org_id=eq." + ME.org.id + "&order=cree_le.desc");
  const conges = employes.length ? await SB.lire("conges", "employe_id=" + inListe(employes.map((e) => e.id)) + "&order=cree_le.desc") : [];
  RH = { employes, conges };
  const nomE = (id) => employes.find((e) => e.id === id)?.nom || "—";
  const fins = employes.filter((e) => e.fin && joursAvant(e.fin) <= 45 && joursAvant(e.fin) >= 0);
  const att = conges.filter((c) => c.statut === "En attente");
  const n = (t) => employes.filter((e) => e.contrat === t).length;
  const q = filtreRH.toLowerCase(), vus = employes.filter((e) => !q || (e.nom + " " + e.poste + " " + e.service).toLowerCase().includes(q));
  return `<div class="entete"><div><h1>Gestion du personnel</h1><p class="sub">${esc(ME.org.nom)}</p></div><button class="btn bleu" onclick="formEmploye()">+ Ajouter un salarié</button></div>
<div class="grid g4">
 ${tuile(employes.length, "employés", "personnel")}
 ${tuile(`${n("CDI")} / ${n("CDD")} / ${n("Stage") + n("Alternance")}`, "CDI / CDD / stages-alternances", "doc")}
 ${tuile(att.length, "congés à valider", "conges")}
 ${tuile(`<span style="color:${fins.length ? "var(--red)" : "inherit"}">${fins.length}</span>`, "contrats finissant sous 45 j", "offres")}
</div>
${fins.map((e) => `<div class="alert red" style="margin-top:12px"><b>Fin de contrat :</b> ${esc(e.nom)} (${e.contrat}) le ${fr(e.fin)} — dans ${joursAvant(e.fin)} jour(s).</div>`).join("")}
<div class="grid g-tdb" style="margin-top:16px">
 <div class="card" style="overflow-x:auto"><div class="row" style="margin-bottom:8px"><h3 class="sp" style="margin:0">Effectif</h3>${filtreRH ? `<span class="puce">« ${esc(filtreRH)} » <a href="#" style="color:#fff" onclick="filtreRH='';render();return false">✕</a></span>` : ""}</div>
 ${vus.length ? `<table><tr><th>Nom</th><th>Poste</th><th>Contrat</th><th>Fin</th><th>Solde</th></tr>
 ${vus.map((e) => `<tr class="cliquable" onclick="ouvrirFiche('${e.id}')"><td><div class="row" style="flex-wrap:nowrap"><div class="avatar sm">${esc(initiales(e.nom))}</div><div><b>${esc(e.nom)}</b>${e.candidature_id ? ' <span class="pill p-gold">recruté(e) ici</span>' : ""}<div class="small muted">${esc(e.service)}${e.user_id ? " · compte relié" : ""}</div></div></div></td><td>${esc(e.poste)}</td><td><span class="pill ${e.contrat === "CDI" ? "p-navy" : e.contrat === "CDD" ? "p-gray" : "p-gold"}">${e.contrat}</span></td><td class="small">${fr(e.fin)}</td><td><b>${e.solde} j</b></td></tr>`).join("")}
 </table><p class="small muted" style="margin:10px 0 0">Cliquez sur une ligne pour ouvrir le dossier du salarié.</p>` : '<div class="vide">Ajoutez vos salariés, ou retenez un candidat depuis les candidatures.</div>'}</div>
 <div class="card"><h3>Demandes de congé</h3>
 ${conges.length ? conges.map((c) => `<div class="ligne"><div class="sp"><b>${esc(nomE(c.employe_id))}</b><div class="small muted">du ${fr(c.du)} au ${fr(c.au)} · ${c.jours} j ouvrés${c.motif ? " · " + esc(c.motif) : ""}</div></div>
 ${c.statut === "En attente" ? `<button class="btn sm bleu" onclick="deciderConge('${c.id}',true,this)">Valider</button><button class="btn sm ghost" onclick="deciderConge('${c.id}',false,this)">Refuser</button>` : `<span class="pill ${c.statut === "Validé" ? "p-green" : "p-red"}">${c.statut}</span>`}</div>`).join("") : '<div class="vide">Aucune demande.</div>'}
 </div>
</div>`;
};
function ouvrirFiche(id) { ficheId = id; ongletFiche = "dossier"; go("fiche"); }

/* ---- Dossier salarié : en-tête, rubriques, frise, panneaux dépliants ---- */
VIEWS.fiche = async () => {
  if (!ficheId) { setTimeout(() => go("rh")); return ""; }
  const [e] = await SB.lire("employes", "id=eq." + ficheId);
  if (!e) { setTimeout(() => go("rh")); return ""; }
  const conges = await SB.lire("conges", "employe_id=eq." + e.id + "&order=du.asc");
  if (!RH) RH = { employes: [e], conges };
  else if (!RH.employes.some((x) => x.id === e.id)) RH.employes.push(e);
  RH.employes = RH.employes.map((x) => x.id === e.id ? e : x);
  /* Frise : un carré par événement, rangé par année */
  const evts = [{ d: e.cree_le, c: "v", t: "Entrée dans le personnel" }];
  conges.forEach((c) => evts.push({ d: c.du, c: c.statut === "Validé" ? "b" : c.statut === "Refusé" ? "r" : "o", t: `Congé ${c.statut.toLowerCase()} : ${fr(c.du)} → ${fr(c.au)}` }));
  if (e.fin) evts.push({ d: e.fin, c: "n", t: "Fin de contrat" });
  const ans = [...new Set(evts.map((x) => String(x.d).slice(0, 4)))].sort();
  const coul = { v: "#3DB05A", b: "#5A6B9A", r: "var(--red)", o: "#F08A3A", n: "var(--nuit)" };
  const pris = conges.filter((c) => c.statut === "Validé").reduce((a, c) => a + c.jours, 0);
  const attente = conges.filter((c) => c.statut === "En attente").reduce((a, c) => a + c.jours, 0);
  const panneau = (cl, titre, resume, contenu, idp) => `<details class="accordeon" id="${idp}"><summary><span class="sq ${cl}"></span><span class="t"><b>${titre}</b><span>${resume}</span></span>${ico("bas", 18)}</summary><div class="contenu">${contenu}</div></details>`;
  const rubr = [["r", "Contrat", "p-contrat"], ["r", "Statut du dossier", "p-statut"], ["b", "Poste et service", "p-poste"], ["b", "Congés", "p-conges"], ["k", "Compte et code de liaison", "p-compte"], ["v", "Recrutement", "p-recr"], ["n", "Documents", "p-docs"]];
  const dossier = `<div class="dossier">
  <nav class="rubriques">${rubr.map(([c, t, id]) => `<a href="#" onclick="const d=document.getElementById('${id}');d.open=true;d.scrollIntoView({behavior:'smooth',block:'center'});return false"><span class="sq ${c}"></span>${t}</a>`).join("")}
   <a href="#" style="margin-top:6px" onclick="document.querySelectorAll('.accordeon').forEach(d=>d.open=false);return false">Tout replier</a></nav>
  <div>
   <div class="card"><div class="row" style="margin-bottom:12px"><h3 class="sp" style="margin:0">Frise chronologique</h3><span class="small muted">${evts.length} événement(s)</span></div>
    <div class="frise">${ans.map((a) => `<div class="an"><b>${a}</b><div class="cases">${evts.filter((x) => String(x.d).startsWith(a)).map((x) => `<i title="${esc(x.t)} (${fr(x.d)})" style="background:${coul[x.c]}"></i>`).join("")}</div></div>`).join("")}</div>
    <div class="frise-bas"></div>
    <div class="row small muted" style="margin-top:10px;gap:14px"><span><span class="sq v"></span> entrée</span><span><span class="sq b"></span> congé validé</span><span><span class="sq o"></span> en attente</span><span><span class="sq r"></span> refusé</span><span><span class="sq n"></span> fin de contrat</span></div>
   </div>
   ${panneau("r", "Contrat", `${e.contrat}${e.fin ? " jusqu'au " + fr(e.fin) : " — durée indéterminée"}`, `<p>Type : <b>${e.contrat}</b><br>Fin : <b>${fr(e.fin)}</b>${e.fin ? ` (dans ${joursAvant(e.fin)} jour(s))` : ""}</p><button class="btn sm ghost" onclick="formEmploye('${e.id}')">Modifier</button>`, "p-contrat")}
   ${panneau("r", "Statut du dossier", e.fin && joursAvant(e.fin) < 0 ? "Contrat terminé" : "Actif", `<p>Dossier créé le ${fr(e.cree_le)}.</p>`, "p-statut")}
   ${panneau("b", "Poste et service", `${esc(e.poste || "—")}${e.service ? " · " + esc(e.service) : ""}`, `<p>Poste : <b>${esc(e.poste || "—")}</b><br>Service : <b>${esc(e.service || "—")}</b></p><button class="btn sm ghost" onclick="formEmploye('${e.id}')">Modifier</button>`, "p-poste")}
   ${panneau("b", "Congés", `Solde ${e.solde} j · ${pris} j pris${attente ? " · " + attente + " j en attente" : ""}`, conges.length ? conges.slice().reverse().map((c) => `<div class="ligne"><span class="sp small">${fr(c.du)} → ${fr(c.au)} · ${c.jours} j${c.motif ? " · " + esc(c.motif) : ""}</span>${c.statut === "En attente" ? `<button class="btn sm bleu" onclick="deciderConge('${c.id}',true,this)">Valider</button><button class="btn sm ghost" onclick="deciderConge('${c.id}',false,this)">Refuser</button>` : `<span class="pill ${c.statut === "Validé" ? "p-green" : "p-red"}">${c.statut}</span>`}</div>`).join("") : '<p class="small muted">Aucune demande.</p>', "p-conges")}
   ${panneau("k", "Compte et code de liaison", e.user_id ? "Compte relié" : "Pas encore relié", e.user_id ? "<p>Le salarié est relié à son compte : il demande ses congés lui-même.</p>" : `<p>Code à remettre au salarié : <b class="code">${esc(e.code)}</b><br><span class="small muted">Il crée un compte (n'importe quel type), puis le saisit dans son Profil.</span></p>`, "p-compte")}
   ${panneau("v", "Recrutement", e.candidature_id ? "Recruté(e) via Excellent HR" : "Ajouté(e) manuellement", e.candidature_id ? "<p>Ce salarié a passé l'entretien IA et a été retenu depuis les candidatures.</p>" : "<p>Fiche créée directement dans le personnel.</p>", "p-recr")}
   ${panneau("n", "Documents", "Attestation de travail", `<button class="btn sm" onclick="attestation('${e.id}')">${ico("doc", 15)} Générer l'attestation</button>`, "p-docs")}
  </div></div>`;
  const conge = `<div class="card"><h3>Congés de ${esc(e.nom)}</h3>${conges.length ? conges.slice().reverse().map((c) => `<div class="ligne"><span class="sq ${c.statut === "Validé" ? "b" : c.statut === "Refusé" ? "r" : "o"}"></span><span class="sp">${fr(c.du)} → ${fr(c.au)} · <b>${c.jours} j</b>${c.motif ? ` <span class="muted">· ${esc(c.motif)}</span>` : ""}</span><span class="pill ${c.statut === "Validé" ? "p-green" : c.statut === "Refusé" ? "p-red" : "p-gold"}">${c.statut}</span></div>`).join("") : '<div class="vide">Aucune demande.</div>'}</div>`;
  return `<section class="bandeau-profil">
 <a href="#" class="retour" onclick="go('rh');return false">← Personnel</a>
 <div class="fiche-tete"><div class="avatar xxl">${esc(initiales(e.nom))}</div><div class="sp"><h1>${esc(e.nom)}</h1><p class="poste">${esc(e.poste || "—")}${e.service ? " · " + esc(e.service) : ""}</p></div>
  <button class="btn ghost-blanc" onclick="attestation('${e.id}')">${ico("doc", 16)} Attestation</button><button class="btn ghost-blanc" onclick="formEmploye('${e.id}')">Modifier</button></div>
 <div class="onglets-l"><button class="${ongletFiche === "dossier" ? "on" : ""}" onclick="ongletFiche='dossier';render()">Dossier salarié</button><button class="${ongletFiche === "conges" ? "on" : ""}" onclick="ongletFiche='conges';render()">Congés</button></div>
</section>
<div class="profil-corps">
 <aside class="vitals card"><h3>En bref</h3>
  <div class="v"><span>Contrat</span><b>${e.contrat}</b></div>
  <div class="v"><span>Fin du contrat</span><b>${fr(e.fin)}</b></div>
  <div class="v"><span>Solde de congés</span><b>${e.solde} jours</b></div>
  <div class="v"><span>Entré(e) le</span><b>${fr(e.cree_le)}</b></div>
  <div class="v"><span>Compte</span><b>${e.user_id ? "Relié" : "Code " + esc(e.code)}</b></div>
 </aside>
 <div class="profil-principal">
${ongletFiche === "dossier" ? dossier : conge}
 </div>
</div>`;
};

async function deciderConge(id, ok, b) { await occupe(b, SB.rpc("decider_conge", { p_id: id, p_valide: ok }), ok ? "Congé validé" : "Congé refusé"); render(); }
function formEmploye(id) {
  const e = id ? RH.employes.find((x) => x.id === id) : { nom: "", poste: "", service: "", contrat: "CDI", fin: "", solde: 26 };
  modal(`<h2>${id ? "Modifier la fiche" : "Ajouter un salarié"}</h2>
  <label for="s-nom">Nom et prénoms</label><input type="text" id="s-nom" value="${esc(e.nom)}">
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
   <div><label for="s-poste">Poste</label><input type="text" id="s-poste" value="${esc(e.poste)}"></div>
   <div><label for="s-serv">Service</label><input type="text" id="s-serv" value="${esc(e.service)}"></div>
   <div><label for="s-contrat">Contrat</label><select id="s-contrat">${["CDI", "CDD", "Stage", "Alternance"].map((t) => `<option ${e.contrat === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
   <div><label for="s-fin">Fin du contrat</label><input type="date" id="s-fin" value="${e.fin || ""}"></div>
   <div><label for="s-solde">Solde de congés (jours)</label><input type="number" id="s-solde" min="0" max="365" value="${e.solde}"></div>
  </div>
  ${id && !e.user_id ? `<div class="alert gold small" style="margin-top:12px">Code à remettre au salarié pour qu'il relie son compte : <b class="code">${esc(e.code)}</b><br>Il crée un compte (n'importe quel type), puis le saisit dans son Profil.</div>` : ""}
  <div class="row" style="margin-top:14px">${id ? `<button class="btn red sm" onclick="retirerEmploye('${id}',this)">Retirer</button>` : ""}<span class="sp"></span><button class="btn ghost" onclick="closeModal()">Annuler</button><button class="btn" onclick="enregistrerEmploye(${id ? `'${id}'` : "null"},this)">Enregistrer</button></div>`);
}
async function enregistrerEmploye(id, b) {
  const v = { nom: valeur("s-nom"), poste: valeur("s-poste"), service: valeur("s-serv"), contrat: valeur("s-contrat"), fin: valeur("s-fin") || null, solde: Number(valeur("s-solde")) || 0 };
  if (v.nom.length < 2) return toast("Indiquez le nom.");
  if (id) await occupe(b, SB.modifier("employes", "id=eq." + id, v), "Fiche enregistrée");
  else { v.org_id = ME.org.id; const [e] = await occupe(b, SB.ajouter("employes", v), "Salarié ajouté"); closeModal(); await render(); if (e) formEmploye(e.id); return; }
  closeModal(); render();
}
async function retirerEmploye(id, b) {
  if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = "Confirmer le retrait"; return; }
  await occupe(b, SB.supprimer("employes", "id=eq." + id), "Salarié retiré du personnel"); closeModal(); go("rh");
}
function attestation(id) {
  const e = RH.employes.find((x) => x.id === id), d = new Date().toLocaleDateString("fr-FR");
  modal(`<div class="doc"><img src="assets/logo.png" style="height:46px" alt=""><h2 style="text-align:center;margin-top:16px">ATTESTATION DE TRAVAIL</h2>
 <p>Je soussigné(e), ${esc(nomComplet(ME.profil))}, responsable des ressources humaines de <b>${esc(ME.org.nom)}</b>, atteste que <b>${esc(e.nom)}</b> est employé(e) au sein de notre société en qualité de <b>${esc(e.poste || "—")}</b>${e.service ? ", service " + esc(e.service) : ""}, sous contrat <b>${e.contrat}</b>${e.fin ? ` jusqu'au ${fr(e.fin)}` : ""}.</p>
 <p>La présente attestation est délivrée pour servir et valoir ce que de droit.</p><p style="text-align:right">Fait à ${esc(ME.org.ville || "Abidjan")}, le ${d}<br><br><i>Signature et cachet</i></p></div>
 <div class="row no-print" style="margin-top:12px"><span class="sp"></span><button class="btn ghost" onclick="closeModal()">Fermer</button><button class="btn" onclick="window.print()">Imprimer / PDF</button></div>`);
}

/* ---- Salarié : congés ---- */
let cg = { du: "", au: "" }, empChoisi = null;
VIEWS.employe = async () => {
  const E = ME.employes.find((x) => x.id === empChoisi) || ME.employes[0]; empChoisi = E.id;
  const [fiche] = await SB.lire("employes", "id=eq." + E.id);
  const [org] = await SB.lire("organisations", "id=eq." + fiche.org_id);
  const mes = await SB.lire("conges", "employe_id=eq." + E.id + "&order=cree_le.desc");
  const attente = mes.filter((c) => c.statut === "En attente").reduce((a, c) => a + c.jours, 0);
  const dispo = fiche.solde - attente;
  const n = cg.du && cg.au && cg.au >= cg.du ? joursOuvres(cg.du, cg.au) : 0;
  return `<div class="phone"><h1>Demande de congé</h1><p class="sub">${esc(fiche.nom)} · ${esc(org?.nom || "")}</p>
 ${ME.employes.length > 1 ? `<select onchange="empChoisi=this.value;render()" style="margin-bottom:12px">${ME.employes.map((x) => `<option value="${x.id}" ${x.id === E.id ? "selected" : ""}>${esc(x.poste || x.nom)}</option>`).join("")}</select>` : ""}
 <div class="card kpi" style="text-align:center"><div class="l">Solde disponible</div><div class="v" style="font-size:40px">${dispo} j</div>${attente ? `<div class="small muted">dont ${attente} j déjà demandés, en attente</div>` : ""}</div>
 <div class="card" style="margin-top:14px">
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
   <div><label for="cg-du">Du</label><input type="date" id="cg-du" value="${cg.du}" onchange="cg.du=this.value;render()"></div>
   <div><label for="cg-au">Au</label><input type="date" id="cg-au" value="${cg.au}" min="${cg.du}" onchange="cg.au=this.value;render()"></div>
  </div>
  ${cg.du ? calendrier(cg.du, cg.au) : ""}
  <div class="row" style="margin-top:12px"><span>Jours ouvrés décomptés</span><span class="sp"></span><b style="font-size:20px">${n}</b></div>
  <p class="small muted">Week-ends et jours fériés fixes (1er janv., 1er mai, 7 et 15 août, 1er et 15 nov., 25 déc.) exclus automatiquement.</p>
  ${n > dispo ? '<div class="alert red small">Le nombre de jours dépasse votre solde.</div>' : ""}
  <label for="motif" style="margin-top:10px">Motif (facultatif)</label><input type="text" id="motif" placeholder="Congé annuel" maxlength="200">
  <button class="btn" style="width:100%;margin-top:14px" ${!n || n > dispo ? "disabled" : ""} onclick="envoyerConge(this)">Envoyer à mon responsable</button>
 </div>
 ${mes.length ? `<div class="card" style="margin-top:14px"><h3>Mes demandes</h3>${mes.map((c) => `<div class="row" style="padding:8px 0"><span class="sp small">${fr(c.du)} → ${fr(c.au)} · ${c.jours} j</span><span class="pill ${c.statut === "Validé" ? "p-green" : c.statut === "Refusé" ? "p-red" : "p-gold"}">${c.statut}</span></div>`).join("")}</div>` : ""}
 </div>`;
};
function calendrier(du, au) {
  const d0 = new Date(du + "T12:00"), y = d0.getFullYear(), m = d0.getMonth(), first = new Date(y, m, 1, 12), nbJ = new Date(y, m + 1, 0).getDate();
  let h = `<div style="margin-top:14px;font-weight:700;text-transform:capitalize">${first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</div><div class="cal">${["L", "M", "M", "J", "V", "S", "D"].map((x) => `<b>${x}</b>`).join("")}`;
  for (let k = 0; k < (first.getDay() + 6) % 7; k++) h += "<span></span>";
  for (let j = 1; j <= nbJ; j++) {
    const d = new Date(y, m, j, 12), iso = d.toISOString().slice(0, 10), we = d.getDay() === 0 || d.getDay() === 6, ho = estFerie(d), inR = au && iso >= du && iso <= au;
    h += `<span class="${inR ? (we || ho ? "inwe" : "in") : we ? "we" : ho ? "ho" : ""}">${j}</span>`;
  }
  return h + "</div>";
}
async function envoyerConge(b) {
  await occupe(b, SB.rpc("demander_conge", { p_employe: empChoisi, p_du: cg.du, p_au: cg.au, p_motif: valeur("motif") }), "Demande envoyée à votre responsable");
  cg = { du: "", au: "" }; render();
}

/* ---- École ---- */
let filtreEcole = "";
VIEWS.ecole = async () => {
  const [st, diplomes] = await Promise.all([SB.rpc("stats_ecole"), SB.lire("diplomes", "ecole_id=eq." + ME.org.id + "&order=cree_le.desc")]);
  const ids = [...new Set(diplomes.map((d) => d.user_id))];
  const profils = ids.length ? await SB.lire("profils", "id=" + inListe(ids)) : [];
  const P = Object.fromEntries(profils.map((p) => [p.id, p]));
  const att = diplomes.filter((d) => d.statut === "en_attente");
  const fil = st.filieres.map((f) => ({ ...f, t: f.total ? Math.round(f.emploi / f.total * 100) : 0 }));
  const min = fil.length ? Math.min(...fil.map((f) => f.t)) : 0;
  const taux = st.valides ? Math.round(st.en_emploi / st.valides * 100) : 0;
  const q = filtreEcole.toLowerCase(), vus = diplomes.filter((d) => !q || (nomComplet(P[d.user_id]) + " " + d.intitule + " " + d.filiere).toLowerCase().includes(q));
  return bandeau(esc(ME.profil.prenoms.split(" ")[0] || ""), "Suivi de l'insertion · " + esc(ME.org.nom)) + `
<div class="grid g-tdb">
 <div class="grid" style="gap:16px;align-content:start">
  <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:16px">
   ${tuile(st.valides, "diplômés vérifiés", "ecole")}
   ${tuile(st.entreprises, "entreprises d'accueil", "orga")}
   ${tuile(att.length, "diplômes à valider", "doc")}
  </div>
  <div class="card"><h3>Insertion par filière</h3>
   <div class="donut">
    ${donut(taux, 100, taux + " %", taux >= 60 ? "var(--green)" : taux >= 30 ? "var(--orange)" : "var(--red)")}
    <div class="sp barres">${fil.length ? fil.map((f) => `<div class="small" style="margin-top:6px">${esc(f.n)}</div><div class="b"><div class="bar-h ${f.t === min ? "gold" : "vert"}"><i style="width:${f.t}%"></i></div><span class="small"><b>${f.t} %</b> <span class="muted">(${f.emploi}/${f.total})</span></span></div>`).join("") : '<p class="small muted">Les chiffres apparaîtront quand des diplômes auront été validés.</p>'}</div>
   </div>
   <p class="small muted" style="margin:10px 0 0">Anneau : part des diplômés vérifiés ayant un emploi enregistré sur Excellent HR. La filière la plus faible est en orange.</p>
  </div>
 </div>
 <div class="card"><div class="row" style="margin-bottom:6px"><h3 class="sp" style="margin:0">Validation des diplômes</h3><button class="btn sm ghost" ${att.length ? "" : "disabled"} onclick="validerTous(this)">Tout accepter</button></div>
  ${filtreEcole ? `<span class="puce" style="margin-bottom:6px">« ${esc(filtreEcole)} » <a href="#" style="color:#fff" onclick="filtreEcole='';render();return false">✕</a></span>` : ""}
  ${vus.length ? vus.map((d) => `<div class="ligne"><div class="avatar sm" style="cursor:default">${esc(initiales(nomComplet(P[d.user_id])))}</div><div class="sp"><b>${esc(nomComplet(P[d.user_id]))}</b><div class="small muted">${esc(d.intitule)}${d.filiere ? " · " + esc(d.filiere) : ""}${d.annee ? " · " + d.annee : ""}</div></div>${d.statut === "valide" ? '<span class="pill p-green">✔ Validé</span>' : d.statut === "refuse" ? '<span class="pill p-red">Non reconnu</span>' : `<button class="btn sm bleu" onclick="deciderDiplome('${d.id}',true,this)">Valider</button><button class="btn sm ghost" onclick="deciderDiplome('${d.id}',false,this)">Refuser</button>`}</div>`).join("") : '<div class="vide">Aucun diplôme déclaré pour le moment. Invitez vos anciens élèves à s\'inscrire et à déclarer leur diplôme.</div>'}
 </div>
</div>`;
};
async function deciderDiplome(id, ok, b) { await occupe(b, SB.rpc("decider_diplome", { p_id: id, p_valide: ok }), ok ? "Diplôme validé" : "Diplôme refusé"); render(); }
async function validerTous(b) { const r = await occupe(b, SB.rpc("valider_tous_diplomes")); toast(r.nombre + " diplôme(s) validé(s)"); render(); }

/* Les erreurs des actions sont déjà affichées par occupe() : on évite qu'elles remontent en double. */
window.addEventListener("unhandledrejection", (e) => { if (e.reason && e.reason.message) e.preventDefault(); });

/* ============ Démarrage ============ */
(async function demarrer() {
  const retour = SB.sessionDepuisAdresse();
  try { await chargerMoi(); } catch (e) { if (e.code === "session") ME = null; }
  const h = location.hash.slice(1);
  page = ME ? (pages().some(([k]) => k === h) ? h : pageDepart()) : (h === "connexion" ? "connexion" : "accueil");
  await render();
  if (retour === "recovery" && ME) {
    modal(`<h2>Choisissez un nouveau mot de passe</h2><input type="password" id="nv-mdp" autocomplete="new-password" placeholder="8 caractères au moins"><div class="row" style="margin-top:14px"><span class="sp"></span><button class="btn" onclick="if($('#nv-mdp').value.length<8)toast('Au moins 8 caractères');else occupe(this,SB.nouveauMotDePasse($('#nv-mdp').value),'Mot de passe changé').then(closeModal)">Enregistrer</button></div>`);
  }
})();
