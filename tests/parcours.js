/* Parcours complet dans un vrai navigateur, contre le faux Supabase (vraie base + vraies règles RLS).
   École, entreprise et candidat(e) ; de l'inscription jusqu'au congé validé. */
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const SITE = (process.env.SITE || "http://localhost:8767/") + "index.html";
const fs = require("fs"); const IMAGES = process.env.IMAGES || "captures"; fs.mkdirSync(IMAGES, { recursive: true });
const erreurs = []; let n = 0;
const ok = (c, m) => { console.log((c ? "OK   " : "ÉCHEC ") + m); if (!c) erreurs.push(m); };
async function nouvelle(b, nom, mobile) {
  const ctx = await b.newContext({ viewport: mobile ? { width: 412, height: 915 } : { width: 1280, height: 860 }, locale: "fr-FR" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erreurs.push(nom + ": " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erreurs.push(nom + " console: " + m.text()); });
  p.on("dialog", (d) => d.accept());
  await p.goto(SITE); await p.waitForTimeout(400);
  return p;
}
const pause = (p, t) => p.waitForTimeout(t || 700);
const photo = (p, nom) => p.screenshot({ path: `${IMAGES}/${String(++n).padStart(2, "0")}-${nom}.png`, fullPage: true });
const texte = (p) => p.textContent("#app");
/* Fabrique un petit CV Word (.docx) : zip avec word/document.xml compressé (deflate) */
function docx(lignes) {
  const zlib = require("zlib");
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    lignes.map((l) => `<w:p><w:r><w:t xml:space="preserve">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`).join("") + "</w:body></w:document>";
  const nom = Buffer.from("word/document.xml"), brut = Buffer.from(xml), comp = zlib.deflateRawSync(brut);
  let crc = -1; for (const o of brut) { crc ^= o; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); } crc = (crc ^ -1) >>> 0;
  const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(8, 8); loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(brut.length, 22); loc.writeUInt16LE(nom.length, 26);
  const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(brut.length, 24); cen.writeUInt16LE(nom.length, 28); cen.writeUInt32LE(0, 42);
  const debutCen = 30 + nom.length + comp.length, fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(1, 8); fin.writeUInt16LE(1, 10); fin.writeUInt32LE(46 + nom.length, 12); fin.writeUInt32LE(debutCen, 16);
  return Buffer.concat([loc, nom, comp, cen, nom, fin]);
}
const CV_TEST = ["KOUADIO N'goran Henri-Joel", "Ingénieur pétrolier et gazier", "henri.kouadio@exemple.ci | +225 07 08 09 10 11 | Abidjan", "PROFIL", "Jeune ingénieur des mines spécialisé pétrole, rigoureux, orienté sécurité et performance des procédés.",
  "EXPÉRIENCES PROFESSIONNELLES", "Stagiaire ingénieur procédés – Foxtrot International | Abidjan", "Mars 2024 – Août 2024", "• Modèle prédictif du pouvoir calorifique du gaz livré à AZITO", "• Suivi des installations de traitement du gaz",
  "Operations Engineer – Genser Energy | Prestea", "2025 – Présent", "• Exploitation d'une centrale électrique au gaz",
  "FORMATION", "Master Génie pétrolier et gazier – INP-HB | Yamoussoukro", "2021 – 2024", "Mention Bien", "Baccalauréat série C – Lycée classique d'Abidjan", "2018",
  "COMPÉTENCES", "HYSYS, Excel avancé, Python, Analyse de risques, Bilan matière", "LANGUES", "Français : langue maternelle", "Anglais : courant (B2)", "CENTRES D'INTÉRÊT", "Lecture, football, bénévolat"];
