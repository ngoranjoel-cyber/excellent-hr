/* Excellent HR — CV du candidat
   - profil structuré : profil, cursus scolaire, formations, expériences, compétences, langues, centres d'intérêt
   - import d'un CV PDF / Word / texte, lu dans le navigateur (le fichier ne quitte pas l'appareil)
   - 4 modèles de CV, téléchargement en PDF par l'impression du navigateur
   - adaptation du CV à une offre (mots-clés, accroche, ordre des compétences), puis candidature avec ce CV
   Le moteur est « par mots-clés » ; la fonction adapterAvecIA() est l'emplacement prévu pour brancher une IA. */

IC.cv = '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><circle cx="11" cy="10" r="2"/><path d="M8 16c.6-1.6 1.8-2.4 3-2.4s2.4.8 3 2.4"/>';
IC.importer = '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>';
IC.etoile = '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>';
IC.baguette = '<path d="M5 19L16 8"/><path d="M15 4v2M19 8h2M18 5l1.5-1.5M13 6l1 1"/>';

const CV_VIDE = () => ({ titre: "", resume: "", contact: { email: "", telephone: "", ville: "", lien: "" }, cursus: [], formations: [], experiences: [], competences: [], langues: [], interets: [] });
const CV_COULEURS = { vert: "#3F7A1E", nuit: "#1F2A44", bordeaux: "#7A2335", ardoise: "#3D4B57", terre: "#9A4E2F" };
const CV_MODELES = { classique: ["Classique", "Sobre et lisible, idéal pour les grandes entreprises"], moderne: ["Moderne", "Colonne de couleur à gauche"], bambou: ["Bambou", "Style dossier Excellent HR"], compact: ["Compact", "Tout tient sur une page"] };
const RUBRIQUES = {
  cursus: { titre: "Cursus scolaire", vide: "Ajoutez vos diplômes, du plus récent au plus ancien (Master, Licence, BTS, Baccalauréat…).", champs: [["diplome", "Diplôme", "Master Génie pétrolier", 1], ["etablissement", "Établissement", "INP-HB"], ["ville", "Ville", "Yamoussoukro"], ["debut", "Début", "2021"], ["fin", "Fin", "2024"], ["mention", "Mention / détails", "Mention Bien · major de promotion", 1]] },
  formations: { titre: "Formations et certifications", vide: "Formations courtes, certifications, habilitations (HSE, informatique, langues…).", champs: [["intitule", "Intitulé", "Habilitation électrique B1V", 1], ["organisme", "Organisme", "APAVE"], ["annee", "Année", "2025"]] },
  experiences: { titre: "Expériences professionnelles", vide: "Emplois, stages, missions, bénévolat : tout ce qui montre ce que vous savez faire.", champs: [["poste", "Poste", "Ingénieur procédés stagiaire", 1], ["entreprise", "Entreprise", "Foxtrot International"], ["lieu", "Lieu", "Abidjan"], ["debut", "Début", "Mars 2024"], ["fin", "Fin", "Août 2024"], ["missions", "Missions et résultats (une par ligne)", "Suivi des installations de traitement du gaz\nModèle prédictif du pouvoir calorifique : écart réduit de 15 %", 2]] },
  langues: { titre: "Langues", vide: "Français, anglais… avec votre niveau.", champs: [["langue", "Langue", "Anglais"], ["niveau", "Niveau", "Courant (B2)"]] },
};
let CVD = null, CVM = { modele: "classique", couleur: "vert" }, cvSale = false, cvMinuteur = null, IMPORT = null, ADAPT = null;

