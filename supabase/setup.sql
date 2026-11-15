-- =====================================================================
-- praxisNA Live – Datenbank einrichten
-- Im Supabase-Dashboard: SQL Editor → New query → alles einfügen → Run
-- WICHTIG: Zuerst unten bei «Moderierende» die E-Mail-Adressen eintragen.
-- Das Skript kann gefahrlos mehrmals ausgeführt werden.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Moderierende: nur diese E-Mail-Adressen dürfen Kurse und Bausteine
-- verwalten und Resultate sehen.
-- ---------------------------------------------------------------------
create table if not exists public.moderierende (
  email text primary key
);
alter table public.moderierende enable row level security;
revoke all on public.moderierende from anon, authenticated;

insert into public.moderierende (email) values
  ('DEINE-EMAIL@beispiel.ch')          -- ← ersetzen
  -- , ('KOLLEGIN@beispiel.ch')        -- ← für deine Kollegin: Zeile aktivieren
on conflict do nothing;

create or replace function public.ist_moderation()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.moderierende m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------------
-- Bausteine (Vorlagen): Sätze, Präsenz, Werte, Auswertung
-- ---------------------------------------------------------------------
create table if not exists public.bausteine (
  id         uuid primary key default gen_random_uuid(),
  typ        text not null check (typ in ('saetze','praesenz','werte','auswertung')),
  titel      text not null,
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Kurse: eine Durchführung mit Code und ausgewählten Bausteinen.
-- Die Bausteine werden beim Anlegen kopiert (bloecke), damit spätere
-- Änderungen an Vorlagen alte Resultate nicht verändern.
-- bloecke = [{key, typ, titel, config, offen}]
-- ---------------------------------------------------------------------
create table if not exists public.kurse (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  titel      text not null,
  datum      date,
  bloecke    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Antworten der Teilnehmenden (anonym, ein Eintrag pro Gerät & Baustein)
-- ---------------------------------------------------------------------
create table if not exists public.antworten (
  id         uuid primary key default gen_random_uuid(),
  kurs_id    uuid not null references public.kurse(id) on delete cascade,
  block_key  text not null,
  token      uuid not null,
  gruppe     text,
  daten      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kurs_id, block_key, token)
);
create index if not exists antworten_kurs_idx on public.antworten (kurs_id);

-- ---------------------------------------------------------------------
-- Zugriffsrechte: Tabellen nur für Moderierende.
-- Teilnehmende greifen ausschliesslich über die zwei Funktionen unten zu.
-- ---------------------------------------------------------------------
alter table public.bausteine enable row level security;
alter table public.kurse     enable row level security;
alter table public.antworten enable row level security;

revoke all on public.bausteine, public.kurse, public.antworten from anon;
grant select, insert, update, delete on public.bausteine, public.kurse, public.antworten to authenticated;

drop policy if exists moderation_bausteine on public.bausteine;
create policy moderation_bausteine on public.bausteine
  for all to authenticated using (public.ist_moderation()) with check (public.ist_moderation());

drop policy if exists moderation_kurse on public.kurse;
create policy moderation_kurse on public.kurse
  for all to authenticated using (public.ist_moderation()) with check (public.ist_moderation());

drop policy if exists moderation_antworten on public.antworten;
create policy moderation_antworten on public.antworten
  for all to authenticated using (public.ist_moderation()) with check (public.ist_moderation());

-- ---------------------------------------------------------------------
-- Funktionen für Teilnehmende (ohne Login)
-- ---------------------------------------------------------------------

-- Kurs per Code laden: gibt nur Titel und die geöffneten Bausteine zurück.
create or replace function public.kurs_laden(p_code text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', k.id,
    'titel', k.titel,
    'bloecke', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', b ->> 'key', 'typ', b ->> 'typ',
               'titel', b ->> 'titel', 'config', b -> 'config')
             order by ord)
      from jsonb_array_elements(k.bloecke) with ordinality as t(b, ord)
      where coalesce((b ->> 'offen')::boolean, false)
    ), '[]'::jsonb)
  )
  from public.kurse k
  where upper(k.code) = upper(trim(p_code))
  limit 1;
$$;

-- Antwort speichern bzw. aktualisieren (nur wenn der Baustein offen ist).
create or replace function public.antwort_speichern(
  p_code text, p_block text, p_token uuid, p_gruppe text, p_daten jsonb)
returns boolean
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_kurs public.kurse%rowtype;
begin
  if p_token is null or p_daten is null or length(p_daten::text) > 20000
     or length(coalesce(p_gruppe, '')) > 80 then
    return false;
  end if;

  select * into v_kurs from public.kurse where upper(code) = upper(trim(p_code));
  if not found then
    return false;
  end if;

  if not exists (
    select 1 from jsonb_array_elements(v_kurs.bloecke) b
    where b ->> 'key' = p_block and coalesce((b ->> 'offen')::boolean, false)
  ) then
    return false;
  end if;

  insert into public.antworten (kurs_id, block_key, token, gruppe, daten)
  values (v_kurs.id, p_block, p_token, nullif(trim(p_gruppe), ''), p_daten)
  on conflict (kurs_id, block_key, token)
  do update set daten = excluded.daten, gruppe = excluded.gruppe, updated_at = now();

  return true;
end;
$$;

revoke all on function public.kurs_laden(text) from public;
revoke all on function public.antwort_speichern(text, text, uuid, text, jsonb) from public;
revoke all on function public.ist_moderation() from public;
grant execute on function public.kurs_laden(text) to anon, authenticated;
grant execute on function public.antwort_speichern(text, text, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.ist_moderation() to authenticated;

-- Fertig. Prüfen: select * from public.moderierende;

-- ---------------------------------------------------------------------
-- Memory (Update 2)
-- ---------------------------------------------------------------------
create or replace function public.kurs_laden(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', k.id, 'titel', k.titel, 'bloecke',
    coalesce((select jsonb_agg(jsonb_build_object('key', b->>'key', 'typ', b->>'typ',
        'titel', b->>'titel', 'config', b->'config',
        'offen', coalesce((b->>'offen')::boolean, false),
        'memory', coalesce((b->>'memory')::boolean, false)) order by ord)
      from jsonb_array_elements(k.bloecke) with ordinality as t(b, ord)
      where coalesce((b->>'offen')::boolean, false)
         or coalesce((b->>'memory')::boolean, false)), '[]'::jsonb))
  from public.kurse k
  where upper(k.code) = upper(trim(p_code))
  limit 1;
$$;

create or replace function public.memory_laden(p_code text, p_block text, p_token uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('item', e.key, 'text', e.value, 'gruppe', a.gruppe)), '[]'::jsonb)
  from public.kurse k
  join public.antworten a on a.kurs_id = k.id and a.block_key = p_block
  cross join lateral jsonb_each_text(coalesce(a.daten->'answers', '{}'::jsonb)) e
  where upper(k.code) = upper(trim(p_code))
    and a.token is distinct from p_token
    and trim(e.value) <> ''
    and exists (select 1 from jsonb_array_elements(k.bloecke) b
                where b->>'key' = p_block and coalesce((b->>'memory')::boolean, false));
$$;

revoke all on function public.memory_laden(text, text, uuid) from public;
grant execute on function public.memory_laden(text, text, uuid) to anon, authenticated;