/* Petite image PNG (dégradé) pour tester la photo de profil */
function png(l, h) {
  const zlib = require("zlib"), lignes = [];
  for (let y = 0; y < h; y++) { const r = [0]; for (let x = 0; x < l; x++) r.push(40 + x % 200, 90 + y % 150, 160); lignes.push(Buffer.from(r)); }
  const crc = (b) => { let c = -1; for (const o of b) { c ^= o; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (c ^ -1) >>> 0; };
  const bloc = (t, d) => { const n = Buffer.alloc(4); n.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([n, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(l, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc("IHDR", ih), bloc("IDAT", zlib.deflateSync(Buffer.concat(lignes))), bloc("IEND", Buffer.alloc(0))]);
}
async function inscrire(p, type, prenoms, nom, email) {
  await p.click(`button:has-text("${type === "candidat" ? "Je cherche un emploi" : type === "entreprise" ? "Je recrute" : "Je représente une école"}")`);
  await p.fill("#f-prenoms", prenoms); await p.fill("#f-nom", nom); await p.fill("#f-tel", "07 07 07 07 07");
  await p.fill("#f-email", email); await p.fill("#f-mdp", "motdepasse1");
  await p.check("#f-ok"); await p.click('button:has-text("Créer mon compte")'); await pause(p, 1200);
}
async function creerOrg(p, nom, ville, secteur) {
  await p.fill("#o-nom", nom); await p.fill("#o-ville", ville); await p.fill("#o-secteur", secteur);
  await p.click('button:has-text("Créer")'); await pause(p, 1200);
}
(async () => {
  const b = await chromium.launch();

  /* 1. L'école s'inscrit */
  const E = await nouvelle(b, "École");
  await photo(E, "accueil");
  await inscrire(E, "ecole", "Awa", "KONÉ", "ecole@test.ci");
  ok((await texte(E)).includes("Créer votre école"), "école : invitée à créer son établissement");
  await creerOrg(E, "INP-HB", "Yamoussoukro", "Grande école");
  ok((await texte(E)).includes("Suivi de l'insertion"), "école : tableau de bord affiché");

  /* 2. L'entreprise s'inscrit, crée la société et publie une offre */
  const R = await nouvelle(b, "Entreprise");
  await inscrire(R, "entreprise", "Marc", "YAO", "rh@lagune.ci");
  await creerOrg(R, "Lagune Énergie", "Abidjan", "Énergie");
  ok((await texte(R)).includes("Tableau de bord"), "entreprise : tableau de bord affiché");
  await R.click('#nav button:has-text("Offres")'); await pause(R);
  await R.click('button:has-text("+ Publier une offre")');
  await R.fill("#of-titre", "Ingénieur procédés gaz junior"); await R.fill("#of-desc", "Suivi des installations de traitement du gaz, génie pétrolier, sécurité HSE.");
  await R.click('.modal button:has-text("Publier")'); await pause(R, 1200);
  ok((await texte(R)).includes("Ingénieur procédés gaz junior"), "entreprise : offre publiée");
  await photo(R, "entreprise-offres");

  /* 3. Le candidat s'inscrit, complète son profil, déclare son diplôme, postule et passe l'entretien */
  const C = await nouvelle(b, "Candidat", true);
  await inscrire(C, "candidat", "Henri-Joel", "KOUADIO", "candidat@test.ci");
  ok((await texte(C)).includes("Espace Diplômés"), "candidat : espace affiché après inscription");
  ok((await texte(C)).includes("Ingénieur procédés gaz junior"), "candidat : voit l'offre de l'entreprise");
  await C.click('#nav button:has-text("Profil")'); await pause(C);
  await C.fill("#p-ville", "Abidjan"); await C.fill("#p-formation", "Master Génie pétrolier et gazier — INP-HB");
  await C.click('button:has-text("Enregistrer")'); await pause(C, 1000);
  await C.click('#nav button:has-text("Mon espace")'); await pause(C, 1000);
  await C.click('button:has-text("+ Déclarer")'); await C.fill("#d-int", "Master Génie pétrolier"); await C.fill("#d-fil", "Génie pétrolier");
  await C.click('button:has-text("Envoyer à l\'école")'); await pause(C, 1200);
  ok((await texte(C)).includes("En attente de l'école"), "candidat : diplôme déclaré, en attente");
  await photo(C, "candidat-espace");
  /* Le CV : import d'un fichier Word, puis adaptation à l'offre */
  await C.click('#nav button:has-text("Mon CV")'); await pause(C, 1000);
  ok((await texte(C)).includes("Mon profil & CV"), "candidat : page « Mon CV »");
  await C.setInputFiles("#cv-fichier", { name: "cv-henri.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docx(CV_TEST) }); await pause(C, 1200);
  const lu = await C.textContent(".modal");
  ok(lu.includes("Votre CV a été lu") && /Expériences\s*2/.test(lu) && /Cursus scolaire\s*2/.test(lu) && /compétences\s*5/i.test(lu), "candidat : CV Word lu (2 expériences, 2 diplômes, 5 compétences)");
  await C.click('.modal button:has-text("Remplir mon CV")'); await pause(C, 1500);
  const ap = await C.textContent("#cv-apercu");
  ok(ap.includes("Foxtrot International") && ap.includes("Master Génie pétrolier et gazier") && ap.includes("HYSYS"), "candidat : CV rempli et affiché dans le modèle");
  await C.click('.cv-modeles button:has-text("Moderne")'); await pause(C, 500);
  ok(await C.isVisible("#cv-apercu .cvt-moderne"), "candidat : changement de modèle de CV");
  await C.setInputFiles("#cv-photo-fichier", { name: "photo.png", mimeType: "image/png", buffer: png(300, 400) }); await pause(C, 900);
  ok(await C.isVisible("#cv-apercu .cvt-moderne .phw img") && (await C.getAttribute("#cv-apercu .phw img", "src")).startsWith("data:image/jpeg"), "candidat : photo de profil ajoutée et affichée dans le CV");
  await C.click('.cv-formes button[title="Hexagone"]'); await pause(C, 500);
  ok(await C.isVisible("#cv-apercu .phw.f-hexagone"), "candidat : forme de la photo changée (hexagone)");
  await C.click('.cv-modeles button:has-text("Signature")'); await pause(C, 500);
  ok(await C.isVisible("#cv-apercu .cvt-signature .f-hexagone img") && (await C.textContent("#cv-apercu .cvt-signature")).includes("Domaines clés"), "candidat : modèle Signature (barre latérale, photo, domaines clés)");
  await C.click('.cv-modeles button:has-text("Épuré")'); await pause(C, 500);
  ok(await C.isVisible("#cv-apercu .cvt-epure") && !(await C.isVisible("#cv-apercu .cvt-epure .phw")), "candidat : modèle Épuré (ATS, sans photo)");
  await C.click('.cv-modeles button:has-text("Signature")'); await pause(C, 400);
  await C.click('.cv-barre ~ * button:has-text("Enregistrer"), header button:has-text("Enregistrer"), .chemise button:has-text("Enregistrer")'); await pause(C, 900);
  await photo(C, "candidat-cv");
  await C.reload(); await pause(C, 1500);
  ok(await C.isVisible("#cv-apercu .cvt-signature .f-hexagone img"), "candidat : modèle, forme et photo retrouvés après rechargement");
  await C.click('#nav button:has-text("Mon espace")'); await pause(C, 1200);
  await C.click('button:has-text("Adapter mon CV")'); await pause(C, 1500);
  ok((await texte(C)).includes("Correspondance avec l'offre") && (await C.textContent("#cv-apercu")).includes("Ingénieur procédés gaz junior"), "candidat : CV adapté à l'offre (titre, correspondance)");
  await photo(C, "candidat-adapter");
  await C.click("#btn-postuler-cv"); await pause(C, 1300);
  ok((await texte(C)).includes("Avant de commencer"), "candidat : consentement à l'entretien demandé");
  await C.check("#ok"); await C.click('button:has-text("Commencer")'); await pause(C, 1000);
  const reps = ["J'ai suivi un master en génie pétrolier et gazier à l'INP-HB, avec un stage chez un opérateur gazier où j'ai modélisé le pouvoir calorifique du gaz livré.",
    "Le bilan matière et la thermodynamique des procédés de traitement du gaz, que j'ai pratiqués en stage."];
  for (let i = 0; i < 10; i++) {
    if (i === 3) await photo(C, "candidat-entretien");
    await C.fill("#rep", reps[i % 2] + " Réponse " + (i + 1) + ", avec un exemple concret, une méthode précise et un résultat mesuré de 15 %.");
    await C.click('#btnRep'); await pause(C, 900);
  }
  ok((await texte(C)).includes("Entretien envoyé"), "candidat : entretien terminé et envoyé");

  /* 4. L'école valide le diplôme */
  await E.reload(); await pause(E, 1200);
  ok((await texte(E)).includes("KOUADIO"), "école : voit le diplôme déclaré");
  await E.click('button:has-text("Valider")'); await pause(E, 1200);
  ok((await texte(E)).includes("✔ Validé"), "école : diplôme validé");

  /* 5. L'entreprise présélectionne, valide la short-list et embauche */
  await R.click('#nav button:has-text("Candidatures")'); await pause(R, 1300);
  ok((await texte(R)).includes("Henri-Joel KOUADIO") && (await texte(R)).includes("✔ Diplôme vérifié"), "entreprise : candidat classé, diplôme vérifié visible");
  await R.check('.liste-cand input[type=checkbox]'); await pause(R, 1200);
  await R.click('button:has-text("Valider la short-list")'); await R.click('.modal button:has-text("Confirmer")'); await pause(R, 1200);
  ok((await texte(R)).includes("Présélectionné(e)"), "entreprise : short-list validée");
  await photo(R, "entreprise-candidatures");
  await R.click('button:has-text("Détail")'); await pause(R, 500);
  await photo(R, "entreprise-detail");
  await R.click('.modal button:has-text("Voir le CV")'); await pause(R, 600);
  ok((await R.textContent(".modal")).includes("Foxtrot International") && (await R.textContent(".modal")).includes("Ingénieur procédés gaz junior"), "entreprise : voit le CV adapté joint à la candidature");
  await photo(R, "entreprise-cv");
  await R.click('.modal button:has-text("Retour")'); await pause(R, 400);
  await R.click('.modal button:has-text("Retenir et passer en RH")'); await R.selectOption("#e-contrat", "CDD");
  const fin = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  await R.fill("#e-fin", fin); await R.fill("#e-serv", "Production");
  await R.click('.modal button:has-text("Confirmer")'); await pause(R, 1500);
  ok((await texte(R)).includes("recruté(e) ici") && (await texte(R)).includes("Fin de contrat"), "entreprise : salarié ajouté, alerte de fin de contrat");

  /* 6. Le salarié demande un congé, l'entreprise le valide */
  await C.reload(); await pause(C, 1300);
  ok((await C.textContent("#nav")).includes("Mes congés"), "salarié : espace « Mes congés » apparu");
  await C.click('#nav button:has-text("Mes congés")'); await pause(C, 1000);
  await C.fill("#cg-du", "2027-03-01"); await C.dispatchEvent("#cg-du", "change"); await pause(C, 800);
  await C.fill("#cg-au", "2027-03-05"); await C.dispatchEvent("#cg-au", "change"); await pause(C, 800);
  ok((await texte(C)).includes("Jours ouvrés décomptés5"), "salarié : 5 jours ouvrés calculés");
  await photo(C, "salarie-conges");
  await C.click('button:has-text("Envoyer à mon responsable")'); await pause(C, 1200);
  ok((await texte(C)).includes("En attente"), "salarié : demande en attente");
  await R.reload(); await pause(R, 1400);
  await R.click('button:has-text("Valider")'); await pause(R, 1300);
  ok((await texte(R)).includes("21 j"), "entreprise : congé validé, solde 26 → 21");
  await photo(R, "entreprise-rh");
  await R.click('tr.cliquable'); await pause(R, 1300);
  ok((await texte(R)).includes("Dossier salarié") && (await texte(R)).includes("Frise chronologique"), "entreprise : dossier salarié avec frise");
  await R.click('summary:has-text("Congés")'); await pause(R, 300);
  await photo(R, "entreprise-dossier");
  await R.click('#nav button:has-text("Tableau de bord")'); await pause(R, 1400);
  ok((await texte(R)).includes("Analyse des entretiens"), "entreprise : tableau de bord avec analyse");
  await photo(R, "entreprise-tableau");
  await C.reload(); await pause(C, 1300);
  ok((await texte(C)).includes("Validé") && (await texte(C)).includes("21 j"), "salarié : voit la validation et son nouveau solde");

  /* 7. L'école voit l'insertion ; un concurrent ne voit rien */
  await E.reload(); await pause(E, 1300);
  ok((await texte(E)).includes("100 %"), "école : 100 % de ses diplômés vérifiés en emploi");
  await photo(E, "ecole");
  const X = await nouvelle(b, "Concurrent");
  await inscrire(X, "entreprise", "Paul", "TANO", "rh@concurrent.ci");
  await creerOrg(X, "Concurrent SA", "Abidjan", "Énergie");
  await X.click('#nav button:has-text("Personnel")'); await pause(X, 1200);
  ok(!(await texte(X)).includes("KOUADIO"), "concurrent : ne voit pas le personnel des autres");

  /* 8. Déconnexion / reconnexion */
  await C.click('#nav button:has-text("Profil")'); await pause(C);
  await C.click('button:has-text("Se déconnecter")'); await pause(C);
  await C.click('#qui button:has-text("Se connecter")'); await pause(C, 400);
  await C.fill("#f-email", "candidat@test.ci"); await C.fill("#f-mdp", "mauvais1234"); await C.click('.card button.btn:has-text("Se connecter")'); await pause(C, 900);
  ok((await C.textContent("#toast")).includes("incorrect"), "connexion : mauvais mot de passe refusé en français");
  await C.fill("#f-mdp", "motdepasse1"); await C.click('.card button.btn:has-text("Se connecter")'); await pause(C, 1300);
  ok((await texte(C)).includes("Espace Diplômés"), "connexion : retour dans l'espace");

  /* 9. (local seulement) Import de vrais CV PDF : CV_PDF="a.pdf,b.pdf" et pdf.js servi dans /pdfjs/ */
  if (process.env.CV_PDF) {
    await C.addInitScript(() => { import("/pdfjs/pdf.mjs").then((m) => { m.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.mjs"; window.pdfjsLib = m; }); });
    await C.reload(); await pause(C, 1500);
    await C.click('#nav button:has-text("Mon CV")'); await pause(C, 1200);
    for (const f of process.env.CV_PDF.split(",")) {
      await C.setInputFiles("#cv-fichier", f); await C.waitForSelector(".modal :text('Votre CV a été lu')", { timeout: 20000 });
      const m = (await C.textContent(".modal")).replace(/\s+/g, " ");
      console.log("     " + f.split("/").pop() + " → " + m.slice(m.indexOf("Titre"), m.indexOf("Mise en page") > 0 ? m.indexOf("Mise en page") : 400));
      ok(/Expériences ?7/.test(m) && /Cursus scolaire ?2/.test(m) && /Informatique ?5/.test(m) && /Langues ?3/.test(m) && /Projets et réalisations ?2/.test(m) && /Références ?3/.test(m), "PDF : toutes les rubriques lues (" + f.split("/").pop() + ")");
      await C.click('.modal button:has-text("Remplacer mon CV"), .modal button:has-text("Remplir mon CV")'); await pause(C, 1800);
      const ap = await C.textContent("#cv-apercu"), sig = await C.isVisible("#cv-apercu .cvt-signature");
      ok(ap.includes("Superviseur QHSE") && ap.includes("Aspen") && ap.includes("Armel") && ap.includes("Districom"), "PDF : CV rempli (" + (sig ? "Signature" : "Épuré") + ")");
      if (sig) ok(await C.isVisible("#cv-apercu .cvt-signature .phw img"), "PDF : photo extraite du PDF");
      await photo(C, "pdf-" + f.split("/").pop().replace(/\W+/g, "-"));
    }
  }

  console.log("erreurs de page :", JSON.stringify(erreurs.filter((e) => !/^(ÉCHEC|OK)/.test(e) && !e.startsWith("candidat") && !e.startsWith("entreprise") && !e.startsWith("école") && !e.startsWith("salarié") && !e.startsWith("concurrent") && !e.startsWith("connexion"))));
  console.log(erreurs.length ? "PROBLÈMES : " + erreurs.length : "TOUT EST OK");
  await b.close();
})();