/* ---------- Outils ---------- */
const nrm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const copie = (o) => JSON.parse(JSON.stringify(o));
function cvNormaliser(c) {
  const v = CV_VIDE(), r = Object.assign(v, c || {});
  r.contact = Object.assign(CV_VIDE().contact, (c && c.contact) || {});
  ["cursus", "formations", "experiences", "langues"].forEach((k) => { r[k] = Array.isArray(r[k]) ? r[k].filter((e) => e && typeof e === "object") : []; });
  ["competences", "interets"].forEach((k) => { r[k] = Array.isArray(r[k]) ? r[k].map(String).filter(Boolean) : []; });
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
  if (r) { CVD = cvNormaliser(r.contenu); CVM = { modele: r.modele, couleur: r.couleur }; }
  else {
    CVD = CV_VIDE(); CVM = { modele: "classique", couleur: "vert" };
    CVD.titre = p.formation || ""; CVD.contact.ville = p.ville || ""; CVD.contact.telephone = p.telephone || ""; CVD.contact.email = ME.email || "";
  }
  cvSale = false;
  return !!r;
}
async function enregistrerCV(b, silencieux) {
  if (CV_INDISPO) return modal(`<h2>Mise à jour de la base à faire</h2><p>Pour enregistrer les CV, l'administrateur doit lancer une fois le fichier <code>supabase/mise-a-jour-cv.sql</code> dans Supabase (SQL Editor).</p><div class="row"><span class="sp"></span><button class="btn" onclick="closeModal()">Compris</button></div>`);
  await occupe(b, SB.rpc("enregistrer_cv", { p_contenu: CVD, p_modele: CVM.modele, p_couleur: CVM.couleur }), silencieux ? undefined : "CV enregistré");
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
  v.forEach((x) => { if (!CVD[k].some((y) => nrm(y) === nrm(x))) CVD[k].push(x.slice(0, 60)); });
  inp.value = ""; const z = $("#puces-" + k); z.outerHTML = puces(k, inp.placeholder); $("#puces-" + k + " input").focus(); cvModifie();
}
function retirerPuce(k, i) { CVD[k].splice(i, 1); const z = $("#puces-" + k), ph = z.querySelector("input").placeholder; z.outerHTML = puces(k, ph); cvModifie(); }
function choixModele(fn) {
  return `<div class="cv-modeles">${Object.entries(CV_MODELES).map(([k, [n, d]]) => `<button class="${CVM.modele === k ? "on" : ""}" onclick="${fn || "choisirModele"}('${k}')" title="${esc(d)}"><span class="mini mini-${k}"></span>${n}</button>`).join("")}</div>
  <div class="cv-couleurs">${Object.entries(CV_COULEURS).map(([k, c]) => `<button class="${CVM.couleur === k ? "on" : ""}" style="background:${c}" title="Couleur ${k}" aria-label="Couleur ${k}" onclick="${fn ? "choisirCouleurA" : "choisirCouleur"}('${k}')"></button>`).join("")}</div>`;
}
function choisirModele(m) { CVM.modele = m; $("#cv-choix").innerHTML = choixModele(); cvModifie(); majApercu(); }
function choisirCouleur(c) { CVM.couleur = c; $("#cv-choix").innerHTML = choixModele(); cvModifie(); majApercu(); }

