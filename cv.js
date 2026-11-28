/* Excellent HR — CV du candidat
   - profil structuré : photo, profil, cursus scolaire, formations, expériences, domaines clés, informatique, langues,
     projets, références, centres d'intérêt
   - import d'un CV PDF / Word / texte, lu dans le navigateur (le fichier ne quitte pas l'appareil), photo comprise
   - 6 modèles de CV (dont « Signature » et « Épuré », calqués sur de vrais CV), téléchargement en PDF
   - adaptation du CV à une offre (mots-clés, accroche, ordre des compétences), puis candidature avec ce CV
   Le moteur est « par mots-clés » ; la fonction adapterAvecIA() est l'emplacement prévu pour brancher une IA. */

IC.cv = '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><circle cx="11" cy="10" r="2"/><path d="M8 16c.6-1.6 1.8-2.4 3-2.4s2.4.8 3 2.4"/>';
IC.importer = '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>';
IC.etoile = '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>';
IC.baguette = '<path d="M5 19L16 8"/><path d="M15 4v2M19 8h2M18 5l1.5-1.5M13 6l1 1"/>';
IC.photo = '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>';

const CV_VIDE = () => ({ titre: "", resume: "", photo: "", contact: { email: "", telephone: "", ville: "", lien: "", extra: "" }, cursus: [], formations: [], experiences: [], competences: [], informatique: [], langues: [], projets: [], references: [], interets: [] });
const CV_COULEURS = { marine: "#24477F", vert: "#3F7A1E", nuit: "#1F2A44", bordeaux: "#7A2335", ardoise: "#3D4B57", terre: "#9A4E2F" };
const CV_MODELES = {
  signature: ["Signature", "Barre latérale, photo, rubriques en bandeaux"],
  epure: ["Épuré", "Une colonne, lisible par les logiciels de recrutement (ATS)"],
  classique: ["Classique", "Sobre et lisible, idéal pour les grandes entreprises"],
  moderne: ["Moderne", "Colonne de couleur à gauche"],
  bambou: ["Bambou", "Style dossier Excellent HR"],
  compact: ["Compact", "Tout tient sur une page"],
};
const CV_FORMES = { rond: "Rond à anneau", galet: "Galet", feuille: "Feuille", arche: "Arche", hexagone: "Hexagone", goutte: "Goutte" };
/* La base n'accepte que ces valeurs dans ses colonnes : le vrai choix (modèle, couleur, forme) voyage dans le contenu. */
const CV_BASE = { modeles: ["classique", "moderne", "bambou", "compact"], couleurs: ["vert", "nuit", "bordeaux", "ardoise", "terre"] };
const RUBRIQUES = {
  cursus: { titre: "Cursus scolaire", vide: "Ajoutez vos diplômes, du plus récent au plus ancien (Master, Licence, BTS, Baccalauréat…).", champs: [["diplome", "Diplôme", "Diplôme d'Ingénieur Pétrole & Énergie", 1], ["etablissement", "Établissement", "INP-HB"], ["ville", "Ville", "Yamoussoukro / Côte d'Ivoire"], ["debut", "Début", "2021"], ["fin", "Fin", "2024"], ["mention", "Mention / détails", "Mention Bien · major de promotion", 1]] },
  formations: { titre: "Formations et certifications", vide: "Formations courtes, certifications, habilitations (HSE, informatique, langues…).", champs: [["intitule", "Intitulé", "Habilitation électrique B1V", 1], ["organisme", "Organisme", "APAVE"], ["annee", "Année", "2025"]] },
  experiences: { titre: "Expériences professionnelles", vide: "Emplois, stages, missions, bénévolat : tout ce qui montre ce que vous savez faire.", champs: [["poste", "Poste", "Superviseur QHSE", 1], ["entreprise", "Entreprise", "ORWASTE – Groupe ORTEC"], ["lieu", "Lieu", "Abidjan"], ["debut", "Début", "Août 2026"], ["fin", "Fin", "Présent"], ["type", "Type (facultatif)", "Stage, CDD, mission…"], ["missions", "Missions et résultats (une par ligne)", "Mise en œuvre des procédures QHSE sur les sites\nConformité ISO 9001, 14001, 45001", 2]] },
  informatique: { titre: "Informatique et logiciels", vide: "Les logiciels que vous maîtrisez, avec leur usage (Aspen HYSYS – simulation de procédés…).", champs: [["logiciel", "Logiciel", "Aspen HYSYS"], ["detail", "Usage", "Simulation de procédés"]] },
  langues: { titre: "Langues", vide: "Français, anglais… avec votre niveau.", champs: [["langue", "Langue", "Anglais"], ["niveau", "Niveau", "Professionnel"]] },
  projets: { titre: "Projets et réalisations", vide: "Travaux marquants : modèle, étude, mise en service, projet de fin d'études…", champs: [["titre", "Projet", "Modèle prédictif du PCS du gaz livré à la centrale d'Azito IV", 1], ["date", "Date", "Sept. 2024"]] },
  references: { titre: "Références", vide: "Personnes qui peuvent parler de votre travail (avec leur accord).", champs: [["nom", "Nom", "Armel KAUDJHIS"], ["poste", "Fonction, entreprise", "Superviseur Onshore, Foxtrot International"], ["telephone", "Téléphone", "+225 07 09 81 02 86"], ["email", "E-mail", "nom@entreprise.com"]] },
};
const LISTES = ["cursus", "formations", "experiences", "informatique", "langues", "projets", "references"];
let CVD = null, CVM = { modele: "classique", couleur: "vert", forme: "rond" }, cvSale = false, cvMinuteur = null, IMPORT = null, ADAPT = null;

/* ---------- Outils ---------- */
const nrm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const copie = (o) => JSON.parse(JSON.stringify(o));
const maj1 = (s) => String(s || "").replace(/^./, (x) => x.toUpperCase());
function miseDe(m) {
  m = Object.assign({}, m || {});
  return { modele: CV_MODELES[m.modele] ? m.modele : "classique", couleur: CV_COULEURS[m.couleur] ? m.couleur : "vert", forme: CV_FORMES[m.forme] ? m.forme : "rond" };
}
function cvNormaliser(c) {
  const v = CV_VIDE(), r = Object.assign(v, c || {});
  r.contact = Object.assign(CV_VIDE().contact, (c && c.contact) || {});
  LISTES.forEach((k) => { r[k] = Array.isArray(r[k]) ? r[k].filter((e) => e && typeof e === "object") : []; });
  ["competences", "interets"].forEach((k) => { r[k] = Array.isArray(r[k]) ? r[k].map(String).filter(Boolean) : []; });
  r.photo = typeof r.photo === "string" && r.photo.startsWith("data:image/") ? r.photo : "";
  delete r.mise;
  return r;
}
function cvCompletude(c) {
  if (!c) return 0;
  const pts = [c.titre, c.resume, c.contact.email || c.contact.telephone, c.cursus.length, c.experiences.length, c.competences.length >= 3, c.langues.length];
  return Math.round(pts.filter(Boolean).length / pts.length * 100);
}
let CV_INDISPO = false; /* vrai tant que supabase/mise-a-jour-cv.sql n'a pas été lancé */
async function chargerCV() {
  let r = null;
  try { [r] = await SB.lire("cv", "user_id=eq." + ME.id); CV_INDISPO = false; }
  catch (e) { if (e.code === "session") throw e; CV_INDISPO = true; }
  const p = ME.profil;
  if (r) { CVM = miseDe((r.contenu && r.contenu.mise) || { modele: r.modele, couleur: r.couleur }); CVD = cvNormaliser(r.contenu); }
  else {
    CVD = CV_VIDE(); CVM = miseDe({ modele: "signature", couleur: "marine" });
    CVD.titre = p.formation || ""; CVD.contact.ville = p.ville || ""; CVD.contact.telephone = p.telephone || ""; CVD.contact.email = ME.email || "";
  }
  cvSale = false;
  return !!r;
}
async function enregistrerCV(b, silencieux) {
  if (CV_INDISPO) return modal(`<h2>Mise à jour de la base à faire</h2><p>Pour enregistrer les CV, l'administrateur doit lancer une fois le fichier <code>supabase/mise-a-jour-cv.sql</code> dans Supabase (SQL Editor).</p><div class="row"><span class="sp"></span><button class="btn" onclick="closeModal()">Compris</button></div>`);
  const contenu = Object.assign({}, CVD, { mise: CVM });
  await occupe(b, SB.rpc("enregistrer_cv", { p_contenu: contenu, p_modele: CV_BASE.modeles.includes(CVM.modele) ? CVM.modele : "classique", p_couleur: CV_BASE.couleurs.includes(CVM.couleur) ? CVM.couleur : "nuit" }), silencieux ? undefined : "CV enregistré");
  cvSale = false; majEtatCV();
}
function majEtatCV() {
  const e = $("#cv-etat"); if (e) { e.textContent = cvSale ? "Modifications non enregistrées" : "Tout est enregistré"; e.className = "cv-etat" + (cvSale ? " sale" : ""); }
  const g = $("#cv-compl"); if (g) g.textContent = cvCompletude(CVD) + " %";
}
function cvModifie() {
  cvSale = true; majEtatCV();
  clearTimeout(cvMinuteur); cvMinuteur = setTimeout(majApercu, 250);
}
function majApercu() { const a = $("#cv-apercu"); if (a) { a.innerHTML = rendreCV(CVD, CVM, nomComplet(ME.profil)); ajusterApercus(); } }
/* Les aperçus sont des pages A4 (794 px) réduites à la largeur disponible. */
function ajusterApercus() {
  document.querySelectorAll(".cv-apercu").forEach((a) => {
    const d = a.querySelector(".cvdoc"); if (!d) return;
    const k = Math.min(1, a.clientWidth / 794);
    d.style.transform = `scale(${k})`; a.style.height = Math.ceil(d.offsetHeight * k) + "px";
  });
}
window.addEventListener("resize", () => { clearTimeout(window._aj); window._aj = setTimeout(ajusterApercus, 120); });
function apresRendu() { ajusterApercus(); }

