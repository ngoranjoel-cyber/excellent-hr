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
  ok((await texte(C)).includes("Bonjour Henri-Joel"), "candidat : espace affiché après inscription");
  ok((await texte(C)).includes("Ingénieur procédés gaz junior"), "candidat : voit l'offre de l'entreprise");
  await C.click('#nav button:has-text("Profil")'); await pause(C);
  await C.fill("#p-ville", "Abidjan"); await C.fill("#p-formation", "Master Génie pétrolier et gazier — INP-HB");
  await C.click('button:has-text("Enregistrer")'); await pause(C, 1000);
  await C.click('#nav button:has-text("Mon espace")'); await pause(C, 1000);
  await C.click('button:has-text("+ Déclarer")'); await C.fill("#d-int", "Master Génie pétrolier"); await C.fill("#d-fil", "Génie pétrolier");
  await C.click('button:has-text("Envoyer à l\'école")'); await pause(C, 1200);
  ok((await texte(C)).includes("En attente de l'école"), "candidat : diplôme déclaré, en attente");
  await photo(C, "candidat-espace");
  await C.click('button:has-text("Postuler")'); await pause(C, 1300);
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
  ok((await texte(C)).includes("Bonjour Henri-Joel"), "connexion : retour dans l'espace");

  console.log("erreurs de page :", JSON.stringify(erreurs.filter((e) => !/^(ÉCHEC|OK)/.test(e) && !e.startsWith("candidat") && !e.startsWith("entreprise") && !e.startsWith("école") && !e.startsWith("salarié") && !e.startsWith("concurrent") && !e.startsWith("connexion"))));
  console.log(erreurs.length ? "PROBLÈMES : " + erreurs.length : "TOUT EST OK");
  await b.close();
})();
