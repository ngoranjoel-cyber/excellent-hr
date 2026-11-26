-- Scénario complet avec les vraies règles d'accès. Chaque bloc agit « en tant que » un compte.
\set ON_ERROR_STOP 1
\pset format unaligned
\pset tuples_only on
insert into auth.users (id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','rh@lagune.ci','{"type":"entreprise","nom":"Kouassi","prenoms":"Marc"}'),
 ('00000000-0000-0000-0000-0000000000a2','rh2@lagune.ci','{"type":"entreprise","nom":"Yao","prenoms":"Ines"}'),
 ('00000000-0000-0000-0000-0000000000b1','scol@inphb.ci','{"type":"ecole","nom":"Konan","prenoms":"Rose"}'),
 ('00000000-0000-0000-0000-0000000000c1','aya@mail.ci','{"type":"candidat","nom":"Koffi","prenoms":"Aya"}'),
 ('00000000-0000-0000-0000-0000000000c2','ibra@mail.ci','{"type":"candidat","nom":"Koné","prenoms":"Ibrahim"}'),
 ('00000000-0000-0000-0000-0000000000d1','autre@rival.ci','{"type":"entreprise","nom":"Rival","prenoms":"Paul"}');
create temp table t(k text primary key, v text);
grant all on t to authenticated;
create or replace function pg_temp.en(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;

set role authenticated;
-- Entreprise
select pg_temp.en('00000000-0000-0000-0000-0000000000a1');
insert into t select 'org', (creer_organisation('Lagune Énergie','Abidjan','Énergie'))->>'id';
insert into t select 'code', code from organisations_codes;
select 'code visible par le créateur: ' || count(*) from organisations_codes;
insert into offres (org_id,titre,ville,type,secteur) select v::uuid,'Ingénieur procédés junior','Abidjan','Emploi','Énergie' from t where k='org';
insert into t select 'offre', id::text from offres;
-- Collègue rejoint
select pg_temp.en('00000000-0000-0000-0000-0000000000a2');
select 'collègue rejoint: ' || (rejoindre_organisation((select v from t where k='code'))->>'id' = (select v from t where k='org'));
-- École
select pg_temp.en('00000000-0000-0000-0000-0000000000b1');
insert into t select 'ecole', (creer_organisation('INP-HB','Yamoussoukro'))->>'id';
-- Candidate
select pg_temp.en('00000000-0000-0000-0000-0000000000c1');
insert into diplomes (ecole_id,intitule,filiere,annee) select v::uuid,'Master Génie pétrolier','Génie pétrolier',2025 from t where k='ecole';
select 'offres visibles par le candidat: ' || count(*) from offres;
insert into t select 'cand', (postuler((select v::uuid from t where k='offre')))->>'id';
do $$ begin perform postuler((select v::uuid from t where k='offre')); raise exception 'ÉCHEC double candidature acceptée'; exception when sqlstate 'P0001' then null; end $$;
do $$ begin perform entretien_repondre((select v::uuid from t where k='cand'),'Une réponse assez longue'); raise exception 'ÉCHEC réponse sans consentement'; exception when sqlstate 'P0001' then null; end $$;
select entretien_consentir((select v::uuid from t where k='cand'));
do $$ declare i int; r jsonb; begin for i in 1..10 loop r := entretien_repondre((select v::uuid from t where k='cand'),'Réponse numéro '||i||' : j''ai mené une analyse de risque avec mon équipe, résultat mesuré.'); end loop;
  if not (r->>'termine')::boolean then raise exception 'ÉCHEC entretien non terminé'; end if; end $$;
do $$ begin update candidatures set scores='{99,99,99,99}' where true; if exists(select 1 from candidatures where scores[1]=99) then raise exception 'ÉCHEC le candidat a modifié son score'; end if; exception when insufficient_privilege then null; end $$;
select 'statut après entretien: ' || statut || ' / scores ' || scores::text from candidatures;
-- Second candidate cannot see first
select pg_temp.en('00000000-0000-0000-0000-0000000000c2');
select 'candidat 2 voit candidatures des autres: ' || count(*) from candidatures;
select 'candidat 2 voit profils: ' || count(*) from profils;
-- Rival company
select pg_temp.en('00000000-0000-0000-0000-0000000000d1');
select 'entreprise rivale voit candidatures: ' || count(*) from candidatures;
do $$ begin perform basculer_shortlist((select v::uuid from t where k='cand')); raise exception 'ÉCHEC rival a modifié la short-list'; exception when sqlstate 'P0001' then null; end $$;
-- Recruiter
select pg_temp.en('00000000-0000-0000-0000-0000000000a2');
select 'recruteur voit candidature + profil + diplôme: ' || (select count(*) from candidatures) || '/' || (select count(*) from profils where type='candidat') || '/' || (select count(*) from diplomes);
select basculer_shortlist((select v::uuid from t where k='cand'));
select 'short-list validée: ' || (valider_shortlist((select v::uuid from t where k='offre'))->>'nombre');
select embaucher((select v::uuid from t where k='cand'),'Ingénieur procédés junior','CDD','2027-12-31','Exploitation') is not null;
insert into employes (org_id,nom,poste,contrat,fin) select v::uuid,'Adjoua Brou','Comptable','CDD',current_date+20 from t where k='org';
-- École validates
select pg_temp.en('00000000-0000-0000-0000-0000000000b1');
select 'école voit diplômes: ' || count(*) from diplomes;
select valider_tous_diplomes();
select 'stats école: ' || stats_ecole()::text;
-- Candidate now employee asks leave
select pg_temp.en('00000000-0000-0000-0000-0000000000c1');
select 'statut candidat: ' || statut from candidatures;
select 'ma fiche employé: ' || count(*) from employes;
select 'congé: ' || (demander_conge((select id from employes), date '2026-12-21', date '2026-12-31','Congé annuel')->>'jours') || ' jours ouvrés';
-- RH validates
select pg_temp.en('00000000-0000-0000-0000-0000000000a1');
select decider_conge((select id from conges),true);
select 'solde après validation: ' || solde from employes where user_id is not null;
insert into t select 'codeEmp', code from employes where nom='Adjoua Brou';
-- Link by code
select pg_temp.en('00000000-0000-0000-0000-0000000000c2');
select 'lien par code: ' || (lier_employe((select v from t where k='codeEmp'))->>'employe' is not null);
reset role;
select 'TOUT EST OK';