/* ---------- Édition ---------- */
function cvSet(champ, v) { CVD[champ] = v; cvModifie(); }
function cvSetC(champ, v) { CVD.contact[champ] = v; cvModifie(); }
function cvSetE(k, i, champ, v) { CVD[k][i][champ] = v; cvModifie(); }
function majRubrique(k) { const el = $("#rub-" + k); if (el) el.outerHTML = rubriqueListe(k); cvModifie(); }
function cvAjouter(k) { CVD[k].push({}); majRubrique(k); const el = document.querySelectorAll(`#rub-${k} .cv-entree`); el[el.length - 1]?.querySelector("input,textarea")?.focus(); }
function cvRetirer(k, i) { CVD[k].splice(i, 1); majRubrique(k); }
function cvBouger(k, i, d) { const j = i + d, l = CVD[k]; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; majRubrique(k); }
function rubriqueListe(k) {
  const R = RUBRIQUES[k], l = CVD[k];
  return `<div class="card cv-rub" id="rub-${k}"><div class="row" style="margin-bottom:6px"><h3 class="sp" style="margin:0">${R.titre}</h3><span class="small muted">${l.length || ""}</span><button class="btn sm ghost" onclick="cvAjouter('${k}')">${ico("plus", 15)} Ajouter</button></div>
  ${l.length ? l.map((e, i) => `<div class="cv-entree"><div class="cv-champs">${R.champs.map(([f, lab, ph, t]) => `<div class="${t ? "large" : ""}"><label>${lab}</label>${t === 2
    ? `<textarea rows="4" oninput="cvSetE('${k}',${i},'${f}',this.value)" placeholder="${esc(ph)}">${esc(e[f] || "")}</textarea>`
    : `<input type="text" value="${esc(e[f] || "")}" oninput="cvSetE('${k}',${i},'${f}',this.value)" placeholder="${esc(ph)}">`}</div>`).join("")}</div>
    <div class="cv-actions">${i ? `<button class="ico-btn" title="Monter" aria-label="Monter" onclick="cvBouger('${k}',${i},-1)">↑</button>` : ""}<button class="ico-btn" title="Retirer" aria-label="Retirer" onclick="cvRetirer('${k}',${i})">${ico("croix", 15)}</button></div></div>`).join("")
    : `<p class="small muted" style="margin:4px 0 0">${R.vide}</p>`}</div>`;
}
function puces(k, ph) {
  return `<div class="cv-puces" id="puces-${k}">${CVD[k].map((x, i) => `<span class="chip">${esc(x)}<button title="Retirer" aria-label="Retirer ${esc(x)}" onclick="retirerPuce('${k}',${i})">×</button></span>`).join("")}
  <input type="text" placeholder="${esc(ph)}" onkeydown="ajouterPuce(event,'${k}',this)" onblur="ajouterPuce(null,'${k}',this)"></div>`;
}
function ajouterPuce(e, k, inp) {
  if (e && e.key !== "Enter" && e.key !== ",") return;
  if (e) e.preventDefault();
  const v = inp.value.split(/[,;]/).map((x) => x.trim()).filter((x) => x.length > 1);
  if (!v.length) return;
  v.forEach((x) => { if (!CVD[k].some((y) => nrm(y) === nrm(x))) CVD[k].push(x.slice(0, 80)); });
  inp.value = ""; const z = $("#puces-" + k); z.outerHTML = puces(k, inp.placeholder); $("#puces-" + k + " input").focus(); cvModifie();
}
function retirerPuce(k, i) { CVD[k].splice(i, 1); const z = $("#puces-" + k), ph = z.querySelector("input").placeholder; z.outerHTML = puces(k, ph); cvModifie(); }
function choixModele(fn) {
  const a = fn ? "A" : "";
  return `<div class="cv-modeles">${Object.entries(CV_MODELES).map(([k, [n, d]]) => `<button class="${CVM.modele === k ? "on" : ""}" onclick="choisirModele${a}('${k}')" title="${esc(d)}"><span class="mini mini-${k}"></span>${n}</button>`).join("")}</div>
  <div class="cv-couleurs">${Object.entries(CV_COULEURS).map(([k, c]) => `<button class="${CVM.couleur === k ? "on" : ""}" style="background:${c}" title="Couleur ${k}" aria-label="Couleur ${k}" onclick="choisirCouleur${a}('${k}')"></button>`).join("")}</div>`;
}
function choisirModele(m) { CVM.modele = m; $("#cv-choix").innerHTML = choixModele(); cvModifie(); majApercu(); }
function choisirCouleur(c) { CVM.couleur = c; $("#cv-choix").innerHTML = choixModele(); cvModifie(); majApercu(); }

