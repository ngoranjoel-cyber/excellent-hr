/* Excellent HR — connexion au serveur Supabase, sans bibliothèque externe.
   Comptes (inscription, connexion, mot de passe oublié), lecture/écriture des tables, appel des fonctions.
   La session est gardée sur l'appareil et renouvelée automatiquement. */
(function (racine) {
  "use strict";
  var CFG = racine.EHR_CONFIG || {};
  var URL_ = String(CFG.url || "").replace(/\/+$/, "");
  var CLE = CFG.cle || "";
  var CLE_SESSION = "ehr:session";
  var enCours = null;

  var MESSAGES = {
    invalid_credentials: "E-mail ou mot de passe incorrect.",
    invalid_grant: "E-mail ou mot de passe incorrect.",
    email_not_confirmed: "Confirmez d'abord votre adresse e-mail avec le lien reçu.",
    user_already_exists: "Un compte existe déjà avec cet e-mail. Connectez-vous.",
    email_exists: "Un compte existe déjà avec cet e-mail. Connectez-vous.",
    weak_password: "Mot de passe trop court : au moins 8 caractères.",
    email_address_invalid: "Adresse e-mail invalide.",
    over_email_send_rate_limit: "Trop d'e-mails envoyés pour le moment. Réessayez dans une heure.",
    over_request_rate_limit: "Trop de tentatives. Patientez une minute puis réessayez.",
    signup_disabled: "Les inscriptions sont fermées pour le moment.",
    refresh_token_not_found: "Votre session a expiré. Reconnectez-vous.",
    session_not_found: "Votre session a expiré. Reconnectez-vous."
  };
  function erreur(msg, code, statut) { var e = new Error(msg); e.code = code || ""; e.statut = statut || 0; return e; }
  function versErreur(statut, d) {
    d = d || {};
    var code = d.error_code || d.code || d.error || "", brut = d.msg || d.message || d.error_description || "";
    if (MESSAGES[code]) return erreur(MESSAGES[code], code, statut);
    if (/email not confirmed/i.test(brut)) return erreur(MESSAGES.email_not_confirmed, "email_not_confirmed", statut);
    if (/invalid login credentials/i.test(brut)) return erreur(MESSAGES.invalid_credentials, code, statut);
    if (/already registered/i.test(brut)) return erreur(MESSAGES.user_already_exists, code, statut);
    if (/password should be/i.test(brut)) return erreur(MESSAGES.weak_password, code, statut);
    if (statut === 401 || code === "PGRST301" || code === "PGRST303") return erreur("Votre session a expiré. Reconnectez-vous.", "session", statut);
    if (code === "P0001" && brut) return erreur(brut, code, statut);          // messages rédigés dans supabase/schema.sql
    if (code === "23505") return erreur("Cette information existe déjà.", code, statut);
    if (code === "23514") return erreur("Une des valeurs saisies n'est pas acceptée.", code, statut);
    if (code === "42501") return erreur("Vous n'avez pas le droit de faire cette modification.", code, statut);
    if (code === "PGRST202" || code === "42P01") return erreur("La base de données n'est pas encore installée : lancez supabase/schema.sql dans Supabase.", code, statut);
    if (statut >= 500) return erreur("Le serveur ne répond pas correctement. Réessayez plus tard.", code, statut);
    return erreur(brut || "La demande a échoué (" + statut + ").", code, statut);
  }

  function lire() { try { return JSON.parse(localStorage.getItem(CLE_SESSION) || "null"); } catch (e) { return null; } }
  function garder(s) { try { if (s) localStorage.setItem(CLE_SESSION, JSON.stringify(s)); else localStorage.removeItem(CLE_SESSION); } catch (e) { } }
  function depuis(d) {
    if (!d || !d.access_token) return null;
    var u = d.user || {};
    return { a: d.access_token, r: d.refresh_token, exp: d.expires_at ? d.expires_at * 1000 : Date.now() + (Number(d.expires_in) || 3600) * 1000, id: u.id, email: u.email };
  }

  function requete(chemin, o) {
    o = o || {};
    if (!URL_ || !CLE) return Promise.reject(erreur("L'application n'est pas encore reliée à un serveur : remplissez config.js.", "config"));
    var h = { apikey: CLE };
    if (o.corps !== undefined) h["Content-Type"] = "application/json";
    if (o.jeton) h.Authorization = "Bearer " + o.jeton;
    if (o.prefer) h.Prefer = o.prefer;
    return fetch(URL_ + chemin, { method: o.methode || "GET", headers: h, body: o.corps === undefined ? undefined : JSON.stringify(o.corps) })
      .catch(function () { throw erreur("Pas de connexion internet. Réessayez quand vous serez connecté.", "reseau"); })
      .then(function (r) {
        return r.text().then(function (t) {
          var d = null; if (t) { try { d = JSON.parse(t); } catch (e) { d = { message: t }; } }
          if (!r.ok) throw versErreur(r.status, d);
          return d;
        });
      });
  }
  function rafraichir() {
    if (enCours) return enCours;
    var s = lire();
    if (!s) return Promise.reject(erreur("Connectez-vous d'abord.", "session"));
    enCours = requete("/auth/v1/token?grant_type=refresh_token", { methode: "POST", corps: { refresh_token: s.r } })
      .then(function (d) { var n = depuis(d); if (!n) throw erreur("Votre session a expiré. Reconnectez-vous.", "session"); garder(n); return n.a; })
      .catch(function (e) { if (e.code !== "reseau") garder(null); throw e; })
      .then(function (t) { enCours = null; return t; }, function (e) { enCours = null; throw e; });
    return enCours;
  }
  function jeton() {
    var s = lire();
    if (!s) return Promise.reject(erreur("Connectez-vous d'abord.", "session"));
    return s.exp - 60000 > Date.now() ? Promise.resolve(s.a) : rafraichir();
  }
  function api(chemin, o) {
    o = o || {};
    return jeton().then(function (t) { o.jeton = t; return requete(chemin, o); })
      .catch(function (e) {
        if (e.code !== "session" || o.deja) throw e;
        o.deja = true;
        return rafraichir().then(function (t) { o.jeton = t; return requete(chemin, o); });
      });
  }

  racine.SB = {
    configure: function () { return !!(URL_ && CLE); },
    utilisateur: function () { var s = lire(); return s ? { id: s.id, email: s.email } : null; },
    inscrire: function (email, mdp, donnees) {
      return requete("/auth/v1/signup?redirect_to=" + encodeURIComponent(CFG.urlSite || location.href.split("#")[0]), { methode: "POST", corps: { email: email, password: mdp, data: donnees || {} } })
        .then(function (d) { var s = depuis(d); if (s) garder(s); return { session: !!s }; });
    },
    connecter: function (email, mdp) {
      return requete("/auth/v1/token?grant_type=password", { methode: "POST", corps: { email: email, password: mdp } })
        .then(function (d) { var s = depuis(d); if (!s) throw erreur("Connexion impossible.", "session"); garder(s); return s; });
    },
    renvoyer: function (email) {
      return requete("/auth/v1/resend?redirect_to=" + encodeURIComponent(CFG.urlSite || location.href.split("#")[0]), { methode: "POST", corps: { type: "signup", email: email } });
    },
    oublie: function (email) {
      return requete("/auth/v1/recover", { methode: "POST", corps: { email: email, redirect_to: CFG.urlSite || location.href.split("#")[0] } });
    },
    nouveauMotDePasse: function (mdp) { return api("/auth/v1/user", { methode: "PUT", corps: { password: mdp } }); },
    /* Retour du lien « mot de passe oublié » : la session arrive dans l'adresse (#access_token=…) */
    sessionDepuisAdresse: function () {
      var h = location.hash.slice(1);
      if (h.indexOf("access_token=") < 0) return false;
      var p = {}; h.split("&").forEach(function (x) { var i = x.indexOf("="); p[x.slice(0, i)] = decodeURIComponent(x.slice(i + 1)); });
      var sub = ""; try { sub = JSON.parse(atob(p.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub; } catch (e) { }
      garder({ a: p.access_token, r: p.refresh_token, exp: Date.now() + (Number(p.expires_in) || 3600) * 1000, id: sub, email: "" });
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { }
      return p.type || "connexion";
    },
    deconnecter: function () {
      var s = lire(); garder(null);
      if (s) requete("/auth/v1/logout", { methode: "POST", jeton: s.a }).catch(function () { });
    },
    /* Tables : filtre au format PostgREST, ex. "statut=eq.ouverte&order=cree_le.desc" */
    lire: function (table, filtre) { return api("/rest/v1/" + table + (filtre ? "?" + filtre : "")); },
    ajouter: function (table, ligne) { return api("/rest/v1/" + table, { methode: "POST", corps: ligne, prefer: "return=representation" }); },
    modifier: function (table, filtre, valeurs) { return api("/rest/v1/" + table + "?" + filtre, { methode: "PATCH", corps: valeurs, prefer: "return=representation" }); },
    supprimer: function (table, filtre) { return api("/rest/v1/" + table + "?" + filtre, { methode: "DELETE" }); },
    rpc: function (nom, args) { return api("/rest/v1/rpc/" + nom, { methode: "POST", corps: args || {} }); }
  };
})(window);
