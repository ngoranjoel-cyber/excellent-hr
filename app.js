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

/* ============ Navigation ============ */
function pages() {
  if (!ME) return [["accueil", "Accueil"], ["connexion", "Se connecter"]];
  const t = ME.profil.type, l = [];
  if (t === "candidat") l.push(["candidat", "Mon espace"], ["entretien", "Entretien IA"]);
  if (t === "entreprise") l.push(...(ME.org ? [["offres", "Offres"], ["recruteur", "Présélection"], ["rh", "Personnel"]] : [["organisation", "Mon entreprise"]]));
  if (t === "ecole") l.push(ME.org ? ["ecole", "Insertion & diplômes"] : ["organisation", "Mon école"]);
  if (ME.employes.length) l.push(["employe", "Mes congés"]);
  l.push(["profil", "Profil"]);
  return l;
}
function pageDepart() { return pages()[0][0]; }
let page = "accueil", rendu = 0;
function go(p) { page = p; try { history.replaceState(null, "", "#" + p); } catch (e) { } render(); window.scrollTo(0, 0); }
async function render() {
  const liste = pages();
  if (!liste.some(([k]) => k === page)) page = liste[0][0];
  $("#nav").innerHTML = liste.map(([k, l]) => `<button class="${k === page ? "on" : ""}" onclick="${k === "connexion" ? "modeAuth='connexion';" : ""}go('${k}')">${l}</button>`).join("");
  $("#qui").innerHTML = ME ? `<span class="avatar sm" title="${esc(ME.email || "")}">${esc(initiales(nomComplet(ME.profil)))}</span>` : "";
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
  const villes = [...new Set(CAND.offres.map((o) => o.ville).filter(Boolean))];
  return `<h1>Bonjour ${esc(p.prenoms.split(" ")[0] || "")} 👋</h1><p class="sub">Espace Diplômés &amp; étudiants</p>
<div class="grid g2">
 <div>
  <div class="card">
   <div class="row"><div class="avatar">${esc(initiales(nomComplet(p)))}</div><div class="sp"><b>${esc(nomComplet(p))}</b><div class="small muted">${esc([p.formation, p.ville].filter(Boolean).join(" · ") || "Complétez votre profil")}</div></div>
   ${verifie ? '<span class="pill p-green">✔ Diplôme vérifié</span>' : CAND.diplomes.length ? '<span class="pill p-gray">Diplôme en attente</span>' : ""}</div>
   <div style="margin-top:14px" class="small muted">Profil complété à ${compl} %${compl < 100 ? ` · <a href="#" onclick="go('profil');return false">compléter</a>` : ""}</div>
   <div class="bar-h" style="margin-top:6px"><i style="width:${compl}%"></i></div>
  </div>
  ${aFaire.map((c) => { const o = CAND.toutes.find((x) => x.id === c.offre_id) || {}; return `<div class="alert gold" style="margin-top:14px"><b>Entretien IA à passer</b><div class="small">${esc(o.titre)} — ${esc(nomOrg(o.org_id))}${o.limite ? " · avant le " + fr(o.limite) : ""}</div><button class="btn gold sm" style="margin-top:10px" onclick="ouvrirEntretien('${c.id}')">${c.consentement ? "Reprendre l'entretien" : "Commencer l'entretien"}</button></div>`; }).join("")}
  <div class="card" style="margin-top:14px"><div class="row"><h3 class="sp" style="margin:0">Mes diplômes</h3><button class="btn sm ghost" onclick="ajouterDiplome()">+ Déclarer</button></div>
   ${CAND.diplomes.length ? CAND.diplomes.map((d) => `<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line)"><div class="sp"><b>${esc(d.intitule)}</b><div class="small muted">${esc((CAND.ecoles.find((e) => e.id === d.ecole_id) || {}).nom || "")}${d.annee ? " · " + d.annee : ""}</div></div><span class="pill ${d.statut === "valide" ? "p-green" : d.statut === "refuse" ? "p-red" : "p-gray"}">${d.statut === "valide" ? "✔ Vérifié" : d.statut === "refuse" ? "Non reconnu" : "En attente de l'école"}</span>${d.statut !== "valide" ? `<button class="btn sm ghost" onclick="retirerDiplome('${d.id}',this)" title="Retirer">✕</button>` : ""}</div>`).join("") : '<p class="small muted">Déclarez votre diplôme : votre école le vérifiera et vous obtiendrez le badge « Diplôme vérifié ».</p>'}
  </div>
  <div class="card" style="margin-top:14px"><h3>Mes candidatures</h3>
   ${CAND.candidatures.length ? CAND.candidatures.map((x) => { const o = CAND.toutes.find((y) => y.id === x.offre_id) || {}; return `<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line)"><div class="sp"><b>${esc(o.titre || "Offre retirée")}</b><div class="small muted">${esc(nomOrg(o.org_id))} · ${esc(o.ville || "")}</div></div><span class="pill ${STATUTS[x.statut] || "p-gray"}">${esc(x.statut)}</span></div>`; }).join("") : '<p class="small muted">Aucune candidature pour le moment.</p>'}
  </div>
 </div>
 <div class="card"><h3>Offres pour vous</h3>
  <div class="grid filt" style="gap:8px;margin-bottom:10px">
   <input type="search" placeholder="Poste, entreprise, secteur…" value="${esc(filtre.q)}" oninput="filtre.q=this.value;majOffres()">
   <select onchange="filtre.type=this.value;majOffres()"><option value="">Tous types</option>${["Emploi", "Stage", "Alternance"].map((t) => `<option ${filtre.type === t ? "selected" : ""}>${t}</option>`).join("")}</select>
   <select onchange="filtre.ville=this.value;majOffres()"><option value="">Toutes villes</option>${villes.map((v) => `<option ${filtre.ville === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
  </div>
  <div id="offres">${listeOffres()}</div>
  <p class="small muted" style="margin-top:10px">Le pourcentage est une compatibilité estimée à partir de votre formation et de votre ville.</p>
 </div>
</div>`;
};
function listeOffres() {
  const deja = new Set(CAND.candidatures.map((x) => x.offre_id));
  const l = CAND.offres.filter((o) => (!filtre.type || o.type === filtre.type) && (!filtre.ville || o.ville === filtre.ville) && (!filtre.q || (o.titre + nomOrg(o.org_id) + o.secteur).toLowerCase().includes(filtre.q.toLowerCase())))
    .map((o) => ({ o, c: compat(o) })).sort((a, b) => b.c - a.c);
  return l.length ? l.map(({ o, c }) => `<div class="row" style="padding:11px 0;border-bottom:1px solid var(--line)"><div class="sp"><b>${esc(o.titre)}</b><div class="small muted">${esc(nomOrg(o.org_id))} · ${esc(o.ville)} · ${o.type}</div>${o.description ? `<div class="small" style="margin-top:3px">${esc(o.description.slice(0, 140))}${o.description.length > 140 ? "…" : ""}</div>` : ""}</div><span class="pill ${c >= 80 ? "p-green" : c >= 65 ? "p-navy" : "p-gray"}">${c} %</span>${deja.has(o.id) ? '<span class="small muted">Déjà postulé</span>' : `<button class="btn sm" onclick="postuler('${o.id}',this)">Postuler</button>`}</div>`).join("") : '<p class="muted">Aucune offre ne correspond pour le moment.</p>';
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
  if (!c) return `<div class="phone"><div class="card" style="text-align:center"><h2>Aucun entretien à passer</h2><p class="muted">Postulez à une offre : l'entretien IA vous sera proposé aussitôt.</p><button class="btn" onclick="go('candidat')">Voir les offres</button></div></div>`;
  candEntretien = c.id;
  const [o] = await SB.lire("offres", "id=eq." + c.offre_id);
  const [org] = await SB.lire("organisations", "id=eq." + o.org_id);
  const Q = questions(o, org?.nom || "cette entreprise");
  if (c.statut !== "Entretien IA à passer") return `<div class="phone"><div class="card" style="text-align:center"><div style="font-size:42px">✅</div><h2>Entretien envoyé</h2><p class="muted">Vos réponses ont été transmises à ${esc(org?.nom)}. Un recruteur examinera votre candidature : l'IA ne prend aucune décision seule.</p><button class="btn" onclick="candEntretien=null;go('candidat')">Retour à mon espace</button></div></div>`;
  if (!c.consentement) return `<div class="phone"><div class="card">
   <span class="pill p-gold">Entretien assisté par l'IA</span><h2 style="margin-top:10px">${esc(o.titre)}</h2><p class="muted">${esc(org?.nom)} · 5 questions · environ 15 min</p>
   <div class="alert navy small"><b>Avant de commencer :</b><ul style="margin:6px 0 0;padding-left:18px"><li>Vous répondez par écrit à des questions posées automatiquement.</li><li>Seul le contenu de vos réponses est évalué (pas votre visage, votre voix ou votre accent).</li><li>Le score de cette version est une estimation simple, sans IA réelle ; la décision revient toujours à un recruteur.</li><li>Votre progression est enregistrée : vous pouvez reprendre plus tard.</li></ul></div>
   <label style="margin-top:14px;display:flex;gap:8px;align-items:flex-start;color:var(--ink);font-weight:500"><input type="checkbox" id="ok" style="margin-top:4px"> J'ai compris et j'accepte de passer cet entretien.</label>
   <button class="btn" style="margin-top:12px;width:100%" onclick="consentir(this)">Commencer</button>
   <button class="btn ghost sm" style="margin-top:10px" onclick="retirerCandidature('${c.id}',this)">Retirer ma candidature</button></div></div>`;
  const i = c.etape, q = Q[i], rep = c.reponses[i] || {};
  return `<div class="phone"><div class="card">
   <div class="row"><span class="small muted">Question ${i + 1} sur ${Q.length}</span><span class="sp"></span><span class="pill p-navy">${esc(o.titre)}</span></div>
   <div class="prog">${Q.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
   <div class="small muted">🤖 Assistant Excellent HR</div>
   <div class="bubble">${esc(q.q)}</div>
   ${rep.r1 ? `<div class="bubble me">${esc(rep.r1)}</div><div class="small muted">🤖 Relance</div><div class="bubble">${esc(q.relance)}</div>` : ""}
   <textarea id="rep" placeholder="Écrivez votre réponse…" maxlength="3000"></textarea>
   <div class="row" style="margin-top:10px"><span class="small muted">Progression enregistrée</span><span class="sp"></span><button class="btn" onclick="repondre(this)">${!rep.r1 ? "Envoyer" : (i < Q.length - 1 ? "Question suivante" : "Terminer l'entretien")}</button></div>
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
VIEWS.offres = async () => {
  const offres = await SB.lire("offres", "org_id=eq." + ME.org.id + "&order=cree_le.desc");
  const cands = offres.length ? await SB.lire("candidatures", "offre_id=" + inListe(offres.map((o) => o.id)) + "&select=offre_id,statut") : [];
  const n = (id, f) => cands.filter((c) => c.offre_id === id && (!f || f(c))).length;
  return `<div class="row"><div class="sp"><h1>Offres</h1><p class="sub" style="margin:0">${esc(ME.org.nom)}</p></div><button class="btn gold" onclick="formOffre()">+ Publier une offre</button></div>
<div class="card" style="margin-top:18px;overflow-x:auto">${offres.length ? `<table><tr><th>Offre</th><th>Type</th><th>Candidatures</th><th>Entretiens passés</th><th>Statut</th><th></th></tr>
${offres.map((o) => `<tr><td><b>${esc(o.titre)}</b><div class="small muted">${esc(o.ville)} · publiée le ${fr(o.cree_le)}</div></td><td>${o.type}</td><td>${n(o.id)}</td><td>${n(o.id, (c) => c.statut !== "Entretien IA à passer")}</td>
<td><span class="pill ${o.statut === "ouverte" ? "p-green" : "p-gray"}">${o.statut === "ouverte" ? "Ouverte" : "Fermée"}</span></td>
<td><div class="row" style="justify-content:flex-end"><button class="btn sm" onclick="offreChoisie='${o.id}';go('recruteur')">Présélection</button><button class="btn sm ghost" onclick="formOffre('${o.id}')">Modifier</button></div></td></tr>`).join("")}</table>` : '<p class="muted">Aucune offre. Publiez la première : elle sera visible par tous les candidats inscrits.</p>'}</div>`;
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
VIEWS.recruteur = async () => {
  const offres = await SB.lire("offres", "org_id=eq." + ME.org.id + "&order=cree_le.desc");
  if (!offres.length) return `<h1>Présélection</h1><div class="card"><p class="muted">Publiez d'abord une offre.</p><button class="btn gold" onclick="go('offres')">Mes offres</button></div>`;
  const o = offres.find((x) => x.id === offreChoisie) || offres[0]; offreChoisie = o.id;
  const toutes = await SB.lire("candidatures", "offre_id=eq." + o.id);
  const ids = toutes.map((c) => c.user_id);
  const [profils, diplomes] = ids.length ? await Promise.all([SB.lire("profils", "id=" + inListe(ids)), SB.lire("diplomes", "user_id=" + inListe(ids) + "&statut=eq.valide")]) : [[], []];
  const emps = await SB.lire("employes", "org_id=eq." + ME.org.id + "&select=candidature_id");
  PRE = { o, toutes, profils: Object.fromEntries(profils.map((p) => [p.id, p])), verifies: new Set(diplomes.map((d) => d.user_id)), embauches: new Set(emps.map((e) => e.candidature_id)) };
  const list = toutes.filter((c) => c.scores).sort((a, b) => scoreDe(b, o.poids) - scoreDe(a, o.poids));
  const attente = toutes.length - list.length, nb = list.filter((c) => c.shortlist).length;
  const jours = Math.max(0, Math.floor((Date.now() - new Date(o.cree_le)) / 864e5));
  return `<div class="row"><div class="sp"><h1>Présélection</h1>
 <select onchange="offreChoisie=this.value;render()" style="max-width:420px">${offres.map((x) => `<option value="${x.id}" ${x.id === o.id ? "selected" : ""}>${esc(x.titre)}${x.statut === "fermee" ? " (fermée)" : ""}</option>`).join("")}</select></div>
<button class="btn ghost" onclick="ouvrirPoids()">⚙ Grille d'évaluation</button>
<button class="btn gold" ${o.shortlist_validee || !nb ? "disabled" : ""} onclick="validerSL()">${o.shortlist_validee ? "Short-list validée ✔" : "Valider la short-list (" + nb + ")"}</button></div>
<div class="grid g4" style="margin:18px 0">
 <div class="card kpi"><div class="v">${list.length}</div><div class="l">entretiens IA terminés</div></div>
 <div class="card kpi"><div class="v">${attente}</div><div class="l">entretiens en attente</div></div>
 <div class="card kpi"><div class="v">${list.length ? Math.round(list.reduce((a, c) => a + scoreDe(c, o.poids), 0) / list.length) : "—"}</div><div class="l">score moyen / 100</div></div>
 <div class="card kpi"><div class="v">${jours} j</div><div class="l">depuis la publication</div></div>
</div>
<div class="alert navy small" style="margin-bottom:14px">Classement proposé à partir des entretiens, <b>modifiable case par case</b>. Le score de cette version est une estimation simple (sans IA réelle) : lisez les réponses avant de décider.</div>
<div class="card" style="overflow-x:auto">${list.length ? `<table>
<tr><th>Short-list</th><th>Candidat</th><th>Statut</th><th>Score</th><th>${CRIT.map((c, i) => c.split(" ")[0] + " " + o.poids[i] + "%").join(" · ")}</th><th></th></tr>
${list.map((c, k) => { const p = PRE.profils[c.user_id], s = scoreDe(c, o.poids); return `<tr class="${c.shortlist ? "sel" : ""}"><td><input type="checkbox" ${c.shortlist ? "checked" : ""} ${o.shortlist_validee || c.statut !== "Entretien IA passé" ? "disabled" : ""} onchange="basculerSL('${c.id}',this)"></td>
<td><div class="row"><div class="avatar ${k < 3 ? "" : "gold"}" style="width:34px;height:34px;font-size:13px">${esc(initiales(nomComplet(p)))}</div><div><b>${esc(nomComplet(p))}</b><div class="small muted">${PRE.verifies.has(c.user_id) ? "✔ Diplôme vérifié" : "Diplôme non vérifié"}${p?.formation ? " · " + esc(p.formation) : ""}</div></div></div></td>
<td><span class="pill ${STATUTS[c.statut] || "p-gray"}">${esc(c.statut)}</span></td>
<td><span class="score" style="color:${s >= 75 ? "var(--green)" : s >= 65 ? "var(--navy)" : "var(--muted)"}">${s}</span></td>
<td class="small muted">${c.scores.join(" · ")}</td><td><button class="btn sm ghost" onclick="detail('${c.id}')">Détail</button></td></tr>`; }).join("")}
</table>` : '<p class="muted">Aucun entretien terminé pour cette offre pour le moment.</p>'}</div>`;
};
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
let RH = null;
VIEWS.rh = async () => {
  const employes = await SB.lire("employes", "org_id=eq." + ME.org.id + "&order=cree_le.desc");
  const conges = employes.length ? await SB.lire("conges", "employe_id=" + inListe(employes.map((e) => e.id)) + "&order=cree_le.desc") : [];
  RH = { employes, conges };
  const nomE = (id) => employes.find((e) => e.id === id)?.nom || "—";
  const fins = employes.filter((e) => e.fin && joursAvant(e.fin) <= 45 && joursAvant(e.fin) >= 0);
  const att = conges.filter((c) => c.statut === "En attente");
  const n = (t) => employes.filter((e) => e.contrat === t).length;
  return `<div class="row"><div class="sp"><h1>Gestion du personnel</h1><p class="sub" style="margin:0">${esc(ME.org.nom)}</p></div><button class="btn gold" onclick="formEmploye()">+ Ajouter un salarié</button></div>
<div class="grid g4" style="margin-top:18px">
 <div class="card kpi"><div class="v">${employes.length}</div><div class="l">employés</div></div>
 <div class="card kpi"><div class="v">${n("CDI")} / ${n("CDD")} / ${n("Stage") + n("Alternance")}</div><div class="l">CDI / CDD / stages-alternances</div></div>
 <div class="card kpi"><div class="v">${att.length}</div><div class="l">congés à valider</div></div>
 <div class="card kpi"><div class="v" style="color:${fins.length ? "var(--red)" : "var(--navy)"}">${fins.length}</div><div class="l">contrats finissant sous 45 j</div></div>
</div>
${fins.map((e) => `<div class="alert red" style="margin-top:12px"><b>Fin de contrat :</b> ${esc(e.nom)} (${e.contrat}) le ${fr(e.fin)} — dans ${joursAvant(e.fin)} jour(s).</div>`).join("")}
<div class="grid g2" style="margin-top:16px">
 <div class="card" style="overflow-x:auto"><h3>Effectif</h3>${employes.length ? `<table><tr><th>Nom</th><th>Poste</th><th>Contrat</th><th>Fin</th><th>Solde</th><th></th></tr>
 ${employes.map((e) => `<tr><td><b>${esc(e.nom)}</b>${e.candidature_id ? ' <span class="pill p-gold">recruté(e) ici</span>' : ""}<div class="small muted">${esc(e.service)}${e.user_id ? " · compte relié" : ""}</div></td><td>${esc(e.poste)}</td><td><span class="pill ${e.contrat === "CDI" ? "p-navy" : e.contrat === "CDD" ? "p-gray" : "p-gold"}">${e.contrat}</span></td><td class="small">${fr(e.fin)}</td><td>${e.solde} j</td>
 <td><div class="row" style="justify-content:flex-end"><button class="btn sm ghost" onclick="attestation('${e.id}')">Attestation</button><button class="btn sm ghost" onclick="formEmploye('${e.id}')">Modifier</button></div></td></tr>`).join("")}
 </table>` : '<p class="muted">Ajoutez vos salariés, ou retenez un candidat depuis la présélection.</p>'}</div>
 <div class="card"><h3>Demandes de congé</h3>
 ${conges.length ? conges.map((c) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="sp"><b>${esc(nomE(c.employe_id))}</b><div class="small muted">du ${fr(c.du)} au ${fr(c.au)} · ${c.jours} j ouvrés${c.motif ? " · " + esc(c.motif) : ""}</div></div>
 ${c.statut === "En attente" ? `<button class="btn sm" onclick="deciderConge('${c.id}',true,this)">Valider</button><button class="btn sm ghost" onclick="deciderConge('${c.id}',false,this)">Refuser</button>` : `<span class="pill ${c.statut === "Validé" ? "p-green" : "p-red"}">${c.statut}</span>`}</div>`).join("") : '<p class="muted">Aucune demande.</p>'}
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
  await occupe(b, SB.supprimer("employes", "id=eq." + id), "Salarié retiré du personnel"); closeModal(); render();
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
VIEWS.ecole = async () => {
  const [st, diplomes] = await Promise.all([SB.rpc("stats_ecole"), SB.lire("diplomes", "ecole_id=eq." + ME.org.id + "&order=cree_le.desc")]);
  const ids = [...new Set(diplomes.map((d) => d.user_id))];
  const profils = ids.length ? await SB.lire("profils", "id=" + inListe(ids)) : [];
  const P = Object.fromEntries(profils.map((p) => [p.id, p]));
  const att = diplomes.filter((d) => d.statut === "en_attente");
  const fil = st.filieres.map((f) => ({ ...f, t: f.total ? Math.round(f.emploi / f.total * 100) : 0 }));
  const min = fil.length ? Math.min(...fil.map((f) => f.t)) : 0;
  const taux = st.valides ? Math.round(st.en_emploi / st.valides * 100) : 0;
  return `<h1>Suivi de l'insertion</h1><p class="sub">${esc(ME.org.nom)}</p>
<div class="grid g4">
 <div class="card kpi"><div class="v">${st.valides}</div><div class="l">diplômés vérifiés sur la plateforme</div></div>
 <div class="card kpi"><div class="v">${taux} %</div><div class="l">en emploi via Excellent HR</div></div>
 <div class="card kpi"><div class="v">${st.entreprises}</div><div class="l">entreprises d'accueil</div></div>
 <div class="card kpi"><div class="v">${att.length}</div><div class="l">diplômes à valider</div></div>
</div>
<div class="grid g2" style="margin-top:16px">
 <div class="card"><h3>Insertion par filière</h3>
  ${fil.length ? fil.map((f) => `<div class="crit" style="grid-template-columns:140px 1fr 70px"><span>${esc(f.n)}</span><div class="bar-h ${f.t === min ? "gold" : ""}"><i style="width:${f.t}%"></i></div><b style="color:${f.t === min ? "#8A6A1E" : "inherit"}">${f.t} % <span class="muted small">(${f.emploi}/${f.total})</span></b></div>`).join("") + '<p class="small muted" style="margin-top:10px">Diplômés vérifiés ayant un emploi enregistré sur Excellent HR. La filière la plus faible est signalée en doré.</p>' : '<p class="muted">Les chiffres apparaîtront quand des diplômes auront été validés.</p>'}</div>
 <div class="card"><div class="row"><h3 class="sp" style="margin:0">Validation des diplômes</h3><button class="btn sm" ${att.length ? "" : "disabled"} onclick="validerTous(this)">Tout valider</button></div>
  ${diplomes.length ? diplomes.map((d) => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="sp"><b>${esc(nomComplet(P[d.user_id]))}</b><div class="small muted">${esc(d.intitule)}${d.filiere ? " · " + esc(d.filiere) : ""}${d.annee ? " · " + d.annee : ""}</div></div>${d.statut === "valide" ? '<span class="pill p-green">✔ Validé</span>' : d.statut === "refuse" ? '<span class="pill p-red">Non reconnu</span>' : `<button class="btn sm" onclick="deciderDiplome('${d.id}',true,this)">Valider</button><button class="btn sm ghost" onclick="deciderDiplome('${d.id}',false,this)">Refuser</button>`}</div>`).join("") : '<p class="muted small">Aucun diplôme déclaré pour le moment. Invitez vos anciens élèves à s\'inscrire et à déclarer leur diplôme.</p>'}
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
