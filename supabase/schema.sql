-- =====================================================================
-- Excellent HR — base de données (Supabase / PostgreSQL)
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Le fichier peut être relancé sans danger (il ne supprime aucune donnée).
--
-- Trois types de comptes : candidat (diplômés & étudiants), entreprise, école.
-- Une entreprise ou une école est une « organisation » : le premier compte la crée,
-- les collègues la rejoignent avec son code. Un salarié relie son compte à sa fiche
-- employé avec le code donné par son service RH (ou automatiquement s'il a été recruté ici).
-- Les règles d'accès (RLS) garantissent que chacun ne voit que ce qui le concerne.
-- =====================================================================

set client_min_messages = warning;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.organisations (
  id        uuid primary key default gen_random_uuid(),
  type      text not null check (type in ('entreprise', 'ecole')),
  nom       text not null check (length(btrim(nom)) between 2 and 120),
  ville     text not null default '' check (length(ville) <= 80),
  secteur   text not null default '' check (length(secteur) <= 80),
  cree_par  uuid references auth.users (id) on delete set null,
  cree_le   timestamptz not null default now()
);

-- Code d'invitation, lisible seulement par les membres de l'organisation.
create table if not exists public.organisations_codes (
  org_id  uuid primary key references public.organisations (id) on delete cascade,
  code    text not null unique
);

create table if not exists public.profils (
  id         uuid primary key references auth.users (id) on delete cascade,
  type       text not null default 'candidat' check (type in ('candidat', 'entreprise', 'ecole')),
  nom        text not null default '' check (length(nom) <= 80),
  prenoms    text not null default '' check (length(prenoms) <= 120),
  telephone  text not null default '' check (length(telephone) <= 30),
  ville      text not null default '' check (length(ville) <= 80),
  formation  text not null default '' check (length(formation) <= 160),
  org_id     uuid references public.organisations (id) on delete set null,
  cree_le    timestamptz not null default now(),
  maj        timestamptz not null default now()
);

create table if not exists public.diplomes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ecole_id   uuid not null references public.organisations (id) on delete cascade,
  intitule   text not null check (length(btrim(intitule)) between 2 and 160),
  filiere    text not null default '' check (length(filiere) <= 80),
  annee      int  check (annee between 1960 and 2100),
  statut     text not null default 'en_attente' check (statut in ('en_attente', 'valide', 'refuse')),
  decide_le  timestamptz,
  cree_le    timestamptz not null default now()
);
create index if not exists diplomes_ecole on public.diplomes (ecole_id);
create index if not exists diplomes_user on public.diplomes (user_id);

create table if not exists public.offres (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organisations (id) on delete cascade,
  titre              text not null check (length(btrim(titre)) between 2 and 120),
  ville              text not null default '' check (length(ville) <= 80),
  type               text not null default 'Emploi' check (type in ('Emploi', 'Stage', 'Alternance')),
  secteur            text not null default '' check (length(secteur) <= 80),
  description        text not null default '' check (length(description) <= 4000),
  poids              int[] not null default '{40,25,20,15}' check (array_length(poids, 1) = 4),
  statut             text not null default 'ouverte' check (statut in ('ouverte', 'fermee')),
  shortlist_validee  boolean not null default false,
  limite             date,
  cree_le            timestamptz not null default now()
);
create index if not exists offres_org on public.offres (org_id);

