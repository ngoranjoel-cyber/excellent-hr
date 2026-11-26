# Excellent HR

Plateforme de recrutement et de gestion RH à trois espaces : **diplômés & étudiants**, **écoles & universités**, **entreprises** (recrutement + gestion du personnel).
Version connectée : vrais comptes, données partagées entre tous les utilisateurs, stockées dans une base Supabase.

Porteur du projet : Kouadio N'goran Henri-Joel.

## Ce que fait l'application

| Compte | Ce qu'on peut faire |
|---|---|
| **Diplômé(e) / étudiant(e)** | Profil, déclaration de diplôme (vérifié ensuite par l'école → badge « Diplôme vérifié »), offres avec compatibilité estimée et filtres, candidature, entretien IA (consentement, 5 questions + relances, reprise possible), suivi des statuts |
| **Entreprise** | Création de l'entreprise (ou entrée avec le code d'un collègue), offres (publier, modifier, fermer), présélection classée par score avec grille de poids réglable, short-list validée par un humain, lecture des réponses, « Retenir et passer en RH » |
| **Entreprise — RH** | Effectif, alertes de fin de contrat (moins de 45 jours), fiches salariés avec code de liaison, validation des congés (le solde est décompté), attestation de travail imprimable |
| **École** | Création de l'école, validation des diplômes déclarés (un par un ou tous), taux d'insertion par filière |
| **Salarié(e)** (tout compte relié à une fiche) | Demande de congé avec calcul des jours ouvrés (week-ends et jours fériés fixes de Côte d'Ivoire exclus), suivi des demandes |

Le parcours est relié de bout en bout : un candidat retenu devient salarié de l'entreprise et voit apparaître « Mes congés » dans son compte.

**Sécurité :** chaque entreprise ne voit que ses offres, ses candidats et son personnel ; une école ne voit que les diplômes déclarés chez elle ; un candidat ne peut pas modifier son score ni son statut. Ces règles sont appliquées par la base de données elle-même (Row Level Security), pas seulement par l'écran.

**Score IA :** le score est encore **simulé** (estimation simple selon la longueur et la précision des réponses). Il pourra être remplacé par un vrai modèle d'IA. La décision revient toujours à un recruteur.

## Installation (une seule fois, environ 15 minutes)

### 1. Créer la base de données
1. Sur [supabase.com](https://supabase.com), créez un **nouveau projet** (gratuit) nommé `excellent-hr`. Région conseillée : Europe (Paris ou Francfort).
2. Menu **SQL Editor → New query** : copiez tout le contenu de `supabase/schema.sql`, puis cliquez sur **Run**. Le message doit être « Success ».

### 2. Régler la connexion
1. **Authentication → Sign In / Providers → Email** : laissez « Email » activé. Pour vos premiers essais, vous pouvez désactiver « Confirm email » ; réactivez-le avant l'ouverture au public.
2. **Authentication → URL Configuration** : *Site URL* = `https://ngoranjoel-cyber.github.io/excellent-hr/` (l'adresse finale de l'application).

### 3. Relier l'application
1. **Project Settings → API Keys** : copiez l'adresse du projet (`https://xxxx.supabase.co`) et la clé **publishable** (`sb_publishable_…`).
2. Ouvrez `config.js` et collez-les :
   ```js
   window.EHR_CONFIG = { url: "https://xxxx.supabase.co", cle: "sb_publishable_xxxx" };
   ```
   La clé publishable est faite pour être publique. **Ne mettez jamais** la clé secrète (`sb_secret_…`) ni le mot de passe de la base dans ce fichier.

### 4. Mettre en ligne (GitHub Pages)
1. Sur GitHub : **Settings → Pages** → Source : **Deploy from a branch**, branche `main`, dossier `/ (root)`.
2. L'application est disponible à `https://ngoranjoel-cyber.github.io/excellent-hr/`.

## Premiers pas
1. Créez un compte **École** puis l'école (ex. INP-HB).
2. Créez un compte **Entreprise** puis l'entreprise ; publiez une offre. Vos collègues RH rejoignent l'entreprise avec le **code** affiché dans votre Profil.
3. Créez un compte **Diplômé(e)** : déclarez un diplôme, postulez, passez l'entretien.
4. Pour un salarié déjà en poste : ajoutez-le dans **Personnel**, remettez-lui son code ; il crée un compte et saisit ce code dans son Profil.

## Structure

```
excellent-hr/
├── index.html          # page de l'application
├── style.css           # présentation (couleurs Excellent HR)
├── app.js              # écrans et logique
├── sb.js               # connexion à Supabase (comptes, tables, fonctions), sans bibliothèque
├── config.js           # adresse + clé publique de VOTRE projet Supabase
├── assets/             # logo et icône
├── supabase/
│   ├── schema.sql      # tables, règles d'accès, fonctions (entretien, short-list, embauche, congés…)
│   └── tests/          # essai SQL complet des règles d'accès
└── tests/              # essai complet dans un navigateur (faux serveur Supabase + vraie base PostgreSQL)
```

## Essais
- Règles d'accès : `psql -d <base> -f supabase/tests/supabase_simule.sql -f supabase/schema.sql -f supabase/tests/scenario.sql` → « TOUT EST OK ».
- Parcours dans le navigateur (école, entreprise, candidat, concurrent ; de l'inscription au congé validé) : `sh tests/lancer.sh` (PostgreSQL + Playwright requis) → « TOUT EST OK ».