VIEWS.cv = async () => {
  await chargerCV();
  const c = CVD;
  return bandeau("", "Mon profil &amp; CV", `<label class="btn ghost-blanc" style="cursor:pointer">${ico("importer", 16)} Importer mon CV<input type="file" id="cv-fichier" accept=".pdf,.docx,.txt,application/pdf" hidden onchange="importerCV(this)"></label><button class="btn" onclick="enregistrerCV(this)">Enregistrer</button>`) + `
${CV_INDISPO ? '<div class="alert gold" style="margin-bottom:14px"><b>Base de données à mettre à jour.</b> Vous pouvez remplir et télécharger votre CV, mais pas encore l\'enregistrer : l\'administrateur doit lancer <code>supabase/mise-a-jour-cv.sql</code> dans Supabase.</div>' : ""}
<div class="cv-barre"><span>${ico("cv", 18)} CV complété à <b id="cv-compl">${cvCompletude(c)} %</b></span><span id="cv-etat" class="cv-etat">Tout est enregistré</span><span class="sp"></span><span class="small muted">Astuce : importez votre CV (PDF ou Word) pour remplir les rubriques automatiquement, puis vérifiez.</span></div>
<div class="cv-page">
 <div class="cv-edit">
  <div class="card"><h3>Profil</h3>
   <label>Titre du CV</label><input type="text" value="${esc(c.titre)}" oninput="cvSet('titre',this.value)" placeholder="Ingénieur procédés — Génie pétrolier et gazier">
   <label style="margin-top:10px">Résumé / accroche</label><textarea rows="4" oninput="cvSet('resume',this.value)" placeholder="En deux ou trois phrases : qui vous êtes, ce que vous savez faire, ce que vous cherchez.">${esc(c.resume)}</textarea>
   <div class="cv-champs" style="margin-top:10px">
    <div><label>E-mail</label><input type="email" value="${esc(c.contact.email)}" oninput="cvSetC('email',this.value)" placeholder="nom@exemple.com"></div>
    <div><label>Téléphone</label><input type="tel" value="${esc(c.contact.telephone)}" oninput="cvSetC('telephone',this.value)" placeholder="+225 07 00 00 00 00"></div>
    <div><label>Ville</label><input type="text" value="${esc(c.contact.ville)}" oninput="cvSetC('ville',this.value)" placeholder="Abidjan"></div>
    <div><label>Lien (LinkedIn, portfolio)</label><input type="text" value="${esc(c.contact.lien)}" oninput="cvSetC('lien',this.value)" placeholder="linkedin.com/in/…"></div>
   </div>
  </div>
  ${rubriqueListe("cursus")}
  ${rubriqueListe("formations")}
  ${rubriqueListe("experiences")}
  <div class="card"><h3>Compétences</h3>${puces("competences", "Tapez une compétence puis Entrée : HYSYS, HSE, Excel…")}</div>
  ${rubriqueListe("langues")}
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
function cvDates(e) { return [e.debut, e.fin].filter(Boolean).map(esc).join(" – ") || esc(e.annee || ""); }
function cvMissions(t, mots) {
  const l = String(t || "").split(/\n+/).map((x) => x.replace(/^[•\-–*▪●]\s*/, "").trim()).filter(Boolean);
  return l.length ? `<ul>${l.map((x) => `<li${mots && contientMot(x, mots) ? ' class="fort"' : ""}>${esc(x)}</li>`).join("")}</ul>` : "";
}
function contientMot(texte, mots) { const t = racines(texte); for (const m of mots) if (t.has(m)) return true; return false; }
function rendreCV(c, m, nom, opts) {
  c = cvNormaliser(c); m = m || CVM; opts = opts || {};
  const coul = CV_COULEURS[m.couleur] || CV_COULEURS.vert, mots = opts.mots || null;
  const contact = [c.contact.email, c.contact.telephone, c.contact.ville, c.contact.lien].filter(Boolean).map(esc);
  const sec = (titre, corps) => corps ? `<section><h4>${titre}</h4>${corps}</section>` : "";
  const exp = c.experiences.filter((e) => e.poste || e.entreprise).map((e) => `<div class="ent"><div class="l1"><b>${esc(e.poste || "")}</b><span class="dt">${cvDates(e)}</span></div><div class="l2">${esc([e.entreprise, e.lieu].filter(Boolean).join(" · "))}</div>${cvMissions(e.missions, mots)}</div>`).join("");
  const cur = c.cursus.filter((e) => e.diplome || e.etablissement).map((e) => `<div class="ent"><div class="l1"><b>${esc(e.diplome || "")}</b><span class="dt">${cvDates(e)}</span></div><div class="l2">${esc([e.etablissement, e.ville].filter(Boolean).join(" · "))}</div>${e.mention ? `<div class="l3">${esc(e.mention)}</div>` : ""}</div>`).join("");
  const frm = c.formations.filter((e) => e.intitule).map((e) => `<div class="ent"><div class="l1"><b>${esc(e.intitule)}</b><span class="dt">${esc(e.annee || "")}</span></div>${e.organisme ? `<div class="l2">${esc(e.organisme)}</div>` : ""}</div>`).join("");
  const comp = c.competences.length ? `<div class="tags">${c.competences.map((x) => `<span${mots && contientMot(x, mots) ? ' class="fort"' : ""}>${esc(x)}</span>`).join("")}</div>` : "";
  const lang = c.langues.filter((e) => e.langue).map((e) => `<div class="lg"><b>${esc(e.langue)}</b>${e.niveau ? ` <span>${esc(e.niveau)}</span>` : ""}</div>`).join("");
  const int = c.interets.length ? `<p>${c.interets.map(esc).join(" · ")}</p>` : "";
  const res = c.resume ? `<p class="resume">${esc(c.resume).replace(/\n/g, "<br>")}</p>` : "";
  const tete = `<h1>${esc(nom || "Prénom NOM")}</h1>${c.titre ? `<div class="titre">${esc(c.titre)}</div>` : ""}`;
  let corps;
  if (m.modele === "moderne") {
    corps = `<aside>${tete}<div class="ct">${contact.map((x) => `<div>${x}</div>`).join("")}</div>${sec("Compétences", comp)}${sec("Langues", lang)}${sec("Centres d'intérêt", int)}</aside>
    <main>${sec("Profil", res)}${sec("Expériences professionnelles", exp)}${sec("Cursus scolaire", cur)}${sec("Formations et certifications", frm)}</main>`;
  } else if (m.modele === "compact") {
    corps = `<header><div>${tete}</div><div class="ct">${contact.map((x) => `<div>${x}</div>`).join("")}</div></header>${res}
    <div class="cols"><main>${sec("Expériences", exp)}${sec("Cursus scolaire", cur)}</main><aside>${sec("Compétences", comp)}${sec("Formations", frm)}${sec("Langues", lang)}${sec("Intérêts", int)}</aside></div>`;
  } else {
    corps = `<header>${tete}<div class="ct">${contact.join('<i aria-hidden="true">·</i>')}</div></header>${sec(m.modele === "bambou" ? "Profil" : "Profil", res)}${sec("Expériences professionnelles", exp)}${sec("Cursus scolaire", cur)}${sec("Formations et certifications", frm)}
    <div class="cols2">${sec("Compétences", comp)}${sec("Langues", lang)}</div>${sec("Centres d'intérêt", int)}`;
  }
  const vide = !exp && !cur && !res && !comp;
  return `<div class="cvdoc cvt-${esc(m.modele)}" style="--cv:${coul}">${corps}${vide ? '<p class="cv-vide">Remplissez les rubriques à gauche : votre CV apparaît ici.</p>' : ""}</div>`;
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
function chargerScript(src) {
  return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => ko(new Error("Le lecteur de PDF n'a pas pu être chargé. Vérifiez votre connexion internet, ou importez la version Word (.docx).")); document.head.appendChild(s); });
}
async function textePDF(f) {
  if (!window.pdfjsLib) { await chargerScript(PDFJS + "pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; }
  const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
  const lignes = [];
  for (let p = 1; p <= Math.min(doc.numPages, 6); p++) {
    const page = await doc.getPage(p), larg = page.getViewport({ scale: 1 }).width, tc = await page.getTextContent();
    const items = tc.items.filter((i) => i.str && i.str.trim()).map((i) => ({ s: i.str, x: i.transform[4], y: Math.round(i.transform[5]), w: i.width || 0 }));
    /* CV sur deux colonnes : on lit la colonne de gauche puis celle de droite si un grand vide vertical les sépare */
    const col = colonnePDF(items, larg);
    const groupes = col ? [items.filter((i) => i.x < col), items.filter((i) => i.x >= col)] : [items];
    for (const g of groupes) {
      g.sort((a, b) => b.y - a.y || a.x - b.x); let cur = null;
      for (const it of g) { if (!cur || Math.abs(cur.y - it.y) > 3) { cur = { y: it.y, p: [] }; lignes.push(cur); } cur.p.push(it); }
      lignes.push({ y: 0, p: [] });
    }
  }
  return lignes.map((l) => l.p.sort((a, b) => a.x - b.x).map((p) => p.s).join(" ").replace(/\s+/g, " ").trim()).join("\n");
}
function colonnePDF(items, larg) {
  if (items.length < 30) return 0;
  const bandes = new Array(40).fill(0);
  items.forEach((i) => { const a = Math.floor(i.x / larg * 40), b = Math.floor((i.x + i.w) / larg * 40); for (let k = Math.max(0, a); k <= Math.min(39, b); k++) bandes[k]++; });
  for (let k = 10; k < 24; k++) if (bandes[k] === 0 && bandes[k - 1] === 0 && bandes.slice(0, k).reduce((s, v) => s + v, 0) > 20 && bandes.slice(k).reduce((s, v) => s + v, 0) > 20) return (k / 40) * larg;
  return 0;
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
  [/^(profil|resume|a propos|objectif|presentation|summary|about|accroche)/, "resume"],
  [/^(formations? complementaires?|certifications?|certificats?|formation continue|habilitations?|attestations?|formations? et certifications?)/, "formations"],
  [/^(experiences?|parcours professionnel|emplois?|experience professionnelle|stages? et emplois|stages?$|parcours$)/, "experiences"],
  [/^(formations?|education|cursus|parcours (academique|scolaire|universitaire)|diplomes?|etudes|formation academique|scolarite)/, "cursus"],
  [/^(competences?|skills|savoir faire|outils|logiciels|informatique|aptitudes|qualites|atouts)/, "competences"],
  [/^(langues?|languages?)/, "langues"],
  [/^(centres? d ?interets?|loisirs|hobbies|activites|interets|vie associative|passions?)/, "interets"],
  [/^(references?|contact|coordonnees|informations personnelles|etat civil|infos)/, "ignorer"],
];
const MOIS = "janvier|janv|fevrier|février|fevr|févr|mars|avril|avr|mai|juin|juillet|juil|aout|août|septembre|sept|octobre|oct|novembre|nov|decembre|décembre|dec|déc|jan|feb|apr|may|jun|jul|aug|sep";
const UNE_DATE = `(?:(?:${MOIS})\\.?\\s*)?(?:\\d{1,2}[/.-])?(?:19|20)\\d{2}`;
const RDATE = new RegExp(`(?:depuis\\s+)?(${UNE_DATE})(?:\\s*(?:-|–|—|à|au|to|/)\\s*(${UNE_DATE}|aujourd['’]hui|présent|present|ce jour|en cours|actuel(?:lement)?|now))?`, "i");
function titreDe(l) {
  if (l.length > 48 || RDATE.test(l)) return null;
  const n = nrm(l).replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!n || n.split(" ").length > 5) return null;
  for (const [r, k] of TITRES) if (r.test(n)) return k;
  return null;
}
function morceaux(l) { return l.split(/\s+[|–—]\s+|\s+-\s+|\s*\|\s*|\s+chez\s+|\s+at\s+|\s+@\s+|,\s+/i).map((x) => x.trim()).filter(Boolean); }
function dateSeule(l) { const d = l && l.match(RDATE); return !!d && !l.replace(d[0], "").replace(/[\s:|,–—()-]+/g, ""); }
function entrees(lignes) {
  const L = []; let cur = null;
  lignes.forEach((brut, i) => {
    const puce = /^[•\-–*▪●◦·]\s*/.test(brut), l = brut.replace(/^[•\-–*▪●◦·]\s*/, "").trim();
    if (!l) return;
    const d = !puce && l.match(RDATE);
    const reste = d ? l.replace(d[0], "").replace(/^[\s:|,–—()-]+|[\s:|,–—()-]+$/g, "").trim() : l;
    if (d && !reste && cur && !cur.d) { cur.d = d; return; }            /* la date est seule sur sa ligne, sous le titre */
    const titreSuivi = !d && !puce && cur && cur.d && dateSeule(lignes[i + 1]); /* nouveau titre, sa date suit */
    if ((d && cur && cur.d) || (d && cur && cur.l.length > 2) || titreSuivi || !cur) { cur = { l: [], d: null }; L.push(cur); }
    if (d && !cur.d) cur.d = d;
    if (reste) cur.l.push(puce ? "• " + reste : reste);
  });
  return L;
}
const sansPuce = (l) => l.replace(/^•\s*/, "");
const estLigneTitre = (l) => l && !l.startsWith("• ") && l.length < 60;
const finDate = (d) => (d && d[2] ? d[2].replace(/^./, (x) => x.toUpperCase()) : "");
function analyserCV(texte) {
  const lignes = texte.split(/\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l && !/^\|?$/.test(l));
  const r = CV_VIDE(), blocs = { tete: [] }; let sec = "tete";
  for (const l of lignes) { const t = titreDe(l); if (t) { sec = t; blocs[sec] = blocs[sec] || []; continue; } (blocs[sec] = blocs[sec] || []).push(l); }
  const tout = texte;
  r.contact.email = (tout.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [""])[0];
  r.contact.telephone = ((tout.match(/(?:\+|00)?\d[\d .-]{7,16}\d/g) || []).find((x) => x.replace(/\D/g, "").length >= 8 && !/^(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}$/.test(x.trim())) || "").trim();
  r.contact.lien = (tout.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com)\/[^\s,|]+/i) || [""])[0];
  const tete = blocs.tete.filter((l) => !l.includes("@") && !(r.contact.telephone && l.includes(r.contact.telephone)));
  const nom = tete.find((l) => /^[A-Za-zÀ-ÿ' -]{4,40}$/.test(l) && l.split(" ").length >= 2 && l.split(" ").length <= 5) || "";
  const apres = tete.filter((l) => l !== nom);
  r.titre = (apres.find((l) => l.length >= 4 && l.length <= 90 && !/\d{4}/.test(l)) || "").slice(0, 120);
  const villes = ["Abidjan", "Yamoussoukro", "Bouaké", "San-Pédro", "Korhogo", "Daloa", "Man", "Dakar", "Bamako", "Ouagadougou", "Lomé", "Cotonou", "Accra", "Paris", "Lyon"];
  r.contact.ville = villes.find((v) => nrm(tout).includes(nrm(v))) || "";
  const longues = apres.filter((l) => l.length > 90);
  r.resume = (blocs.resume || longues).map(sansPuce).join(" ").slice(0, 1200);
  (entrees(blocs.experiences || [])).forEach((e) => {
    const p = morceaux(sansPuce(e.l[0] || "")); if (!p.length && !e.d) return;
    const ent2 = !p[1] && estLigneTitre(e.l[1]);
    r.experiences.push({ poste: p[0] || "", entreprise: p[1] || (ent2 ? e.l[1] : ""), lieu: p[2] || "", debut: e.d ? e.d[1] : "", fin: finDate(e.d), missions: e.l.slice(ent2 ? 2 : 1).map(sansPuce).join("\n") });
  });
  (entrees(blocs.cursus || [])).forEach((e) => {
    const p = morceaux(sansPuce(e.l[0] || "")); if (!p.length) return;
    const et2 = !p[1] && estLigneTitre(e.l[1]);
    r.cursus.push({ diplome: p[0], etablissement: p[1] || (et2 ? e.l[1] : ""), ville: p[2] || "", debut: e.d && e.d[2] ? e.d[1] : "", fin: e.d ? (e.d[2] ? finDate(e.d) : e.d[1]) : "", mention: e.l.slice(et2 ? 2 : 1).map(sansPuce).join(" · ").slice(0, 160) });
  });
  (entrees(blocs.formations || [])).forEach((e) => {
    const p = morceaux(sansPuce(e.l[0] || "")); if (!p.length) return;
    r.formations.push({ intitule: p[0], organisme: p[1] || (estLigneTitre(e.l[1]) ? e.l[1] : ""), annee: e.d ? (e.d[2] && !/^[a-z]/i.test(e.d[2]) ? e.d[2] : e.d[1]) : "" });
  });
  const items = (ls) => [...new Set((ls || []).map(sansPuce).flatMap((l) => (l.includes(":") ? l.split(":").slice(1).join(":") : l).split(/[,;•|·▪●]|\s{2,}|\s-\s/)).map((x) => x.trim().replace(/[.:]$/, "")).filter((x) => x.length > 1 && x.length <= 45))];
  const vus = new Set(); r.competences = items(blocs.competences).filter((x) => !vus.has(nrm(x)) && vus.add(nrm(x))).slice(0, 40);
  r.langues = [...new Set((blocs.langues || []).map(sansPuce).flatMap((l) => l.split(/[,;•|·▪●]|\s{2,}/)).map((x) => x.trim()).filter((x) => x.length > 1 && x.length <= 60))].map((x) => { const m = x.match(/^([A-Za-zÀ-ÿ' ]{3,20}?)\s*([:\-–(])\s*(.+)$/); return m ? { langue: m[1].trim(), niveau: (m[2] === "(" ? m[3].replace(/\)$/, "") : m[3]).trim() } : { langue: x, niveau: "" }; }).slice(0, 8);
  r.interets = items(blocs.interets).slice(0, 12);
  return { cv: r, nom, rubriques: Object.keys(blocs).filter((k) => k !== "tete" && k !== "ignorer") };
}
async function importerCV(inp) {
  const f = inp.files[0]; inp.value = ""; if (!f) return;
  if (f.size > 8e6) return toast("Fichier trop lourd (8 Mo maximum).");
  const n = f.name.toLowerCase(); let texte = "";
  toast("Lecture de votre CV…");
  try {
    if (n.endsWith(".pdf") || f.type === "application/pdf") texte = await textePDF(f);
    else if (n.endsWith(".docx")) texte = await texteDOCX(f);
    else if (n.endsWith(".txt")) texte = await f.text();
    else return modal(`<h2>Format non pris en charge</h2><p>Importez votre CV en <b>PDF</b> ou en <b>Word (.docx)</b>. Un ancien fichier .doc peut être réenregistré en .docx depuis Word.</p><div class="row"><span class="sp"></span><button class="btn" onclick="closeModal()">Compris</button></div>`);
  } catch (e) { return modal(`<h2>Lecture impossible</h2><p>${esc(e.message || "Le fichier n'a pas pu être lu.")}</p><div class="row"><span class="sp"></span><button class="btn" onclick="closeModal()">Compris</button></div>`); }
  if (texte.replace(/\s/g, "").length < 40) return modal(`<h2>Aucun texte lisible</h2><p>Ce CV semble être une image (scan ou photo) : il n'y a pas de texte à lire. Remplissez les rubriques à la main, ou importez la version Word.</p><div class="row"><span class="sp"></span><button class="btn" onclick="closeModal()">Compris</button></div>`);
  IMPORT = analyserCV(texte);
  const c = IMPORT.cv, ligne = (nom, n) => `<div class="ligne"><span class="sq ${n ? "v" : "k"}"></span><span class="sp">${nom}</span><b>${n || "—"}</b></div>`;
  const existe = cvCompletude(CVD) > 30 && (CVD.experiences.length || CVD.cursus.length);
  modal(`<h2>Votre CV a été lu</h2>
  <p class="small muted">Voici ce que nous avons repéré dans « ${esc(f.name)} ». La lecture automatique n'est pas parfaite : vous pourrez tout vérifier et corriger.</p>
  ${ligne("Titre", c.titre ? 1 : 0)}${ligne("Résumé", c.resume ? 1 : 0)}${ligne("Coordonnées", [c.contact.email, c.contact.telephone].filter(Boolean).length)}${ligne("Cursus scolaire", c.cursus.length)}${ligne("Formations et certifications", c.formations.length)}${ligne("Expériences", c.experiences.length)}${ligne("Compétences", c.competences.length)}${ligne("Langues", c.langues.length)}${ligne("Centres d'intérêt", c.interets.length)}
  ${IMPORT.rubriques.length ? "" : '<div class="alert gold" style="margin-top:10px">Nous n\'avons pas reconnu les titres de rubriques de ce CV : le texte a été placé dans le résumé. Répartissez-le dans les rubriques.</div>'}
  <div class="row" style="margin-top:16px"><button class="btn ghost" onclick="closeModal()">Annuler</button><span class="sp"></span>${existe ? `<button class="btn ghost" onclick="appliquerImport('completer',this)">Compléter mon CV actuel</button>` : ""}<button class="btn" onclick="appliquerImport('remplacer',this)">${existe ? "Remplacer mon CV" : "Remplir mon CV"}</button></div>`);
}
async function appliquerImport(mode, b) {
  const n = IMPORT.cv;
  if (!IMPORT.rubriques.length && !n.resume) n.resume = "";
  if (mode === "remplacer") {
    const contact = Object.assign({}, CVD.contact); CVD = cvNormaliser(n);
    Object.keys(contact).forEach((k) => { if (!CVD.contact[k]) CVD.contact[k] = contact[k]; });
  } else {
    ["titre", "resume"].forEach((k) => { if (!CVD[k]) CVD[k] = n[k]; });
    Object.keys(n.contact).forEach((k) => { if (!CVD.contact[k]) CVD.contact[k] = n.contact[k]; });
    ["cursus", "formations", "experiences", "langues"].forEach((k) => { CVD[k] = CVD[k].concat(n[k]); });
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
function texteCV(c) { return [c.titre, c.resume, ...c.competences, ...c.experiences.map((e) => [e.poste, e.entreprise, e.missions].join(" ")), ...c.cursus.map((e) => [e.diplome, e.etablissement, e.mention].join(" ")), ...c.formations.map((e) => e.intitule + " " + e.organisme)].join(" "); }
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
function instantaneCV(c, m) { return Object.assign(copie(c), { nom: nomComplet(ME.profil), modele: m.modele, couleur: m.couleur }); }
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
  const html = rendreCV(c.cv, { modele: c.cv.modele || "classique", couleur: c.cv.couleur || "vert" }, c.cv.nom || nomComplet(PRE.profils[c.user_id]));
  const m = modal(`<div class="row" style="margin-bottom:10px"><h2 class="sp" style="margin:0">CV joint</h2><button class="btn ghost sm" onclick="detail('${id}')">Retour</button><button class="btn sm" id="btn-imprimer-cv">Imprimer / PDF</button></div><div class="cv-apercu">${html}</div>`);
  m.querySelector(".modal").classList.add("large");
  m.querySelector("#btn-imprimer-cv").onclick = () => imprimerCV(html);
  ajusterApercus();
}