create table if not exists public.candidatures (
  id            uuid primary key default gen_random_uuid(),
  offre_id      uuid not null references public.offres (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  statut        text not null default 'Entretien IA à passer' check (statut in
                ('Entretien IA à passer', 'Entretien IA passé', 'Présélectionné(e)', 'Retenu(e)', 'Non retenu(e)')),
  shortlist     boolean not null default false,
  consentement  boolean not null default false,
  consenti_le   timestamptz,
  etape         int not null default 0,
  reponses      jsonb not null default '[]' check (jsonb_typeof(reponses) = 'array' and pg_column_size(reponses) < 60000),
  scores        int[],
  resume        text,
  cree_le       timestamptz not null default now(),
  maj           timestamptz not null default now(),
  unique (offre_id, user_id)
);
create index if not exists candidatures_user on public.candidatures (user_id);

create table if not exists public.employes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organisations (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete set null,
  nom             text not null check (length(btrim(nom)) between 2 and 160),
  poste           text not null default '' check (length(poste) <= 120),
  service         text not null default '' check (length(service) <= 80),
  contrat         text not null default 'CDI' check (contrat in ('CDI', 'CDD', 'Stage', 'Alternance')),
  fin             date,
  solde           int not null default 26 check (solde between 0 and 365),
  code            text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  candidature_id  uuid references public.candidatures (id) on delete set null,
  cree_le         timestamptz not null default now()
);
create index if not exists employes_org on public.employes (org_id);
create index if not exists employes_user on public.employes (user_id);

create table if not exists public.conges (
  id          uuid primary key default gen_random_uuid(),
  employe_id  uuid not null references public.employes (id) on delete cascade,
  du          date not null,
  au          date not null,
  jours       int  not null check (jours > 0),
  motif       text not null default '' check (length(motif) <= 200),
  statut      text not null default 'En attente' check (statut in ('En attente', 'Validé', 'Refusé')),
  decide_le   timestamptz,
  cree_le     timestamptz not null default now(),
  check (au >= du)
);
create index if not exists conges_employe on public.conges (employe_id);

-- ---------------------------------------------------------------------
-- Fonctions d'aide (security definer : lisent sans repasser par les règles,
-- ce qui évite les boucles entre règles)
-- ---------------------------------------------------------------------
create or replace function public.mon_org() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from profils where id = auth.uid() $$;

create or replace function public.mon_type() returns text
language sql stable security definer set search_path = public as $$
  select type from profils where id = auth.uid() $$;

