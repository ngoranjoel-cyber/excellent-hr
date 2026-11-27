-- Excellent HR — mise à jour « CV » (à lancer une fois dans Supabase › SQL Editor ; on peut le relancer sans risque)
-- CV adapté envoyé avec la candidature (copie figée au moment de postuler)
alter table public.candidatures add column if not exists cv jsonb
  check (cv is null or (jsonb_typeof(cv) = 'object' and pg_column_size(cv) < 120000));

-- CV structuré du candidat : profil, cursus scolaire, formations, expériences, compétences, langues…
create table if not exists public.cv (
  user_id  uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  contenu  jsonb not null default '{}' check (jsonb_typeof(contenu) = 'object' and pg_column_size(contenu) < 120000),
  modele   text not null default 'classique' check (modele in ('classique', 'moderne', 'bambou', 'compact')),
  couleur  text not null default 'vert' check (couleur in ('vert', 'nuit', 'bordeaux', 'ardoise', 'terre')),
  maj      timestamptz not null default now()
);

alter table public.cv enable row level security;
revoke all on public.cv from anon;
grant select on public.cv to authenticated;
drop policy if exists cv_lecture on public.cv;
create policy cv_lecture on public.cv for select to authenticated using (public.peut_voir_personne(user_id));

drop function if exists public.postuler(uuid);
create or replace function public.postuler(p_offre uuid, p_cv jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if public.mon_type() is distinct from 'candidat' then raise exception 'Seuls les comptes candidat peuvent postuler.' using errcode = 'P0001'; end if;
  if not exists (select 1 from offres where id = p_offre and statut = 'ouverte') then
    raise exception 'Cette offre n''est plus ouverte.' using errcode = 'P0001'; end if;
  if exists (select 1 from candidatures where offre_id = p_offre and user_id = auth.uid()) then
    raise exception 'Vous avez déjà postulé à cette offre.' using errcode = 'P0001'; end if;
  if p_cv is not null and (jsonb_typeof(p_cv) <> 'object' or pg_column_size(p_cv) >= 120000) then
    raise exception 'Le CV joint est trop volumineux.' using errcode = 'P0001'; end if;
  insert into candidatures (offre_id, user_id, cv) values (p_offre, auth.uid(), p_cv) returning id into c;
  return jsonb_build_object('id', c);
end $$;

-- Enregistrer son CV (création ou mise à jour)
create or replace function public.enregistrer_cv(p_contenu jsonb, p_modele text default 'classique', p_couleur text default 'vert')
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.' using errcode = 'P0001'; end if;
  if public.mon_type() is distinct from 'candidat' then raise exception 'Le CV est réservé aux comptes candidat.' using errcode = 'P0001'; end if;
  if p_contenu is null or jsonb_typeof(p_contenu) <> 'object' then raise exception 'CV invalide.' using errcode = 'P0001'; end if;
  if pg_column_size(p_contenu) >= 120000 then raise exception 'CV trop long : raccourcissez quelques rubriques.' using errcode = 'P0001'; end if;
  if p_modele not in ('classique', 'moderne', 'bambou', 'compact') then p_modele := 'classique'; end if;
  if p_couleur not in ('vert', 'nuit', 'bordeaux', 'ardoise', 'terre') then p_couleur := 'vert'; end if;
  insert into cv (user_id, contenu, modele, couleur, maj) values (auth.uid(), p_contenu, p_modele, p_couleur, now())
  on conflict (user_id) do update set contenu = excluded.contenu, modele = excluded.modele, couleur = excluded.couleur, maj = now();
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.postuler(uuid, jsonb), public.enregistrer_cv(jsonb, text, text) from anon, public;
grant execute on function public.postuler(uuid, jsonb), public.enregistrer_cv(jsonb, text, text) to authenticated;