/* ---------- Photo de profil ---------- */
function cadrePhoto(src, forme, taille, coul) {
  return `<span class="phw f-${esc(forme || "rond")}" style="--ph:${taille || 120}px${coul ? ";--cv:" + coul : ""}"><span class="ph">${src ? `<img src="${src}" alt="">` : `<i class="ph-vide">${ico("photo", Math.round((taille || 120) / 3))}</i>`}</span></span>`;
}
function blocPhoto() {
  return `<div class="cv-photo" id="cv-photo">
   <div class="cv-photo-cadre">${cadrePhoto(CVD.photo, CVM.forme, 112, CV_COULEURS[CVM.couleur])}</div>
   <div class="cv-photo-op">
    <div class="row" style="gap:8px;flex-wrap:wrap"><label class="btn sm" style="cursor:pointer">${ico("photo", 15)} ${CVD.photo ? "Changer la photo" : "Ajouter une photo"}<input type="file" id="cv-photo-fichier" accept="image/*" hidden onchange="choisirPhoto(this)"></label>${CVD.photo ? `<button class="btn sm ghost" onclick="retirerPhoto()">Retirer</button>` : ""}</div>
    <div class="small muted" style="margin:8px 0 6px">Forme de la photo</div>
    <div class="cv-formes">${Object.entries(CV_FORMES).map(([k, n]) => `<button class="${CVM.forme === k ? "on" : ""}" onclick="choisirForme('${k}')" title="${n}" aria-label="${n}">${cadrePhoto(CVD.photo, k, 34, CV_COULEURS[CVM.couleur])}</button>`).join("")}</div>
    <div class="small muted" style="margin-top:6px">Photo nette, de face, fond uni. Le modèle « Épuré » (ATS) n'affiche pas de photo.</div>
   </div></div>`;
}
function majPhoto() { const z = $("#cv-photo"); if (z) z.outerHTML = blocPhoto(); cvModifie(); }
function choisirForme(f) { CVM.forme = f; majPhoto(); }
function retirerPhoto() { CVD.photo = ""; majPhoto(); }
/* Recadre au carré (un peu vers le haut pour garder le visage) et réduit : la photo reste légère (~30 ko). */
function photoCarree(source, w, h) {
  const cote = Math.min(w, h), x = (w - cote) / 2, y = h > w ? (h - cote) * 0.18 : 0;
  const c = document.createElement("canvas"); let t = 360, q = 0.86, url;
  do {
    c.width = c.height = t; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, t, t);
    g.drawImage(source, x, y, cote, cote, 0, 0, t, t); url = c.toDataURL("image/jpeg", q); t = Math.round(t * 0.85); q -= 0.06;
  } while (url.length > 60000 && t > 150);
  return url;
}
async function choisirPhoto(inp) {
  const f = inp.files[0]; inp.value = ""; if (!f) return;
  if (!/^image\//.test(f.type)) return toast("Choisissez une image (JPG, PNG…).");
  if (f.size > 12e6) return toast("Image trop lourde (12 Mo maximum).");
  try {
    const url = URL.createObjectURL(f), img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
    CVD.photo = photoCarree(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url);
    majPhoto(); toast("Photo ajoutée : pensez à enregistrer.");
  } catch (e) { toast("Cette image n'a pas pu être lue."); }
}

VIEWS.cv = async () => {
  await chargerCV();
  const c = CVD;
  return bandeau("", "Mon profil &amp; CV", `<label class="btn ghost-blanc" style="cursor:pointer">${ico("importer", 16)} Importer mon CV<input type="file" id="cv-fichier" accept=".pdf,.docx,.txt,application/pdf" hidden onchange="importerCV(this)"></label><button class="btn" onclick="enregistrerCV(this)">Enregistrer</button>`) + `
${CV_INDISPO ? '<div class="alert gold" style="margin-bottom:14px"><b>Base de données à mettre à jour.</b> Vous pouvez remplir et télécharger votre CV, mais pas encore l\'enregistrer : l\'administrateur doit lancer <code>supabase/mise-a-jour-cv.sql</code> dans Supabase.</div>' : ""}
<div class="cv-barre"><span>${ico("cv", 18)} CV complété à <b id="cv-compl">${cvCompletude(c)} %</b></span><span id="cv-etat" class="cv-etat">Tout est enregistré</span><span class="sp"></span><span class="small muted">Astuce : importez votre CV (PDF ou Word) pour remplir les rubriques automatiquement, puis vérifiez.</span></div>
<div class="cv-page">
 <div class="cv-edit">
  <div class="card"><h3>Profil</h3>
   ${blocPhoto()}
   <label>Titre du CV</label><input type="text" value="${esc(c.titre)}" oninput="cvSet('titre',this.value)" placeholder="Ingénieur Pétrole & Énergie · QHSE">
   <label style="margin-top:10px">Résumé / accroche</label><textarea rows="4" oninput="cvSet('resume',this.value)" placeholder="En deux ou trois phrases : qui vous êtes, ce que vous savez faire, ce que vous cherchez.">${esc(c.resume)}</textarea>
   <div class="cv-champs" style="margin-top:10px">
    <div><label>E-mail</label><input type="email" value="${esc(c.contact.email)}" oninput="cvSetC('email',this.value)" placeholder="nom@exemple.com"></div>
    <div><label>Téléphone</label><input type="tel" value="${esc(c.contact.telephone)}" oninput="cvSetC('telephone',this.value)" placeholder="+225 07 00 00 00 00"></div>
    <div><label>Adresse / ville</label><input type="text" value="${esc(c.contact.ville)}" oninput="cvSetC('ville',this.value)" placeholder="Marcory, Abidjan – CIV"></div>
    <div><label>Lien (LinkedIn, portfolio)</label><input type="text" value="${esc(c.contact.lien)}" oninput="cvSetC('lien',this.value)" placeholder="linkedin.com/in/…"></div>
    <div class="large"><label>Ligne de présentation (sous la photo)</label><input type="text" value="${esc(c.contact.extra)}" oninput="cvSetC('extra',this.value)" placeholder="Ingénieur INP-HB (2024)"></div>
   </div>
  </div>
  ${rubriqueListe("experiences")}
  ${rubriqueListe("cursus")}
  ${rubriqueListe("formations")}
  <div class="card"><h3>Domaines clés et compétences</h3>${puces("competences", "Tapez une compétence puis Entrée : traitement du gaz, QHSE…")}</div>
  ${rubriqueListe("informatique")}
  ${rubriqueListe("langues")}
  ${rubriqueListe("projets")}
  ${rubriqueListe("references")}
  <div class="card"><h3>Centres d'intérêt</h3>${puces("interets", "Lecture, football, bénévolat…")}</div>
 </div>
 <aside class="cv-cote">
  <div class="card"><h3>Modèle de CV</h3><div id="cv-choix">${choixModele()}</div>
   <div id="cv-apercu" class="cv-apercu">${rendreCV(c, CVM, nomComplet(ME.profil))}</div>
   <div class="row" style="margin-top:12px"><span class="small muted sp">Le PDF se crée avec « Enregistrer au format PDF » dans la fenêtre d'impression.</span><button class="btn" onclick="imprimerCV()">Télécharger en PDF</button></div>
  </div>
 </aside>
</div>`;
};

/* ---------- Modèles de CV ---------- */
const AN_DE = (s) => (String(s || "").match(/(?:19|20)\d{2}/) || [""])[0];
function cvDates(e) {
  const d = e.debut || "", f = e.fin || "";
  if (!d && !f) return esc(e.annee || "");
  /* « Fév. 2026 – Juin 2026 » s'écrit « Fév. – Juin 2026 » */
  const ad = AN_DE(d), af = AN_DE(f), dm = d.replace(/\s*(?:19|20)\d{2}/, "").trim();
  if (ad && ad === af && dm) return esc(dm) + " – " + esc(f);
  return [d, f].filter(Boolean).map(esc).join(" – ");
}
function cvMissions(t, mots) {
  const l = String(t || "").split(/\n+/).map((x) => x.replace(/^[•\-–*▪●▸]\s*/, "").trim()).filter(Boolean);
  return l.length ? `<ul>${l.map((x) => `<li${mots && contientMot(x, mots) ? ' class="fort"' : ""}>${esc(x)}</li>`).join("")}</ul>` : "";
}
function contientMot(texte, mots) { const t = racines(texte); for (const m of mots) if (t.has(m)) return true; return false; }
const CODES_LANGUE = { francais: "FR", anglais: "EN", espagnol: "ES", allemand: "DE", arabe: "AR", portugais: "PT", italien: "IT", chinois: "ZH", mandarin: "ZH", russe: "RU", japonais: "JA", neerlandais: "NL", turc: "TR" };
const codeLangue = (l) => CODES_LANGUE[nrm(l).replace(/[^a-z]/g, "")] || nrm(l).replace(/[^a-z]/g, "").slice(0, 2).toUpperCase();
const estStage = (e) => /stage/i.test(e.type || "");
function rendreCV(c, m, nom, opts) {
  c = cvNormaliser(c); m = miseDe(m || CVM); opts = opts || {};
  const coul = CV_COULEURS[m.couleur], mots = opts.mots || null, fort = (x) => (mots && contientMot(x, mots) ? ' class="fort"' : "");
  if (m.modele === "signature" || m.modele === "epure") return `<div class="cvdoc cvt-${m.modele}" style="--cv:${coul}">${(m.modele === "signature" ? rendreSignature : rendreEpure)(c, m, nom, fort, mots)}</div>`;
  const contact = [c.contact.email, c.contact.telephone, c.contact.ville, c.contact.lien].filter(Boolean).map(esc);
  const sec = (titre, corps) => corps ? `<section><h4>${titre}</h4>${corps}</section>` : "";
  const exp = c.experiences.filter((e) => e.poste || e.entreprise).map((e) => `<div class="ent"><div class="l1"><b>${esc(e.poste || "")}</b><span class="dt">${cvDates(e)}</span></div><div class="l2">${esc([e.entreprise, e.lieu, e.type].filter(Boolean).join(" · "))}</div>${cvMissions(e.missions, mots)}</div>`).join("");
  const cur = c.cursus.filter((e) => e.diplome || e.etablissement).map((e) => `<div class="ent"><div class="l1"><b>${esc(e.diplome || "")}</b><span class="dt">${cvDates(e)}</span></div><div class="l2">${esc([e.etablissement, e.ville].filter(Boolean).join(" · "))}</div>${e.mention ? `<div class="l3">${esc(e.mention)}</div>` : ""}</div>`).join("");
  const frm = c.formations.filter((e) => e.intitule).map((e) => `<div class="ent"><div class="l1"><b>${esc(e.intitule)}</b><span class="dt">${esc(e.annee || "")}</span></div>${e.organisme ? `<div class="l2">${esc(e.organisme)}</div>` : ""}</div>`).join("");
  const comp = c.competences.length ? `<div class="tags">${c.competences.map((x) => `<span${fort(x)}>${esc(x)}</span>`).join("")}</div>` : "";
  const info = c.informatique.filter((e) => e.logiciel).map((e) => `<div class="lg"><b${fort(e.logiciel)}>${esc(e.logiciel)}</b>${e.detail ? ` <span>— ${esc(e.detail)}</span>` : ""}</div>`).join("");
  const lang = c.langues.filter((e) => e.langue).map((e) => `<div class="lg"><b>${esc(e.langue)}</b>${e.niveau ? ` <span>${esc(e.niveau)}</span>` : ""}</div>`).join("");
  const proj = c.projets.filter((e) => e.titre).map((e) => `<li${fort(e.titre)}>${esc(e.titre)}${e.date ? ` <span class="dt">— ${esc(e.date)}</span>` : ""}</li>`).join("");
  const refs = c.references.filter((e) => e.nom).map((e) => `<div class="ref"><b>${esc(e.nom)}</b>${e.poste ? `<div>${esc(e.poste)}</div>` : ""}<div class="dt">${[e.telephone, e.email].filter(Boolean).map(esc).join(" · ")}</div></div>`).join("");
  const int = c.interets.length ? `<p>${c.interets.map(esc).join(" · ")}</p>` : "";
  const res = c.resume ? `<p class="resume">${esc(c.resume).replace(/\n/g, "<br>")}</p>` : "";
  const ph = (t) => (c.photo ? cadrePhoto(c.photo, m.forme, t) : "");
  const tete = `<h1>${esc(nom || "Prénom NOM")}</h1>${c.titre ? `<div class="titre">${esc(c.titre)}</div>` : ""}`;
  let corps;
  if (m.modele === "moderne") {
    corps = `<aside>${c.photo ? `<div class="ph-haut">${ph(150)}</div>` : ""}${tete}<div class="ct">${contact.map((x) => `<div>${x}</div>`).join("")}</div>${sec("Compétences", comp)}${sec("Informatique", info)}${sec("Langues", lang)}${sec("Références", refs)}${sec("Centres d'intérêt", int)}</aside>
    <main>${sec("Profil", res)}${sec("Expériences professionnelles", exp)}${sec("Cursus scolaire", cur)}${sec("Formations et certifications", frm)}${sec("Projets et réalisations", proj && `<ul>${proj}</ul>`)}</main>`;
  } else if (m.modele === "compact") {
    corps = `<header>${ph(86)}<div class="sp">${tete}</div><div class="ct">${contact.map((x) => `<div>${x}</div>`).join("")}</div></header>${res}
    <div class="cols"><main>${sec("Expériences", exp)}${sec("Cursus scolaire", cur)}${sec("Projets", proj && `<ul>${proj}</ul>`)}</main><aside>${sec("Compétences", comp)}${sec("Informatique", info)}${sec("Formations", frm)}${sec("Langues", lang)}${sec("Références", refs)}${sec("Intérêts", int)}</aside></div>`;
  } else {
    corps = `<header>${m.modele === "bambou" ? `<div class="bh"><div>${tete}<div class="ct">${contact.join('<i aria-hidden="true">·</i>')}</div></div>${ph(118)}</div>` : `${c.photo ? `<div class="ph-haut">${ph(112)}</div>` : ""}${tete}<div class="ct">${contact.join('<i aria-hidden="true">·</i>')}</div>`}</header>${sec("Profil", res)}${sec("Expériences professionnelles", exp)}${sec("Cursus scolaire", cur)}${sec("Formations et certifications", frm)}${sec("Projets et réalisations", proj && `<ul>${proj}</ul>`)}
    <div class="cols2">${sec("Compétences", comp)}${sec("Langues", lang)}</div><div class="cols2">${sec("Informatique", info)}${sec("Références", refs)}</div>${sec("Centres d'intérêt", int)}`;
  }
  const vide = !exp && !cur && !res && !comp;
  return `<div class="cvdoc cvt-${esc(m.modele)}" style="--cv:${coul}">${corps}${vide ? '<p class="cv-vide">Remplissez les rubriques à gauche : votre CV apparaît ici.</p>' : ""}</div>`;
}
/* « Signature » : barre latérale claire (photo, contact, domaines clés, langues, informatique, références), contenu à droite */
function rendreSignature(c, m, nom, fort, mots) {
  const mots_nom = String(nom || "Prénom NOM").trim().split(/\s+/);
  const bande = (t, corps) => corps ? `<section class="sb"><h4><span>${t}</span></h4>${corps}</section>` : "";
  const titre = (t, corps) => corps ? `<section><h4>${t}</h4>${corps}</section>` : "";
  const ct = [c.contact.extra, c.contact.ville, c.contact.email && `<span class="lien">${esc(c.contact.email)}</span>`, c.contact.telephone, c.contact.lien && `<span class="lien">${esc(c.contact.lien)}</span>`]
    .filter(Boolean).map((x) => `<li>${x.startsWith("<span") ? x : esc(x)}</li>`).join("");
  const exp = c.experiences.filter((e) => e.poste || e.entreprise).map((e) => {
    const d = cvDates(e), lieu = esc(e.lieu || "");
    return `<div class="ent"><div class="l1"><b>${esc(e.poste || "")}</b>${e.entreprise ? `<span class="ent-org"> · ${esc(e.entreprise)}</span>` : ""}</div>
    <div class="l2">${[d, lieu].filter(Boolean).join(" · ")}${estStage(e) ? ' <span class="stage">(Stage)</span>' : e.type ? ` <span class="stage">(${esc(e.type)})</span>` : ""}</div>${cvMissions(e.missions, mots)}</div>`;
  }).join("");
  const cur = c.cursus.filter((e) => e.diplome || e.etablissement).map((e) => `<div class="frm"><b>${cvDates(e) ? cvDates(e) + " : " : ""}${esc(e.diplome || "")}</b>${e.etablissement || e.ville ? `<div class="et"><span>${esc(e.etablissement || "")}</span>${e.ville ? ` <i>· ${esc(e.ville)}</i>` : ""}</div>` : ""}${e.mention ? `<div class="et m">${esc(e.mention)}</div>` : ""}</div>`).join("");
  const frm = c.formations.filter((e) => e.intitule).map((e) => `<div class="frm"><b>${e.annee ? esc(e.annee) + " : " : ""}${esc(e.intitule)}</b>${e.organisme ? `<div class="et"><span>${esc(e.organisme)}</span></div>` : ""}</div>`).join("");
  const proj = c.projets.filter((e) => e.titre).map((e) => `<li${fort(e.titre)}>${esc(e.titre)}${e.date ? ` – <i>${esc(e.date)}</i>` : ""}</li>`).join("");
  const comp = c.competences.length ? `<ul class="pts">${c.competences.map((x) => `<li${fort(x)}>${esc(x)}</li>`).join("")}</ul>` : "";
  const lang = c.langues.filter((e) => e.langue).map((e) => `<div class="lgs"><span class="code">${esc(codeLangue(e.langue))}</span><b>${esc(e.langue)}</b><span>${esc(e.niveau || "")}</span></div>`).join("");
  const info = c.informatique.filter((e) => e.logiciel).map((e) => `<div class="inf"><span class="pastille">${esc(e.logiciel.trim()[0] || "")}</span><b${fort(e.logiciel)}>${esc(e.logiciel)}</b>${e.detail ? ` <span>– ${esc(e.detail)}</span>` : ""}</div>`).join("");
  const refs = c.references.filter((e) => e.nom).map((e) => `<div class="ref"><b>${esc(e.nom)}</b>${e.poste ? `<div>${esc(e.poste)}</div>` : ""}${e.telephone ? `<div class="tel">${esc(e.telephone)}</div>` : ""}${e.email ? `<div>${esc(e.email)}</div>` : ""}</div>`).join("");
  const int = c.interets.length ? `<ul class="pts">${c.interets.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const vide = !exp && !cur && !c.resume && !comp;
  return `<aside><div class="ph-zone">${cadrePhoto(c.photo, m.forme, 146)}</div>${ct ? `<ul class="ct">${ct}</ul>` : ""}
   ${bande("Domaines clés", comp)}${bande("Langues", lang)}${bande("Informatique", info)}${bande("Références", refs && `<div class="refs">${refs}</div>`)}${bande("Centres d'intérêt", int)}</aside>
  <main><header><h1><span>${esc(mots_nom[0])}</span> ${esc(mots_nom.slice(1).join(" "))}</h1>${c.titre ? `<div class="titre">${esc(c.titre)}</div>` : ""}</header>
   ${c.resume ? `<section class="profil"><h4>Profil</h4><p class="resume">${esc(c.resume).replace(/\n/g, "<br>")}</p></section>` : ""}
   ${titre("Expériences professionnelles", exp)}${titre("Formation", cur)}${titre("Formations et certifications", frm)}${titre("Projets &amp; réalisations", proj && `<ul class="fl">${proj}</ul>`)}
   ${vide ? '<p class="cv-vide">Remplissez les rubriques à gauche : votre CV apparaît ici.</p>' : ""}</main>`;
}
/* « Épuré » : une seule colonne, titres soulignés, dates à droite — pensé pour les logiciels de recrutement (ATS) */
function rendreEpure(c, m, nom, fort, mots) {
  const sec = (t, corps) => corps ? `<section><h4>${t}</h4>${corps}</section>` : "";
  const ct = [c.contact.telephone, c.contact.email, c.contact.ville, c.contact.lien].filter(Boolean).map(esc).join('<i aria-hidden="true">|</i>');
  const exp = c.experiences.filter((e) => e.poste || e.entreprise).map((e) => `<div class="ent"><div class="l1"><span><b>${esc(e.poste || "")}${estStage(e) && !/stagiaire|intern/i.test(e.poste || "") ? " (Stage)" : ""}</b>${e.entreprise || e.lieu ? ` - <i>${esc([e.entreprise, e.lieu].filter(Boolean).join(" / "))}</i>` : ""}</span><span class="dt">${cvDates(e)}</span></div>${cvMissions(e.missions, mots)}</div>`).join("");
  const cur = c.cursus.filter((e) => e.diplome || e.etablissement).map((e) => `<div class="ent"><div class="l1"><b>${esc(e.diplome || "")}</b><span class="dt">${[e.debut, e.fin].filter(Boolean).map(esc).join(" - ")}</span></div>${e.etablissement || e.ville ? `<div>${esc([e.etablissement, e.ville].filter(Boolean).join(", "))}</div>` : ""}${e.mention ? `<div class="l3">${esc(e.mention)}</div>` : ""}</div>`).join("");
  const frm = c.formations.filter((e) => e.intitule).map((e) => `<div class="ent"><div class="l1"><b>${esc(e.intitule)}</b><span class="dt">${esc(e.annee || "")}</span></div>${e.organisme ? `<div>${esc(e.organisme)}</div>` : ""}</div>`).join("");
  const proj = c.projets.filter((e) => e.titre).map((e) => `<li${fort(e.titre)}>${esc(e.titre)}${e.date ? `, ${esc(e.date)}.` : ""}</li>`).join("");
  const ligne = (lab, v) => v ? `<div class="lab"><b>${lab} :</b> ${v}</div>` : "";
  const info = c.informatique.filter((e) => e.logiciel).map((e) => `<span${fort(e.logiciel)}>${esc(e.logiciel)}${e.detail ? ` (${esc(e.detail)})` : ""}</span>`).join(", ");
  const comp = c.competences.map((x) => `<span${fort(x)}>${esc(x)}</span>`).join(", ");
  const lang = c.langues.filter((e) => e.langue).map((e) => esc(e.langue) + (e.niveau ? " " + esc(nrm(e.niveau) === e.niveau ? e.niveau : e.niveau.toLowerCase()) : "")).join(", ");
  const comps = ligne("Compétences informatiques", info) + ligne("Domaines", comp) + ligne("Langues", lang) + ligne("Centres d'intérêt", c.interets.map(esc).join(", "));
  const refs = c.references.filter((e) => e.nom).map((e) => `<div class="lab"><b>${esc(e.nom)}</b>${[e.poste, e.telephone, e.email].some(Boolean) ? " : " + [e.poste, e.telephone, e.email].filter(Boolean).map(esc).join('<i aria-hidden="true">|</i>') : ""}</div>`).join("");
  const vide = !exp && !cur && !c.resume && !comp;
  return `<header><h1>${esc(nom || "Prénom NOM")}</h1>${c.titre ? `<div class="titre">${esc(c.titre)}</div>` : ""}${ct ? `<div class="ct">${ct}</div>` : ""}</header>
  ${sec("Profil", c.resume && `<p class="resume">${esc(c.resume).replace(/\n/g, "<br>")}</p>`)}${sec("Expériences professionnelles", exp)}${sec("Formation", cur)}${sec("Formations et certifications", frm)}${sec("Projets &amp; réalisations", proj && `<ul>${proj}</ul>`)}${sec("Compétences &amp; intérêts", comps)}${sec("Références", refs)}
  ${vide ? '<p class="cv-vide">Remplissez les rubriques à gauche : votre CV apparaît ici.</p>' : ""}`;
}
function imprimerCV(html) {
  let z = $("#zone-impression");
  if (!z) { z = document.createElement("div"); z.id = "zone-impression"; document.body.appendChild(z); }
  z.innerHTML = html || rendreCV(CVD, CVM, nomComplet(ME.profil));
  document.body.classList.add("imprime-cv");
  const fin = () => { document.body.classList.remove("imprime-cv"); window.removeEventListener("afterprint", fin); };
  window.addEventListener("afterprint", fin);
  setTimeout(() => { window.print(); setTimeout(fin, 1500); }, 60);
}

/* ---------- Lecture des fichiers ---------- */
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
const COL = "⟦colonne⟧"; /* marque le passage à la colonne suivante d'un CV à barre latérale */
function chargerScript(src) {
  return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => ko(new Error("Le lecteur de PDF n'a pas pu être chargé. Vérifiez votre connexion internet, ou importez la version Word (.docx).")); document.head.appendChild(s); });
}
async function chargerPDFJS() {
  if (!window.pdfjsLib) {
    await chargerScript(PDFJS + "pdf.min.js");
    for (let i = 0; i < 100 && !window.pdfjsLib; i++) await new Promise((r) => setTimeout(r, 50));
    if (!window.pdfjsLib) throw new Error("Le lecteur de PDF n'a pas pu être chargé.");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
  }
  return window.pdfjsLib;
}
async function lirePDF(f) {
  const lib = await chargerPDFJS();
  const doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise, pages = [];
  for (let p = 1; p <= Math.min(doc.numPages, 6); p++) {
    const page = await doc.getPage(p), tc = await page.getTextContent();
    pages.push({ larg: page.getViewport({ scale: 1 }).width, items: itemsPDF(tc.items) });
  }
  let photo = null; try { photo = await photoPDF(doc, lib); } catch (e) { photo = null; }
  return { texte: textePages(pages), photo, colonnes: pages.some((p) => colonnePDF(p.items, p.larg) > 0) };
}
const itemsPDF = (items) => items.filter((i) => i.str && i.str.trim()).map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0, t: Math.hypot(i.transform[0], i.transform[1]) || i.height || 10 }));
function textePages(pages) {
  const out = [];
  pages.forEach((pg) => {
    const col = colonnePDF(pg.items, pg.larg);
    const groupes = col ? [pg.items.filter((i) => i.x < col), pg.items.filter((i) => i.x >= col)] : [pg.items];
    groupes.forEach((g, k) => { if (k) out.push(COL); out.push(...lignesItems(g)); });
  });
  return out.join("\n");
}
/* Recolle les morceaux d'une même ligne. Word et les navigateurs coupent les mots (« O » + « perations »,
   ligatures « ffi », « fi ») : un vrai espace se voit à l'écart entre deux morceaux, pas à leur nombre. */
function lignesItems(g) {
  g = g.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  const L = []; let cur = null;
  for (const it of g) { if (!cur || Math.abs(cur.y - it.y) > Math.max(2, it.t * 0.35)) { cur = { y: it.y, p: [] }; L.push(cur); } cur.p.push(it); }
  return L.map((l) => {
    l.p.sort((a, b) => a.x - b.x); let s = "", fin = null;
    for (const it of l.p) {
      let t = it.s; if (/^(\S ){2,}\S$/.test(t.trim())) t = t.trim().replace(/ /g, ""); /* lettres espacées : « I n g é n i e u r » */
      if (fin === null) s = t;
      else s += (it.x - fin > Math.max(0.9, it.t * 0.14) && !/\s$/.test(s) && !/^\s/.test(t) ? " " : "") + t;
      fin = Math.max(fin || 0, it.x + it.w);
    }
    return s.replace(/\s+/g, " ").trim();
  }).filter(Boolean);
}
/* Un CV à barre latérale a une bande verticale vide entre ses deux colonnes. */
function colonnePDF(items, larg) {
  if (items.length < 30) return 0;
  const occ = new Uint16Array(Math.ceil(larg) + 2);
  items.forEach((i) => { for (let x = Math.max(0, Math.floor(i.x)); x <= Math.min(larg, Math.ceil(i.x + i.w)); x++) occ[x]++; });
  let best = 0, lon = 0;
  for (let x = Math.floor(larg * 0.2); x < larg * 0.65; x++) {
    if (occ[x]) continue; let e = x; while (e < larg * 0.7 && !occ[e]) e++;
    if (e - x > lon) { lon = e - x; best = (x + e) / 2; } x = e;
  }
  if (lon < 8) return 0;
  return items.filter((i) => i.x + i.w <= best).length >= 12 && items.filter((i) => i.x >= best).length >= 12 ? best : 0;
}
/* La photo d'un CV PDF : la plus grande image « portrait » de la première page (ni logo, ni fond de page). */
async function photoPDF(doc, lib) {
  const page = await doc.getPage(1), O = lib.OPS, ops = await page.getOperatorList(), largPage = page.getViewport({ scale: 1 }).width;
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  let ctm = [1, 0, 0, 1, 0, 0]; const pile = []; const cands = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], a = ops.argsArray[i];
    if (fn === O.save) pile.push(ctm);
    else if (fn === O.restore) ctm = pile.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === O.transform) ctm = mul(ctm, a);
    else if (fn === O.paintFormXObjectBegin) { pile.push(ctm); if (Array.isArray(a[0]) && a[0].length === 6) ctm = mul(ctm, a[0]); }
    else if (fn === O.paintFormXObjectEnd) ctm = pile.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === O.paintImageXObject || (O.paintJpegXObject && fn === O.paintJpegXObject)) {
      const larg = Math.hypot(ctm[0], ctm[1]), haut = Math.hypot(ctm[2], ctm[3]);
      if (larg >= 40 && haut >= 40 && larg <= largPage * 0.45 && larg / haut > 0.6 && larg / haut < 1.7) cands.push({ nom: a[0], aire: larg * haut });
    }
  }
  cands.sort((x, y) => y.aire - x.aire);
  for (const c of cands) {
    const img = await new Promise((ok) => { const fini = setTimeout(() => ok(null), 4000); try { (String(c.nom).startsWith("g_") ? page.commonObjs : page.objs).get(c.nom, (o) => { clearTimeout(fini); ok(o); }); } catch (e) { clearTimeout(fini); ok(null); } });
    if (!img || !img.width || !img.height || img.width < 60 || img.height < 60) continue;
    let src = img.bitmap;
    if (!src && img.data) {
      const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
      const g = cv.getContext("2d"), id = g.createImageData(img.width, img.height), d = img.data, n = img.width * img.height;
      if (img.kind === 3 || d.length === n * 4) id.data.set(d.subarray ? d.subarray(0, n * 4) : d.slice(0, n * 4));
      else if (img.kind === 2 || d.length === n * 3) for (let k = 0; k < n; k++) { id.data[k * 4] = d[k * 3]; id.data[k * 4 + 1] = d[k * 3 + 1]; id.data[k * 4 + 2] = d[k * 3 + 2]; id.data[k * 4 + 3] = 255; }
      else continue;
      g.putImageData(id, 0, 0); src = cv;
    }
    if (src) return photoCarree(src, img.width, img.height);
  }
  return null;
}
async function lireZip(buf, nom) {
  const v = new DataView(buf); let e = buf.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("Ce fichier Word semble abîmé.");
  const n = v.getUint16(e + 10, true); let o = v.getUint32(e + 16, true);
  for (let i = 0; i < n; i++) {
    const meth = v.getUint16(o + 10, true), taille = v.getUint32(o + 20, true), ln = v.getUint16(o + 28, true), lx = v.getUint16(o + 30, true), lc = v.getUint16(o + 32, true), loc = v.getUint32(o + 42, true);
    const nomF = new TextDecoder().decode(new Uint8Array(buf, o + 46, ln));
    if (nomF === nom) {
      const debut = loc + 30 + v.getUint16(loc + 26, true) + v.getUint16(loc + 28, true), data = new Uint8Array(buf, debut, taille);
      if (meth === 0) return new TextDecoder().decode(data);
      if (meth === 8) return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
      throw new Error("Format de compression Word non pris en charge.");
    }
    o += 46 + ln + lx + lc;
  }
  throw new Error("Ce fichier n'est pas un document Word (.docx). Les anciens .doc doivent être réenregistrés en .docx ou en PDF.");
}
async function texteDOCX(f) {
  const xml = await lireZip(await f.arrayBuffer(), "word/document.xml");
  const d = new DOMParser().parseFromString(xml, "application/xml"), out = [];
  for (const p of d.getElementsByTagName("w:p")) {
    let a = p.parentNode, imbrique = false; while (a) { if (a.nodeName === "w:p") { imbrique = true; break; } a = a.parentNode; }
    if (imbrique) continue;
    let t = "";
    for (const n of p.getElementsByTagName("*")) { if (n.nodeName === "w:t") t += n.textContent; else if (n.nodeName === "w:tab") t += " | "; else if (n.nodeName === "w:br") t += "\n"; }
    out.push(t);
  }
  return out.join("\n");
}

/* ---------- Analyse d'un CV (par rubriques et mots-clés) ---------- */
const TITRES = [
  [/^(profil|resume|a propos|objectif|presentation|summary|about|accroche|profile)$/, "resume"],
  [/^(formations? complementaires?|certifications?|certificats?|formation continue|habilitations?|attestations?|formations? et certifications?)$/, "formations"],
  [/^(experiences?( professionnelles?)?|parcours professionnel|emplois?|stages? et emplois|stages?|parcours|professional experience|work experience)$/, "experiences"],
  [/^(formations?( academiques?)?|education|cursus( scolaire| academique)?|parcours (academique|scolaire|universitaire)|diplomes?|etudes|scolarite)$/, "cursus"],
  [/^(informatique|logiciels?|outils( informatiques)?|competences informatiques|maitrise des outils|outils et logiciels)$/, "informatique"],
  [/^(domaines? cles?|domaines? de competences?|competences?( cles| techniques| et interets| interets| et qualites)?|skills|savoir faire|aptitudes|qualites|atouts|expertises?)$/, "competences"],
  [/^(langues?( parlees| etrangeres| et dialectes)?|languages?)$/, "langues"],
  [/^(projets?( et realisations| realisations)?|realisations?|travaux|projets academiques)$/, "projets"],
  [/^(references?)$/, "references"],
  [/^(centres? d ?interets?|loisirs|hobbies|activites|interets|vie associative|passions?)$/, "interets"],
  [/^(contact|coordonnees|informations personnelles|etat civil|infos)$/, "ignorer"],
];
const ETIQUETTES = [[/^(competences? informatiques?|informatique|logiciels?|outils( informatiques)?)$/, "informatique"], [/^(domaines?( cles)?|competences?( techniques| cles)?|expertises?)$/, "competences"], [/^langues?$/, "langues"], [/^(centres? d ?interets?|loisirs|interets|hobbies)$/, "interets"]];
const cle = (s) => nrm(s).replace(/&/g, " et ").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const RPUCE = /^[•\-–*▪●◦·■▸►➢✓✔]\s*/;
const MOIS = "janvier|janv|jan|février|fevrier|févr|fevr|fév|fev|feb|mars|mar|avril|avr|apr|mai|may|juin|june|jun|juillet|juil|july|jul|août|aout|aoû|aug|septembre|sept|sep|octobre|oct|novembre|nov|décembre|decembre|déc|dec";
const DM = `(?:${MOIS})(?![A-Za-zÀ-ÿ])\\.?`, DAN = "(?:19|20)\\d{2}";
const UNE_DATE = `(?:${DM}\\s*)?(?:\\d{1,2}[/.-])?${DAN}`;
const DFIN = `(?:${UNE_DATE}|aujourd['’]hui|présent|present|ce jour|en cours|actuel(?:lement)?|now|today)`;
const DSEP = `\\s*(?:-|–|—|à|au|to)\\s*`;
const RDATE = new RegExp(`(?:depuis\\s+)?(?:(${DM})${DSEP}(${UNE_DATE})|(${UNE_DATE})(?:${DSEP}(${DFIN}))?)`, "i");
const PRESENT = /^(aujourd|présent|present|ce jour|en cours|actuel|now|today)/i;
/* Renvoie { brut, debut, fin } : « Fév. – Juin 2026 » → début « Fév. 2026 », fin « Juin 2026 » */
function trouverDate(l) {
  const d = l && l.match(RDATE); if (!d) return null;
  const propre = (x) => maj1(String(x || "").replace(/\s+/g, " ").replace(/\.\s*(?=\d)/, ". ").trim());
  let debut, fin;
  if (d[1]) { fin = propre(d[2]); debut = propre(d[1] + " " + AN_DE(d[2])); }
  else { debut = propre(d[3]); fin = d[4] ? (PRESENT.test(d[4]) ? "Présent" : propre(d[4])) : ""; }
  return { brut: d[0], debut, fin };
}
const nettoie = (s) => String(s || "").replace(/^[\s:|,·–—()-]+|[\s:|,·–—(-]+$/g, "").replace(/\s+/g, " ").trim();
const dateSeule = (l) => { const d = trouverDate(l); return !!d && !nettoie(l.replace(d.brut, "")); };
function titreDe(l) {
  if (l.length > 48 || /:\s*\S/.test(l) || trouverDate(l)) return null;
  const n = cle(l);
  if (!n || n.split(" ").length > 5) return null;
  for (const [r, k] of TITRES) if (r.test(n)) return k;
  return null;
}
function etiquette(l) {
  const m = l.replace(RPUCE, "").match(/^([^:]{3,40}?)\s*:\s*(.+)$/); if (!m) return null;
  const n = cle(m[1]); for (const [r, k] of ETIQUETTES) if (r.test(n)) return [k, m[2]];
  return null;
}
/* Recolle les lignes coupées : une ligne qui commence par une minuscule prolonge la puce ou le paragraphe d'au-dessus
   (dans les projets, toute ligne sans puce prolonge la puce précédente : « … de » + « Yamoussoukro – Juin 2023 »). */
function fusion(lignes, projets) {
  const r = [];
  for (const brut of lignes) {
    const puce = RPUCE.test(brut), l = brut.replace(RPUCE, "").trim(); if (!l) continue;
    const prec = r[r.length - 1];
    if (prec && !puce && (prec.puce || prec.l.length > 60) && ((/^[a-zà-ÿ(]/.test(l) && !dateSeule(l)) || (projets && prec.puce))) { prec.l += " " + l; continue; }
    r.push({ l, puce });
  }
  return r;
}
function decoupeListe(s) {
  const out = []; let p = 0, cur = "";
  for (const ch of s) { if (ch === "(") p++; if (ch === ")") p = Math.max(0, p - 1); if (!p && /[,;•|·▪●]/.test(ch)) { out.push(cur); cur = ""; } else cur += ch; }
  out.push(cur);
  return out.map((x) => x.trim().replace(/[.;:]+$/, "").trim()).filter((x) => x.length > 1);
}
/* Titre d'une entrée : « Poste · Entreprise », « Poste - Entreprise - Lieu », « Poste, Entreprise »… */
function decouper(t) {
  t = nettoie(t);
  if (/\s·\s/.test(t)) return t.split(/\s+·\s+/).map(nettoie).filter(Boolean);
  return t.split(/\s+[|–—]\s+|\s+-\s+|\s*\|\s*|\s*,-\s*|\s+chez\s+|\s+at\s+|\s+@\s+/i).map(nettoie).filter(Boolean);
}
/* Découpe une rubrique en entrées : titre, date, ligne secondaire (entreprise/établissement), puces */
function entrees(lignes) {
  const out = []; let cur = null;
  const nouvelle = (titre, d) => { cur = { titre: titre || "", d: d || null, sous: "", apres: "", puces: [] }; out.push(cur); };
  const F = fusion(lignes);
  F.forEach((x, i) => {
    if (x.puce) { if (!cur) nouvelle(); cur.puces.push(x.l); return; }
    const d = trouverDate(x.l), reste = d ? nettoie(x.l.replace(d.brut, "")) : x.l;
    if (d && !reste) { if (cur && !cur.d && !cur.puces.length) cur.d = d; else nouvelle("", d); return; }
    if (d) {
      if (cur && cur.titre && !cur.d && !cur.puces.length) { cur.d = d; cur.apres = reste; }  /* « Août 2026 – Présent · Abidjan » sous le titre */
      else nouvelle(reste, d);
      return;
    }
    const suivi = F[i + 1] && !F[i + 1].puce && dateSeule(F[i + 1].l); /* un nouveau titre, dont la date est à la ligne suivante */
    if (!cur || cur.puces.length || (cur.d && suivi)) { nouvelle(x.l); return; }
    if (!cur.titre) cur.titre = x.l;
    else if (!cur.sous && x.l.length <= 90) cur.sous = x.l;
    else cur.puces.push(x.l);
  });
  return out.filter((e) => e.titre || e.puces.length);
}
const STAGE = /\b(stage|stagiaire|intern|internship|trainee)\b/i;
function lireExperiences(lignes) {
  return entrees(lignes).map((e) => {
    const p = decouper(e.titre), brut = [e.titre, e.apres].join(" ");
    let entreprise = p[1] || "", lieu = p.slice(2).join(", "), sous = e.sous;
    if (!entreprise && sous) { const q = decouper(sous); entreprise = q[0]; if (!lieu) lieu = q.slice(1).join(", "); sous = ""; }
    let ap = nettoie(e.apres.replace(/\(?\s*stage\s*\)?/i, ""));
    if (ap) { if (!entreprise) entreprise = nettoie(ap); else if (!lieu) lieu = nettoie(ap); }
    const missions = (sous ? [sous] : []).concat(e.puces);
    return { poste: p[0] || "", entreprise, lieu, debut: e.d ? e.d.debut : "", fin: e.d ? e.d.fin : "", type: STAGE.test(brut) ? "Stage" : "", missions: missions.join("\n") };
  }).filter((e) => e.poste || e.entreprise);
}
function lireCursus(lignes) {
  return entrees(lignes).map((e) => {
    const p = decouper(e.titre); let etablissement = p[1] || "", ville = p.slice(2).join(", ");
    let s = e.sous || e.apres;
    if (!etablissement && s) {
      const q = /\s·\s/.test(s) ? s.split(/\s+·\s+/) : null;
      if (q) { etablissement = nettoie(q[0]); ville = nettoie(q.slice(1).join(", ")); }
      else { const m = s.match(/^(.*\S),\s*([A-ZÀ-Ý][^,]{1,28})$/); if (m && !/\d/.test(m[2])) { etablissement = m[1]; ville = m[2]; } else etablissement = s; }
      s = "";
    }
    return { diplome: p[0] || "", etablissement: nettoie(etablissement), ville, debut: e.d && e.d.fin ? e.d.debut : "", fin: e.d ? (e.d.fin || e.d.debut) : "", mention: [s && s !== e.apres ? s : "", ...e.puces].filter(Boolean).join(" · ").slice(0, 200) };
  }).filter((e) => e.diplome || e.etablissement);
}
function lireFormations(lignes) {
  return entrees(lignes).map((e) => { const p = decouper(e.titre); return { intitule: p[0] || "", organisme: p[1] || e.sous || e.apres || "", annee: e.d ? AN_DE(e.d.fin) || AN_DE(e.d.debut) : "" }; }).filter((e) => e.intitule);
}
function lireListe(lignes) {
  const r = [];
  fusion(lignes).forEach((x) => { (x.puce ? [x.l.replace(/[\s;.]+$/, "")] : decoupeListe(x.l)).forEach((v) => { v = maj1(nettoie(v)); if (v.length > 1 && v.length <= 90 && !r.some((y) => nrm(y) === nrm(v))) r.push(v); }); });
  return r;
}
function lireInformatique(lignes) {
  const r = [], ajoute = (logiciel, detail) => { logiciel = nettoie(logiciel); if (logiciel.length > 1 && logiciel.length <= 60 && !r.some((y) => nrm(y.logiciel) === nrm(logiciel))) r.push({ logiciel, detail: nettoie(detail || "") }); };
  fusion(lignes).forEach((x) => {
    const l = x.l.replace(/^[A-Z]\s+(?=[A-Z0-9])/, ""); /* pastille d'initiale devant le logiciel */
    const m = l.match(/^(.{2,50}?)\s+[–—-]\s+(.+)$/) || (x.puce && l.match(/^(.{2,50}?)\s*:\s+(.+)$/));
    if (m) return ajoute(m[1], m[2]);
    decoupeListe(l).forEach((v) => { const p = v.match(/^(.*?)\s*\((.+)\)$/); if (p) ajoute(p[1], p[2]); else ajoute(v, ""); });
  });
  return r.slice(0, 20);
}
const NOMS_LANGUES = { francais: "Français", french: "Français", anglais: "Anglais", english: "Anglais", espagnol: "Espagnol", spanish: "Espagnol", allemand: "Allemand", german: "Allemand", arabe: "Arabe", portugais: "Portugais", italien: "Italien", chinois: "Chinois", mandarin: "Mandarin", russe: "Russe", japonais: "Japonais", neerlandais: "Néerlandais", turc: "Turc", baoule: "Baoulé", dioula: "Dioula", bete: "Bété", senoufo: "Sénoufo", agni: "Agni", wolof: "Wolof", haoussa: "Haoussa", hausa: "Haoussa", swahili: "Swahili", lingala: "Lingala", yoruba: "Yoruba", twi: "Twi", ewe: "Éwé", fon: "Fon", bambara: "Bambara", moore: "Mooré" };
function lireLangues(lignes) {
  const r = [];
  fusion(lignes).forEach((x) => decoupeListe(x.l).forEach((morceau) => {
    const mots = morceau.split(/\s+/), trouvees = [], reste = [];
    mots.forEach((w) => { const k = nrm(w).replace(/[^a-z]/g, ""); if (NOMS_LANGUES[k]) trouvees.push(NOMS_LANGUES[k]); else if (!/^(et|and|&|:|-|–)$/i.test(w)) reste.push(w); });
    let niveau = nettoie(reste.join(" ").replace(/^[:\-–]\s*/, "").replace(/^\((.*)\)$/, "$1"));
    if (trouvees.length > 1) niveau = niveau.replace(/s\b/i, "");
    niveau = maj1(niveau.toLowerCase() === niveau || niveau.toUpperCase() !== niveau ? niveau : niveau.toLowerCase());
    if (trouvees.length) trouvees.forEach((langue) => { if (!r.some((y) => y.langue === langue)) r.push({ langue, niveau }); });
    else { const m = morceau.match(/^([A-Za-zÀ-ÿ' ]{3,20}?)\s*([:\-–(])\s*(.+)$/); if (m) r.push({ langue: maj1(m[1].trim()), niveau: maj1(m[3].replace(/\)$/, "").trim()) }); }
  }));
  return r.slice(0, 8);
}
function lireProjets(lignes) {
  return fusion(lignes, true).map((x) => {
    const m = x.l.match(new RegExp(`[\\s,–—-]+((?:${DM}\\s*)?${DAN})\\.?$`, "i"));
    return { titre: nettoie(m ? x.l.slice(0, m.index) : x.l).replace(/\.$/, ""), date: m ? maj1(m[1].replace(/\.\s*(?=\d)/, ". ")) : "" };
  }).filter((p) => p.titre.length > 3).slice(0, 12);
}
const RTEL = /(?:\(\s*\+\s*\d{2,3}\s*\)|\+\s?\d{2,3})?[\s.]*\d[\d\s.()-]{6,20}\d/;
const telDe = (l) => { const m = l.match(RTEL); return m && m[0].replace(/\D/g, "").length >= 8 && !/^(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}$/.test(m[0].trim()) ? m[0].trim() : ""; };
const mailDe = (l) => (l.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [""])[0];
const ressembleNom = (l) => /^[A-Za-zÀ-ÿ'’.-]+(\s+[A-Za-zÀ-ÿ'’.-]+){1,4}$/.test(l) && !/[,@\d]/.test(l);
function lireReferences(lignes) {
  const r = []; let cur = null;
  fusion(lignes).forEach(({ l }) => {
    const m = l.match(/^([^:|]{4,45}?)\s*:\s*(.+)$/);
    if (m && ressembleNom(m[1].trim()) && /[|@]|\d{6}/.test(m[2])) {
      const p = m[2].split("|").map((x) => x.trim()).filter(Boolean), e = { nom: m[1].trim(), poste: "", telephone: "", email: "" };
      p.forEach((x) => { if (mailDe(x)) e.email = mailDe(x); else if (telDe(x)) e.telephone = telDe(x); else e.poste = e.poste ? e.poste + ", " + x : x; });
      r.push(e); cur = null; return;
    }
    if (mailDe(l) && cur) { cur.email = mailDe(l); return; }
    if (telDe(l) && cur && !/[a-z]{4}/i.test(l.replace(telDe(l), ""))) { cur.telephone = telDe(l); return; }
    if (ressembleNom(l) && (!cur || cur.poste || cur.email || cur.telephone)) { cur = { nom: l, poste: "", telephone: "", email: "" }; r.push(cur); return; }
    if (cur) cur.poste = cur.poste ? cur.poste + ", " + l : l;
  });
  return r.filter((e) => e.poste || e.email || e.telephone).slice(0, 6);
}
const VILLES = ["Abidjan", "Yamoussoukro", "Bouaké", "San-Pédro", "San Pedro", "Korhogo", "Daloa", "Man", "Grand-Bassam", "Bingerville", "Dakar", "Bamako", "Ouagadougou", "Lomé", "Cotonou", "Accra", "Paris", "Lyon", "Marseille", "Douala", "Yaoundé", "Libreville", "Conakry", "Niamey"];
function analyserCV(texte) {
  const lignes = texte.split(/\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l && !/^\|?$/.test(l));
  const r = CV_VIDE(), blocs = { tete: [] }; let sec = "tete";
  const pousse = (k, l) => (blocs[k] = blocs[k] || []).push(l);
  for (const l of lignes) {
    if (l === COL) { sec = "tete"; continue; }
    const t = titreDe(l); if (t) { sec = t; blocs[sec] = blocs[sec] || []; continue; }
    if (!["experiences", "resume", "cursus", "projets", "references", "formations"].includes(sec)) { const e = etiquette(l); if (e) { pousse(e[0], e[1]); continue; } }
    pousse(sec, l);
  }
  /* En-tête : nom, titre, coordonnées */
  const tete = (blocs.tete || []).map((l) => l.replace(RPUCE, "").trim()).filter(Boolean);
  const morceauxTete = tete.flatMap((l) => l.split(/\s+\|\s+/).map((x) => x.trim()));
  r.contact.email = morceauxTete.map(mailDe).find(Boolean) || mailDe(texte);
  r.contact.telephone = morceauxTete.map(telDe).find(Boolean) || "";
  r.contact.lien = (texte.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com)\/[^\s,|]+/i) || [""])[0];
  const adresse = morceauxTete.find((l) => l.length <= 60 && !mailDe(l) && !telDe(l) && VILLES.some((v) => new RegExp(`(^|[\\s,(])${v}([\\s,)–-]|$)`, "i").test(l)));
  r.contact.ville = adresse || VILLES.find((v) => nrm(texte).includes(nrm(v))) || "";
  const candidats = tete.filter((l) => ressembleNom(l) && l.split(/\s+/).length <= 5 && l.length <= 45);
  const maj = (l) => (l.match(/[A-ZÀ-Ý]/g) || []).length / Math.max(1, (l.match(/[A-Za-zÀ-ÿ]/g) || []).length);
  const nom = candidats.sort((a, b) => maj(b) - maj(a))[0] || "";
  const iNom = tete.indexOf(nom), libres = (l) => l !== nom && !mailDe(l) && !telDe(l) && l !== adresse;
  const apres = iNom >= 0 ? tete.slice(iNom + 1).find((l) => libres(l) && l.length <= 100) : null;
  r.titre = (apres || tete.find((l) => libres(l) && l.length >= 4 && l.length <= 90 && !/\d{4}/.test(l)) || "").slice(0, 120);
  r.contact.extra = (tete.find((l) => libres(l) && l !== r.titre && l.length <= 60 && l !== adresse) || "").slice(0, 80);
  const longues = tete.filter((l) => l.length > 90);
  r.resume = (blocs.resume || longues).map((l) => l.replace(RPUCE, "")).join(" ").replace(/\s+/g, " ").slice(0, 1400);
  r.experiences = lireExperiences(blocs.experiences || []);
  r.cursus = lireCursus(blocs.cursus || []);
  r.formations = lireFormations(blocs.formations || []);
  r.competences = lireListe(blocs.competences || []).slice(0, 40);
  r.informatique = lireInformatique(blocs.informatique || []);
  r.langues = lireLangues(blocs.langues || []);
  r.projets = lireProjets(blocs.projets || []);
  r.references = lireReferences(blocs.references || []);
  r.interets = lireListe(blocs.interets || []).slice(0, 12);
  return { cv: r, nom, rubriques: Object.keys(blocs).filter((k) => k !== "tete" && k !== "ignorer") };
}
async function importerCV(inp) {
  const f = inp.files[0]; inp.value = ""; if (!f) return;
  if (f.size > 8e6) return toast("Fichier trop lourd (8 Mo maximum).");
  const n = f.name.toLowerCase(); let texte = "", photo = null, colonnes = false;
  toast("Lecture de votre CV…");
  try {
    if (n.endsWith(".pdf") || f.type === "application/pdf") ({ texte, photo, colonnes } = await lirePDF(f));
    else if (n.endsWith(".docx")) texte = await texteDOCX(f);
    else if (n.endsWith(".txt")) texte = await f.text();
    else return modal(`<h2>Format non pris en charge</h2><p>Importez votre CV en <b>PDF</b> ou en <b>Word (.docx)</b>. Un ancien fichier .doc peut être réenregistré en .docx depuis Word.</p><div class="row"><span class="sp"></span><button class="btn" onclick="closeModal()">Compris</button></div>`);
  } catch (e) { return modal(`<h2>Lecture impossible</h2><p>${esc(e.message || "Le fichier n'a pas pu être lu.")}</p><div class="row"><span class="sp"></span><button class="btn" onclick="closeModal()">Compris</button></div>`); }
  if (texte.replace(/\s/g, "").length < 40) return modal(`<h2>Aucun texte lisible</h2><p>Ce CV semble être une image (scan ou photo) : il n'y a pas de texte à lire. Remplissez les rubriques à la main, ou importez la version Word.</p><div class="row"><span class="sp"></span><button class="btn" onclick="closeModal()">Compris</button></div>`);
  IMPORT = analyserCV(texte); IMPORT.photo = photo;
  IMPORT.modele = colonnes || photo ? "signature" : "epure";
  const c = IMPORT.cv, ligne = (nom, n) => `<div class="ligne"><span class="sq ${n ? "v" : "k"}"></span><span class="sp">${nom}</span><b>${n === true ? "✓" : n || "—"}</b></div>`;
  const existe = cvCompletude(CVD) > 30 && (CVD.experiences.length || CVD.cursus.length);
  modal(`<h2>Votre CV a été lu</h2>
  <p class="small muted">Voici ce que nous avons repéré dans « ${esc(f.name)} ». La lecture automatique n'est pas parfaite : vous pourrez tout vérifier et corriger.</p>
  <div class="import-photo">${photo ? cadrePhoto(photo, CVM.forme, 64, CV_COULEURS.marine) + "<span>Photo de profil trouvée dans le PDF</span>" : ""}</div>
  ${ligne("Titre", c.titre ? true : 0)}${ligne("Résumé", c.resume ? true : 0)}${ligne("Coordonnées", [c.contact.email, c.contact.telephone, c.contact.ville].filter(Boolean).length)}${ligne("Expériences", c.experiences.length)}${ligne("Cursus scolaire", c.cursus.length)}${ligne("Formations et certifications", c.formations.length)}${ligne("Domaines clés / compétences", c.competences.length)}${ligne("Informatique", c.informatique.length)}${ligne("Langues", c.langues.length)}${ligne("Projets et réalisations", c.projets.length)}${ligne("Références", c.references.length)}${c.interets.length ? ligne("Centres d'intérêt", c.interets.length) : ""}
  ${IMPORT.rubriques.length ? `<p class="small" style="margin:10px 0 0">Mise en page reconnue : nous appliquons le modèle <b>${CV_MODELES[IMPORT.modele][0]}</b> (vous pourrez en changer).</p>` : '<div class="alert gold" style="margin-top:10px">Nous n\'avons pas reconnu les titres de rubriques de ce CV : le texte a été placé dans le résumé. Répartissez-le dans les rubriques.</div>'}
  <div class="row" style="margin-top:16px"><button class="btn ghost" onclick="closeModal()">Annuler</button><span class="sp"></span>${existe ? `<button class="btn ghost" onclick="appliquerImport('completer',this)">Compléter mon CV actuel</button>` : ""}<button class="btn" onclick="appliquerImport('remplacer',this)">${existe ? "Remplacer mon CV" : "Remplir mon CV"}</button></div>`);
}
async function appliquerImport(mode, b) {
  const n = IMPORT.cv;
  if (mode === "remplacer") {
    const contact = Object.assign({}, CVD.contact), photo = CVD.photo; CVD = cvNormaliser(n);
    Object.keys(contact).forEach((k) => { if (!CVD.contact[k]) CVD.contact[k] = contact[k]; });
    CVD.photo = IMPORT.photo || photo;
    if (IMPORT.rubriques.length) CVM = miseDe({ modele: IMPORT.modele, couleur: "marine", forme: CVM.forme });
  } else {
    ["titre", "resume", "photo"].forEach((k) => { if (!CVD[k]) CVD[k] = k === "photo" ? IMPORT.photo || "" : n[k]; });
    Object.keys(n.contact).forEach((k) => { if (!CVD.contact[k]) CVD.contact[k] = n.contact[k]; });
    LISTES.forEach((k) => { CVD[k] = CVD[k].concat(n[k]); });
    ["competences", "interets"].forEach((k) => { n[k].forEach((x) => { if (!CVD[k].some((y) => nrm(y) === nrm(x))) CVD[k].push(x); }); });
  }
  await enregistrerCV(b, true); closeModal();
  toast("CV importé et enregistré : vérifiez chaque rubrique.");
  render();
}


/* ---------- Adapter le CV à une offre ---------- */
const VIDES = new Set(("avec pour dans des les une sur par aux est sont nous vous votre notre leur leurs etre avoir plus moins tres tout tous toute toutes cette ces son ses sera seront ainsi afin entre dont sous chez comme mais donc car poste postes profil profils candidat candidate candidats recherche recherchons offre mission missions travail equipe equipes entreprise societe annee annees ans experience experiences niveau minimum souhaite souhaitee souhaites requis requise bonne bonnes bon bons connaissance connaissances capacite capacites etc qui que quoi the and for with you your our will are this that from have has jeune junior senior emploi stage alternance cdi cdd contrat lieu date selon ville sein afin aussi bien etant faire fait doit doivent assurer participer realiser").split(" "));
const racine = (w) => w.replace(/(ements|ement|ations|ation|ites|ite|eurs|eur|euses|euse|ives|ive|iques|ique|es|s|x|e)$/, "").slice(0, 8);
function racines(t) { return new Set(nrm(t).replace(/[^a-z0-9+#]+/g, " ").split(" ").filter((w) => w.length > 2 && !VIDES.has(w)).map(racine).filter((w) => w.length > 2)); }
function motsOffre(o) {
  const f = new Map(), aff = new Map(), ajoute = (t, poids) => String(t || "").split(/[^A-Za-zÀ-ÿ0-9+#]+/).forEach((brut) => {
    const w = nrm(brut); if (w.length < 3 || VIDES.has(w) || /^\d+$/.test(w)) return;
    const r = racine(w); if (r.length < 3) return;
    f.set(r, (f.get(r) || 0) + poids); if (!aff.has(r) || brut.length < aff.get(r).length) aff.set(r, brut);
  });
  ajoute(o.titre, 3); ajoute(o.secteur, 2); ajoute(o.description, 1);
  return [...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([r]) => ({ r, mot: aff.get(r) }));
}
function texteCV(c) { return [c.titre, c.resume, ...c.competences, ...(c.informatique || []).map((e) => e.logiciel + " " + (e.detail || "")), ...(c.projets || []).map((e) => e.titre), ...c.experiences.map((e) => [e.poste, e.entreprise, e.missions].join(" ")), ...c.cursus.map((e) => [e.diplome, e.etablissement, e.mention].join(" ")), ...c.formations.map((e) => e.intitule + " " + e.organisme)].join(" "); }
function correspondance(c, cles) { const t = racines(texteCV(c)); const trouves = cles.filter((k) => t.has(k.r)); return { pct: cles.length ? Math.round(trouves.length / cles.length * 100) : 0, trouves, manquants: cles.filter((k) => !t.has(k.r)) }; }
function pertinence(texte, cles) { const t = racines(texte); return cles.filter((k) => t.has(k.r)).length; }
function preparerAdaptation(o) {
  const cles = motsOffre(o), base = cvNormaliser(CVD), c = copie(base), set = new Set(cles.map((k) => k.r));
  const avant = correspondance(base, cles);
  c.titre = o.titre;
  c.competences.sort((a, b) => pertinence(b, cles) - pertinence(a, cles));
  c.experiences.forEach((e) => { const l = String(e.missions || "").split(/\n+/).filter(Boolean); l.sort((a, b) => pertinence(b, cles) - pertinence(a, cles)); e.missions = l.join("\n"); e._p = pertinence([e.poste, e.missions].join(" "), cles); });
  const forts = c.competences.filter((x) => pertinence(x, cles) > 0).slice(0, 4);
  const lies = c.experiences.filter((e) => e._p > 0).length, dip = c.cursus[0]?.diplome;
  const org = nomOrg(o.org_id);
  c.resume = [`Candidature au poste de ${o.titre}${org ? " chez " + org : ""}.`,
    dip ? `Titulaire d'un ${dip}${c.cursus[0].etablissement ? " (" + c.cursus[0].etablissement + ")" : ""}${c.experiences.length ? `, avec ${c.experiences.length} expérience${c.experiences.length > 1 ? "s" : ""}${lies ? ` dont ${lies} en lien direct avec ce poste` : ""}.` : "."}` : (c.experiences.length ? `${c.experiences.length} expérience${c.experiences.length > 1 ? "s" : ""}${lies ? ` dont ${lies} en lien direct avec ce poste` : ""}.` : ""),
    forts.length ? `Points forts pour ce poste : ${forts.join(", ")}.` : "",
    base.resume].filter(Boolean).join(" ").slice(0, 1200);
  const masque = new Set(c.experiences.length > 4 ? c.experiences.map((e, i) => (e._p ? -1 : i)).filter((i) => i >= 0 && i > 2) : []);
  ADAPT = { o, cles, set, c, avant, masque, m: Object.assign({}, CVM) };
}
function cvAdapte() { const c = copie(ADAPT.c); c.experiences = c.experiences.filter((_, i) => !ADAPT.masque.has(i)).map((e) => { delete e._p; return e; }); return c; }
async function adapterCV(id) {
  if (!CVD) await chargerCV();
  ADAPT = { id }; go("adapter");
}
VIEWS.adapter = async () => {
  if (!ADAPT || !ADAPT.id) { go("candidat"); return ""; }
  if (!CAND) await chargerCandidat();
  await chargerCV();
  const o = CAND.toutes.find((x) => x.id === ADAPT.id);
  if (!o) return `<div class="alert red">Cette offre n'est plus disponible.</div>`;
  if (cvCompletude(CVD) < 30 || (!CVD.experiences.length && !CVD.cursus.length && !CVD.competences.length)) {
    return `<div class="entete"><div><h1>Adapter mon CV</h1><p class="sub">${esc(o.titre)} · ${esc(nomOrg(o.org_id))}</p></div></div>
    <div class="card" style="max-width:640px"><h3>Votre CV est encore presque vide</h3><p>Pour l'adapter à cette offre, il faut d'abord vos expériences, votre cursus et vos compétences. Le plus rapide : importez votre CV actuel (PDF ou Word).</p>
    <div class="row"><button class="btn" onclick="go('cv')">${ico("cv", 16)} Compléter mon CV</button><span class="sp"></span><button class="btn ghost" onclick="postulerAvecCV('${o.id}',this,true)">Postuler sans CV</button></div></div>`;
  }
  const id = ADAPT.id; preparerAdaptation(o); ADAPT.id = id;
  return ecranAdaptation();
};
function ecranAdaptation() {
  const { o, c } = ADAPT, apres = correspondance(cvAdapte(), ADAPT.cles), deja = CAND.candidatures.some((x) => x.offre_id === o.id);
  return `<div class="entete"><div><h1>Adapter mon CV</h1><p class="sub">${esc(o.titre)} · ${esc(nomOrg(o.org_id))} · ${esc(o.ville || "")}</p></div><button class="btn ghost" onclick="go('candidat')">Retour aux offres</button></div>
<div class="cv-page">
 <div class="cv-edit">
  <div class="card"><h3>Correspondance avec l'offre</h3>
   <div class="adapt-jauge"><div>${donut(ADAPT.avant.pct, 100, ADAPT.avant.pct + "%", "#A9B897")}<span class="small muted">Votre CV actuel</span></div><span class="fleche">→</span><div id="jauge-apres">${donut(apres.pct, 100, apres.pct + "%")}<span class="small muted">CV adapté</span></div></div>
   <p class="small muted">Part des mots importants de l'offre qu'on retrouve dans votre CV. Les recruteurs et leurs logiciels les cherchent en premier.</p>
   <div id="adapt-mots">${motsAdapt(apres)}</div>
  </div>
  <div class="card"><h3>Titre et accroche</h3>
   <label>Titre du CV</label><input type="text" value="${esc(c.titre)}" oninput="ADAPT.c.titre=this.value;majAdapt()">
   <label style="margin-top:10px">Accroche (préparée pour cette offre, modifiable)</label><textarea rows="6" oninput="ADAPT.c.resume=this.value;majAdapt()">${esc(c.resume)}</textarea>
   <div class="row" style="margin-top:8px"><button class="btn sm ghost" onclick="ameliorerIA(this)">${ico("baguette", 15)} Réécrire avec l'IA</button><span class="small muted sp">${window.EHR_CONFIG && window.EHR_CONFIG.ia ? "" : "Option IA : bientôt disponible."}</span></div>
  </div>
  <div class="card"><h3>Expériences à montrer</h3>
   <p class="small muted" style="margin-top:0">${ico("etoile", 14)} = en lien avec l'offre. Les missions qui parlent de l'offre passent en premier.</p>
   ${c.experiences.length ? c.experiences.map((e, i) => `<label class="adapt-exp"><input type="checkbox" ${ADAPT.masque.has(i) ? "" : "checked"} onchange="basculerExp(${i},this.checked)"><span class="sp"><b>${esc(e.poste || "Expérience")}</b><span class="small muted"> · ${esc([e.entreprise, cvDates(e)].filter(Boolean).join(" · "))}</span></span>${e._p ? `<span class="etoiles" title="${e._p} mot(s) de l'offre">${ico("etoile", 14).repeat(Math.min(3, e._p))}</span>` : ""}</label>`).join("") : '<p class="small muted">Aucune expérience dans votre CV.</p>'}
  </div>
 </div>
 <aside class="cv-cote">
  <div class="card"><h3>Aperçu du CV pour cette offre</h3><div id="cv-choix">${choixModeleA()}</div>
   <div id="cv-apercu" class="cv-apercu">${rendreCV(cvAdapte(), ADAPT.m, nomComplet(ME.profil), { mots: ADAPT.set })}</div>
   <p class="small muted" style="margin:10px 0">Les éléments surlignés correspondent à l'offre. Votre CV principal n'est pas modifié.</p>
   <div class="row"><button class="btn ghost" onclick="imprimerCV(rendreCV(cvAdapte(), ADAPT.m, nomComplet(ME.profil)))">Télécharger en PDF</button><span class="sp"></span>
   ${deja ? '<span class="pill p-gray">Déjà postulé</span>' : `<button class="btn" id="btn-postuler-cv" onclick="postulerAvecCV('${o.id}',this)">Postuler avec ce CV</button>`}</div>
  </div>
 </aside>
</div>`;
}
function choixModeleA() { const sauve = CVM; CVM = ADAPT.m; const h = choixModele("choisirModeleA"); CVM = sauve; return h; }
function choisirModeleA(m) { ADAPT.m.modele = m; $("#cv-choix").innerHTML = choixModeleA(); majAdapt(); }
function choisirCouleurA(c) { ADAPT.m.couleur = c; $("#cv-choix").innerHTML = choixModeleA(); majAdapt(); }
function motsAdapt(r) {
  return `${r.trouves.length ? `<div class="small" style="margin:8px 0 4px"><b>Déjà dans votre CV</b></div><div class="cv-puces lecture">${r.trouves.map((k) => `<span class="chip ok">✓ ${esc(k.mot)}</span>`).join("")}</div>` : ""}
  ${r.manquants.length ? `<div class="small" style="margin:12px 0 4px"><b>Absents de votre CV</b> — ajoutez seulement ce que vous maîtrisez vraiment :</div><div class="cv-puces lecture">${r.manquants.map((k) => `<button class="chip manque" onclick="ajouterMotOffre('${esc(k.mot).replace(/'/g, "&#39;")}')">+ ${esc(k.mot)}</button>`).join("")}</div>` : '<p class="small" style="margin-top:8px">Tous les mots importants de l\'offre sont présents.</p>'}`;
}
function ajouterMotOffre(mot) { if (!ADAPT.c.competences.some((x) => nrm(x) === nrm(mot))) ADAPT.c.competences.unshift(mot); majAdapt(); }
function basculerExp(i, ok) { if (ok) ADAPT.masque.delete(i); else ADAPT.masque.add(i); majAdapt(); }
function majAdapt() {
  clearTimeout(cvMinuteur);
  cvMinuteur = setTimeout(() => {
    const r = correspondance(cvAdapte(), ADAPT.cles);
    $("#jauge-apres").innerHTML = donut(r.pct, 100, r.pct + "%") + '<span class="small muted">CV adapté</span>';
    $("#adapt-mots").innerHTML = motsAdapt(r);
    $("#cv-apercu").innerHTML = rendreCV(cvAdapte(), ADAPT.m, nomComplet(ME.profil), { mots: ADAPT.set }); ajusterApercus();
  }, 200);
}
/* Emplacement prévu pour une IA : renvoie { titre, resume } ou null si aucune IA n'est configurée. */
async function adapterAvecIA(cv, offre) {
  const url = window.EHR_CONFIG && window.EHR_CONFIG.ia;
  if (!url) return null;
  const s = JSON.parse(localStorage.getItem("ehr:session") || "null");
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", apikey: window.EHR_CONFIG.cle, Authorization: "Bearer " + (s && s.access_token) }, body: JSON.stringify({ cv, offre: { titre: offre.titre, secteur: offre.secteur, description: offre.description } }) });
  if (!r.ok) throw new Error("L'IA n'a pas répondu. Réessayez plus tard.");
  return r.json();
}
async function ameliorerIA(b) {
  if (!(window.EHR_CONFIG && window.EHR_CONFIG.ia)) return modal(`<h2>Réécriture par l'IA</h2><p>Cette option n'est pas encore activée. Pour l'instant, l'accroche est préparée automatiquement à partir des mots de l'offre et de votre parcours : relisez-la et personnalisez-la.</p><div class="row"><span class="sp"></span><button class="btn" onclick="closeModal()">Compris</button></div>`);
  const r = await occupe(b, adapterAvecIA(cvAdapte(), ADAPT.o));
  if (r && r.resume) { ADAPT.c.resume = r.resume; if (r.titre) ADAPT.c.titre = r.titre; $("#app").innerHTML = ecranAdaptation(); ajusterApercus(); }
}
function instantaneCV(c, m) { return Object.assign(copie(c), { nom: nomComplet(ME.profil), modele: m.modele, couleur: m.couleur, forme: m.forme }); }
async function postulerAvecCV(id, b, sansCV) {
  const cv = sansCV ? null : ADAPT && ADAPT.o && ADAPT.o.id === id ? instantaneCV(cvAdapte(), ADAPT.m) : (CVD && cvCompletude(CVD) >= 30 ? instantaneCV(CVD, CVM) : null);
  let r;
  try { r = await occupe(b, SB.rpc("postuler", CV_INDISPO ? { p_offre: id } : { p_offre: id, p_cv: cv })); }
  catch (e) { if (!/p_cv|function|fonction/i.test(e.message || "")) return; r = await occupe(b, SB.rpc("postuler", { p_offre: id })); }
  toast(cv ? "Candidature envoyée avec votre CV. Passez l'entretien IA pour la compléter." : "Candidature envoyée. Passez l'entretien IA pour la compléter.");
  ADAPT = null; CAND = null; ouvrirEntretien(r.id);
}

/* ---------- Côté entreprise : le CV joint ---------- */
function voirCVJoint(id) {
  const c = PRE.toutes.find((x) => x.id === id); if (!c || !c.cv) return;
  const html = rendreCV(c.cv, { modele: c.cv.modele, couleur: c.cv.couleur, forme: c.cv.forme }, c.cv.nom || nomComplet(PRE.profils[c.user_id]));
  const m = modal(`<div class="row" style="margin-bottom:10px"><h2 class="sp" style="margin:0">CV joint</h2><button class="btn ghost sm" onclick="detail('${id}')">Retour</button><button class="btn sm" id="btn-imprimer-cv">Imprimer / PDF</button></div><div class="cv-apercu">${html}</div>`);
  m.querySelector(".modal").classList.add("large");
  m.querySelector("#btn-imprimer-cv").onclick = () => imprimerCV(html);
  ajusterApercus();
}