create or replace function public.est_membre(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_org is not null and exists (select 1 from profils where id = auth.uid() and org_id = p_org) $$;

-- Organisation qui publie l'offre / qui emploie le salarié
create or replace function public.org_offre(p_offre uuid) returns uuid
language sql stable security definer set search_path = public as $$ select org_id from offres where id = p_offre $$;
create or replace function public.org_employe(p_emp uuid) returns uuid
language sql stable security definer set search_path = public as $$ select org_id from employes where id = p_emp $$;
create or replace function public.mon_employe(p_emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employes where id = p_emp and user_id = auth.uid()) $$;

-- Peut-on voir le profil (et les diplômes) de cette personne ?
-- Soi-même ; un recruteur dont l'offre a reçu sa candidature ; l'école où elle a déclaré un diplôme ;
-- le service RH qui l'emploie.
create or replace function public.peut_voir_personne(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid()
     or exists (select 1 from candidatures c join offres o on o.id = c.offre_id
                where c.user_id = p_user and o.org_id = public.mon_org())
     or exists (select 1 from diplomes d where d.user_id = p_user and d.ecole_id = public.mon_org())
     or exists (select 1 from employes e where e.user_id = p_user and e.org_id = public.mon_org()) $$;

-- Jours ouvrés entre deux dates (week-ends et jours fériés fixes de Côte d'Ivoire exclus)
create or replace function public.jours_ouvres(p_du date, p_au date) returns int
language sql immutable as $$
  select count(*)::int from generate_series(p_du, p_au, interval '1 day') g(d)
  where extract(isodow from d) < 6
    and to_char(d, 'MM-DD') not in ('01-01', '05-01', '08-07', '08-15', '11-01', '11-15', '12-25') $$;

-- ---------------------------------------------------------------------
-- Création automatique du profil à l'inscription
-- (type, nom, prénoms et téléphone viennent du formulaire d'inscription)
-- ---------------------------------------------------------------------
create or replace function public.nouvel_utilisateur() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}');
begin
  insert into profils (id, type, nom, prenoms, telephone)
  values (new.id,
          case when m->>'type' in ('candidat', 'entreprise', 'ecole') then m->>'type' else 'candidat' end,
          left(coalesce(m->>'nom', m->>'family_name', ''), 80),
          left(coalesce(m->>'prenoms', m->>'given_name', ''), 120),
          left(coalesce(m->>'telephone', ''), 30))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists a_l_inscription on auth.users;
create trigger a_l_inscription after insert on auth.users for each row execute function public.nouvel_utilisateur();
-- Comptes créés avant l'installation de ce schéma : on leur crée le profil manquant.
insert into public.profils (id, type, nom, prenoms, telephone)
select u.id,
       case when u.raw_user_meta_data->>'type' in ('candidat', 'entreprise', 'ecole') then u.raw_user_meta_data->>'type' else 'candidat' end,
       left(coalesce(u.raw_user_meta_data->>'nom', u.raw_user_meta_data->>'family_name', ''), 80),
       left(coalesce(u.raw_user_meta_data->>'prenoms', u.raw_user_meta_data->>'given_name', ''), 120),
       left(coalesce(u.raw_user_meta_data->>'telephone', ''), 30)
from auth.users u
on conflict (id) do nothing;

create or replace function public.maj_profil() returns trigger language plpgsql as $$
begin new.maj := now(); return new; end $$;
drop trigger if exists profil_maj on public.profils;
create trigger profil_maj before update on public.profils for each row execute function public.maj_profil();

-- ---------------------------------------------------------------------
-- Règles d'accès (RLS)
-- ---------------------------------------------------------------------
alter table public.organisations       enable row level security;
alter table public.organisations_codes enable row level security;
alter table public.profils             enable row level security;
alter table public.diplomes            enable row level security;
alter table public.offres              enable row level security;
alter table public.candidatures        enable row level security;
alter table public.employes            enable row level security;
alter table public.conges              enable row level security;

-- Personne n'écrit directement : les modifications sensibles passent par les fonctions plus bas.
revoke insert, update, delete on public.organisations, public.organisations_codes, public.profils,
  public.diplomes, public.candidatures, public.employes, public.conges from anon, authenticated;
revoke all on public.organisations, public.organisations_codes, public.profils, public.diplomes,
  public.offres, public.candidatures, public.employes, public.conges from anon;

-- Droits de lecture explicites pour les comptes connectés (les projets Supabase récents ne les donnent
-- plus automatiquement) ; ce que chacun voit vraiment reste filtré par les règles RLS ci-dessous.
grant usage on schema public to anon, authenticated;
grant select on public.organisations, public.organisations_codes, public.profils, public.diplomes,
  public.offres, public.candidatures, public.employes, public.conges to authenticated;

-- Organisations : noms visibles par tous les comptes (pour choisir son école) ; modifiables par les membres.
drop policy if exists org_lecture on public.organisations;
create policy org_lecture on public.organisations for select to authenticated using (true);
grant update (nom, ville, secteur) on public.organisations to authenticated;
drop policy if exists org_modif on public.organisations;
create policy org_modif on public.organisations for update to authenticated
  using (public.est_membre(id)) with check (public.est_membre(id));

drop policy if exists code_lecture on public.organisations_codes;
create policy code_lecture on public.organisations_codes for select to authenticated using (public.est_membre(org_id));

-- Profils : chacun modifie ses informations personnelles (pas son type ni son organisation).
drop policy if exists profil_lecture on public.profils;
create policy profil_lecture on public.profils for select to authenticated using (public.peut_voir_personne(id));
grant update (nom, prenoms, telephone, ville, formation) on public.profils to authenticated;
drop policy if exists profil_modif on public.profils;
create policy profil_modif on public.profils for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Diplômes : le candidat les déclare (en attente) ; l'école les valide par une fonction.
drop policy if exists diplome_lecture on public.diplomes;
create policy diplome_lecture on public.diplomes for select to authenticated
  using (user_id = auth.uid() or ecole_id = public.mon_org() or public.peut_voir_personne(user_id));
grant insert (ecole_id, intitule, filiere, annee) on public.diplomes to authenticated;
drop policy if exists diplome_ajout on public.diplomes;
create policy diplome_ajout on public.diplomes for insert to authenticated
  with check (user_id = auth.uid() and statut = 'en_attente'
              and exists (select 1 from organisations o where o.id = ecole_id and o.type = 'ecole'));
grant delete on public.diplomes to authenticated;
drop policy if exists diplome_retrait on public.diplomes;
create policy diplome_retrait on public.diplomes for delete to authenticated using (user_id = auth.uid());

-- Offres : les offres ouvertes sont visibles par tous ; l'entreprise gère les siennes.
grant select, insert, update, delete on public.offres to authenticated;
drop policy if exists offre_lecture on public.offres;
create policy offre_lecture on public.offres for select to authenticated using (statut = 'ouverte' or public.est_membre(org_id));
drop policy if exists offre_ajout on public.offres;
create policy offre_ajout on public.offres for insert to authenticated
  with check (public.est_membre(org_id) and public.mon_type() = 'entreprise' and shortlist_validee = false);
drop policy if exists offre_modif on public.offres;
create policy offre_modif on public.offres for update to authenticated
  using (public.est_membre(org_id)) with check (public.est_membre(org_id));
drop policy if exists offre_retrait on public.offres;
create policy offre_retrait on public.offres for delete to authenticated using (public.est_membre(org_id));

-- Candidatures : le candidat voit les siennes, l'entreprise celles reçues par ses offres.
drop policy if exists candidature_lecture on public.candidatures;
create policy candidature_lecture on public.candidatures for select to authenticated
  using (user_id = auth.uid() or public.est_membre(public.org_offre(offre_id)));

-- Personnel : le service RH gère ses salariés ; chaque salarié voit sa fiche.
grant insert (org_id, nom, poste, service, contrat, fin, solde) on public.employes to authenticated;
grant update (nom, poste, service, contrat, fin, solde) on public.employes to authenticated;
grant delete on public.employes to authenticated;
drop policy if exists employe_lecture on public.employes;
create policy employe_lecture on public.employes for select to authenticated
  using (user_id = auth.uid() or public.est_membre(org_id));
drop policy if exists employe_ajout on public.employes;
create policy employe_ajout on public.employes for insert to authenticated
  with check (public.est_membre(org_id) and public.mon_type() = 'entreprise');
drop policy if exists employe_modif on public.employes;
create policy employe_modif on public.employes for update to authenticated
  using (public.est_membre(org_id) and public.mon_type() = 'entreprise') with check (public.est_membre(org_id));
drop policy if exists employe_retrait on public.employes;
create policy employe_retrait on public.employes for delete to authenticated
  using (public.est_membre(org_id) and public.mon_type() = 'entreprise');

-- Congés : le salarié voit les siens, le service RH ceux de son entreprise.
drop policy if exists conge_lecture on public.conges;
create policy conge_lecture on public.conges for select to authenticated
  using (public.mon_employe(employe_id) or public.est_membre(public.org_employe(employe_id)));

-- ---------------------------------------------------------------------
-- Fonctions appelées par l'application (messages d'erreur en français)
-- ---------------------------------------------------------------------
create or replace function public.creer_organisation(p_nom text, p_ville text default '', p_secteur text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare t text; o uuid; c text;
begin
  select type into t from profils where id = auth.uid();
  if t is null then raise exception 'Connectez-vous d''abord.' using errcode = 'P0001'; end if;
  if t = 'candidat' then raise exception 'Un compte candidat ne peut pas créer d''entreprise ni d''école.' using errcode = 'P0001'; end if;
  if public.mon_org() is not null then raise exception 'Votre compte est déjà rattaché à une organisation.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_nom, ''))) < 2 then raise exception 'Indiquez le nom (au moins 2 caractères).' using errcode = 'P0001'; end if;
  insert into organisations (type, nom, ville, secteur, cree_par)
    values (t, btrim(p_nom), left(btrim(coalesce(p_ville, '')), 80), left(btrim(coalesce(p_secteur, '')), 80), auth.uid())
    returning id into o;
  loop
    c := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    begin insert into organisations_codes values (o, c); exit; exception when unique_violation then end;
  end loop;
  update profils set org_id = o where id = auth.uid();
  return jsonb_build_object('id', o, 'code', c);
end $$;

create or replace function public.rejoindre_organisation(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t text; o uuid; ot text;
begin
  select type into t from profils where id = auth.uid();
  if t is null or t = 'candidat' then raise exception 'Seuls les comptes entreprise ou école peuvent rejoindre une organisation.' using errcode = 'P0001'; end if;
  select oc.org_id, og.type into o, ot from organisations_codes oc join organisations og on og.id = oc.org_id
    where oc.code = upper(btrim(coalesce(p_code, '')));
  if o is null then raise exception 'Code inconnu. Vérifiez-le auprès de votre collègue.' using errcode = 'P0001'; end if;
  if ot <> t then raise exception 'Ce code correspond à une organisation d''un autre type.' using errcode = 'P0001'; end if;
  update profils set org_id = o where id = auth.uid();
  return jsonb_build_object('id', o);
end $$;

create or replace function public.postuler(p_offre uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if public.mon_type() is distinct from 'candidat' then raise exception 'Seuls les comptes candidat peuvent postuler.' using errcode = 'P0001'; end if;
  if not exists (select 1 from offres where id = p_offre and statut = 'ouverte') then
    raise exception 'Cette offre n''est plus ouverte.' using errcode = 'P0001'; end if;
  if exists (select 1 from candidatures where offre_id = p_offre and user_id = auth.uid()) then
    raise exception 'Vous avez déjà postulé à cette offre.' using errcode = 'P0001'; end if;
  insert into candidatures (offre_id, user_id) values (p_offre, auth.uid()) returning id into c;
  return jsonb_build_object('id', c);
end $$;

create or replace function public.retirer_candidature(p_cand uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from candidatures where id = p_cand and user_id = auth.uid() and statut in ('Entretien IA à passer', 'Entretien IA passé');
  if not found then raise exception 'Cette candidature ne peut plus être retirée.' using errcode = 'P0001'; end if;
  return '{}'::jsonb;
end $$;

create or replace function public.entretien_consentir(p_cand uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update candidatures set consentement = true, consenti_le = now(), maj = now()
    where id = p_cand and user_id = auth.uid() and statut = 'Entretien IA à passer';
  if not found then raise exception 'Entretien introuvable ou déjà terminé.' using errcode = 'P0001'; end if;
  return '{}'::jsonb;
end $$;

-- Score SIMULÉ (aucune vraie IA) : longueur des réponses et présence d'exemples concrets.
-- À remplacer par l'appel à un modèle d'IA dans une version ultérieure.
create or replace function public.score_simule(p_reponses jsonb)
returns jsonb language plpgsql immutable as $$
declare txt text := ''; r jsonb; base int; bonus int; mots int;
begin
  for r in select * from jsonb_array_elements(p_reponses) loop
    txt := txt || ' ' || coalesce(r->>'r1', '') || ' ' || coalesce(r->>'r2', '');
  end loop;
  mots := coalesce(array_length(regexp_split_to_array(btrim(txt), '\s+'), 1), 0);
  base := least(90, 45 + length(txt) / 25);
  bonus := case when txt ~* '([0-9]|résultat|exemple|j''ai|risque|équipe)' then 5 else 0 end;
  return jsonb_build_object(
    'scores', jsonb_build_array(greatest(40, least(95, base + bonus)), greatest(40, least(95, base)),
                                greatest(40, least(95, base + 3)), greatest(40, least(95, base + bonus - 2))),
    'resume', 'Score simulé (démo, sans IA) : ' || mots || ' mots au total'
              || case when bonus > 0 then ', avec des exemples concrets.' else ', peu d''exemples concrets.' end);
end $$;

create or replace function public.entretien_repondre(p_cand uuid, p_texte text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c candidatures; rep jsonb; cur jsonb; s jsonb; nb constant int := 5;
begin
  select * into c from candidatures where id = p_cand and user_id = auth.uid() for update;
  if c.id is null or c.statut <> 'Entretien IA à passer' then raise exception 'Entretien introuvable ou déjà terminé.' using errcode = 'P0001'; end if;
  if not c.consentement then raise exception 'Donnez d''abord votre accord pour l''entretien.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_texte, ''))) < 10 then raise exception 'Merci de développer un peu votre réponse.' using errcode = 'P0001'; end if;
  p_texte := left(btrim(p_texte), 3000);
  rep := c.reponses;
  cur := coalesce(rep -> c.etape, '{}'::jsonb);
  if cur ? 'r1' then
    cur := cur || jsonb_build_object('r2', p_texte);
    rep := jsonb_set(rep, array[c.etape::text], cur);
    if c.etape < nb - 1 then
      update candidatures set reponses = rep, etape = c.etape + 1, maj = now() where id = c.id;
    else
      s := public.score_simule(rep);
      update candidatures set reponses = rep, statut = 'Entretien IA passé', maj = now(),
        scores = array(select (jsonb_array_elements_text(s->'scores'))::int), resume = s->>'resume' where id = c.id;
      return jsonb_build_object('termine', true);
    end if;
  else
    cur := jsonb_build_object('r1', p_texte);
    if jsonb_array_length(rep) > c.etape then rep := jsonb_set(rep, array[c.etape::text], cur); else rep := rep || jsonb_build_array(cur); end if;
    update candidatures set reponses = rep, maj = now() where id = c.id;
  end if;
  return jsonb_build_object('termine', false);
end $$;

create or replace function public.verifier_recruteur(p_offre uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if public.mon_type() is distinct from 'entreprise' or not public.est_membre(public.org_offre(p_offre)) then
    raise exception 'Vous n''avez pas accès à cette offre.' using errcode = 'P0001'; end if;
end $$;

create or replace function public.basculer_shortlist(p_cand uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  select offre_id into o from candidatures where id = p_cand;
  perform public.verifier_recruteur(o);
  if (select shortlist_validee from offres where id = o) then raise exception 'La short-list est déjà validée.' using errcode = 'P0001'; end if;
  update candidatures set shortlist = not shortlist, maj = now() where id = p_cand and statut = 'Entretien IA passé';
  if not found then raise exception 'Seuls les candidats ayant passé l''entretien peuvent être présélectionnés.' using errcode = 'P0001'; end if;
  return '{}'::jsonb;
end $$;

create or replace function public.valider_shortlist(p_offre uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public.verifier_recruteur(p_offre);
  update candidatures set statut = 'Présélectionné(e)', maj = now()
    where offre_id = p_offre and shortlist and statut = 'Entretien IA passé';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Cochez au moins un candidat.' using errcode = 'P0001'; end if;
  update offres set shortlist_validee = true where id = p_offre;
  return jsonb_build_object('nombre', n);
end $$;

create or replace function public.refuser_candidature(p_cand uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  select offre_id into o from candidatures where id = p_cand;
  perform public.verifier_recruteur(o);
  update candidatures set statut = 'Non retenu(e)', shortlist = false, maj = now() where id = p_cand and statut <> 'Retenu(e)';
  return '{}'::jsonb;
end $$;

create or replace function public.embaucher(p_cand uuid, p_poste text, p_contrat text, p_fin date, p_service text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c candidatures; o offres; nm text; e uuid;
begin
  select * into c from candidatures where id = p_cand;
  if c.id is null then raise exception 'Candidature introuvable.' using errcode = 'P0001'; end if;
  perform public.verifier_recruteur(c.offre_id);
  if exists (select 1 from employes where candidature_id = c.id) then raise exception 'Cette personne a déjà été ajoutée au personnel.' using errcode = 'P0001'; end if;
  select * into o from offres where id = c.offre_id;
  select btrim(prenoms || ' ' || nom) into nm from profils where id = c.user_id;
  insert into employes (org_id, user_id, nom, poste, service, contrat, fin, candidature_id)
    values (o.org_id, c.user_id, coalesce(nullif(nm, ''), 'Nouveau salarié'), coalesce(nullif(btrim(p_poste), ''), o.titre),
            coalesce(btrim(p_service), ''), coalesce(p_contrat, 'CDD'), p_fin, c.id)
    returning id into e;
  update candidatures set statut = 'Retenu(e)', maj = now() where id = c.id;
  return jsonb_build_object('employe', e);
end $$;

create or replace function public.decider_diplome(p_id uuid, p_valide boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public.mon_type() is distinct from 'ecole' then raise exception 'Réservé aux écoles.' using errcode = 'P0001'; end if;
  update diplomes set statut = case when p_valide then 'valide' else 'refuse' end, decide_le = now()
    where id = p_id and ecole_id = public.mon_org();
  if not found then raise exception 'Diplôme introuvable.' using errcode = 'P0001'; end if;
  return '{}'::jsonb;
end $$;

create or replace function public.valider_tous_diplomes()
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if public.mon_type() is distinct from 'ecole' then raise exception 'Réservé aux écoles.' using errcode = 'P0001'; end if;
  update diplomes set statut = 'valide', decide_le = now() where ecole_id = public.mon_org() and statut = 'en_attente';
  get diagnostics n = row_count;
  return jsonb_build_object('nombre', n);
end $$;

create or replace function public.lier_employe(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e uuid;
begin
  update employes set user_id = auth.uid() where code = upper(btrim(coalesce(p_code, ''))) and user_id is null returning id into e;
  if e is null then raise exception 'Code inconnu ou déjà utilisé. Demandez-le à votre service RH.' using errcode = 'P0001'; end if;
  return jsonb_build_object('employe', e);
end $$;

create or replace function public.demander_conge(p_employe uuid, p_du date, p_au date, p_motif text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare e employes; n int; attente int;
begin
  select * into e from employes where id = p_employe and user_id = auth.uid();
  if e.id is null then raise exception 'Fiche salarié introuvable.' using errcode = 'P0001'; end if;
  if p_du is null or p_au is null or p_au < p_du then raise exception 'Vérifiez les dates.' using errcode = 'P0001'; end if;
  if p_au - p_du > 120 then raise exception 'Période trop longue (120 jours au plus).' using errcode = 'P0001'; end if;
  n := public.jours_ouvres(p_du, p_au);
  if n = 0 then raise exception 'Aucun jour ouvré dans cette période.' using errcode = 'P0001'; end if;
  select coalesce(sum(jours), 0) into attente from conges where employe_id = e.id and statut = 'En attente';
  if n + attente > e.solde then raise exception 'Le nombre de jours dépasse votre solde.' using errcode = 'P0001'; end if;
  insert into conges (employe_id, du, au, jours, motif) values (e.id, p_du, p_au, n, left(btrim(coalesce(p_motif, '')), 200));
  return jsonb_build_object('jours', n);
end $$;

create or replace function public.decider_conge(p_id uuid, p_valide boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c conges; e employes;
begin
  select * into c from conges where id = p_id for update;
  if c.id is null then raise exception 'Demande introuvable.' using errcode = 'P0001'; end if;
  select * into e from employes where id = c.employe_id for update;
  if public.mon_type() is distinct from 'entreprise' or not public.est_membre(e.org_id) then
    raise exception 'Vous n''avez pas accès à cette demande.' using errcode = 'P0001'; end if;
  if c.statut <> 'En attente' then raise exception 'Cette demande a déjà été traitée.' using errcode = 'P0001'; end if;
  if p_valide then
    if c.jours > e.solde then raise exception 'Le solde du salarié est insuffisant.' using errcode = 'P0001'; end if;
    update employes set solde = solde - c.jours where id = e.id;
  end if;
  update conges set statut = case when p_valide then 'Validé' else 'Refusé' end, decide_le = now() where id = c.id;
  return '{}'::jsonb;
end $$;

-- Indicateurs de l'école : diplômes déclarés, validés, et insertion via la plateforme, par filière.
create or replace function public.stats_ecole()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o uuid := public.mon_org();
begin
  if public.mon_type() is distinct from 'ecole' or o is null then raise exception 'Réservé aux écoles.' using errcode = 'P0001'; end if;
  return (
    with d as (select * from diplomes where ecole_id = o and statut = 'valide'),
    emp as (select distinct d.user_id, e.org_id from d join employes e on e.user_id = d.user_id)
    select jsonb_build_object(
      'declares', (select count(*) from diplomes where ecole_id = o),
      'valides', (select count(*) from d),
      'en_emploi', (select count(distinct user_id) from emp),
      'entreprises', (select count(distinct org_id) from emp),
      'filieres', coalesce((select jsonb_agg(jsonb_build_object('n', f, 'total', t, 'emploi', em) order by f)
        from (select coalesce(nullif(filiere, ''), 'Autre') f, count(distinct user_id) t,
                     count(distinct user_id) filter (where user_id in (select user_id from emp)) em
              from d group by 1) x), '[]'::jsonb)));
end $$;

create or replace function public.supprimer_mon_compte()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
  return '{}'::jsonb;
end $$;

-- Fonctions : utilisables seulement par les comptes connectés
revoke execute on all functions in schema public from anon, public;
grant execute on function public.creer_organisation(text, text, text), public.rejoindre_organisation(text),
  public.postuler(uuid), public.retirer_candidature(uuid), public.entretien_consentir(uuid), public.entretien_repondre(uuid, text),
  public.basculer_shortlist(uuid), public.valider_shortlist(uuid), public.refuser_candidature(uuid),
  public.embaucher(uuid, text, text, date, text), public.decider_diplome(uuid, boolean), public.valider_tous_diplomes(),
  public.lier_employe(text), public.demander_conge(uuid, date, date, text), public.decider_conge(uuid, boolean),
  public.stats_ecole(), public.supprimer_mon_compte(), public.jours_ouvres(date, date),
  public.mon_org(), public.mon_type(), public.est_membre(uuid), public.org_offre(uuid), public.org_employe(uuid),
  public.mon_employe(uuid), public.peut_voir_personne(uuid)
  to authenticated;
