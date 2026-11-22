-- =====================================================================
-- SchuBe Studis – Datenbank einrichten
-- Läuft im bestehenden Supabase-Projekt von praxisNA Live (Tabellen mit
-- Präfix sb_). Benutzt die vorhandene Tabelle «moderierende» und die
-- Funktion public.ist_moderation() aus praxisNA Live für das Login.
-- Im Supabase-Dashboard: SQL Editor → New query → alles einfügen → Run.
-- Das Skript kann gefahrlos mehrmals ausgeführt werden.
-- =====================================================================

create extension if not exists pgcrypto;

-- Treffen: eine Durchführung mit Code.
-- zustand = { offen: {einstieg, ideen, best, heraus}, wand_handy, loesung: {punkte, muenzen} }
create table if not exists public.sb_treffen (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  titel      text not null,
  datum      date,
  zustand    jsonb not null default '{"offen":{"einstieg":true,"ideen":false,"best":false,"heraus":false},"wand_handy":false,"loesung":{"punkte":false,"muenzen":false}}'::jsonb,
  created_at timestamptz not null default now()
);

-- Post-its (anonym; token = zufällige Geräte-ID, bei Moderation leer)
create table if not exists public.sb_postits (
  id         uuid primary key default gen_random_uuid(),
  treffen_id uuid not null references public.sb_treffen(id) on delete cascade,
  block      text not null check (block in ('ideen','best','heraus')),
  token      uuid,
  text       text not null check (length(text) between 1 and 300),
  farbe      text not null default 'gelb' check (farbe in ('gelb','pink','gruen','blau')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sb_postits_treffen_idx on public.sb_postits (treffen_id);

-- Gelöste Denkaufgaben (nur Anzahl, anonym)
create table if not exists public.sb_geloest (
  treffen_id uuid not null references public.sb_treffen(id) on delete cascade,
  aufgabe    text not null check (aufgabe in ('punkte','muenzen')),
  token      uuid not null,
  created_at timestamptz not null default now(),
  primary key (treffen_id, aufgabe, token)
);

-- Zugriff: Tabellen nur für Moderierende; Teilnehmende nur über Funktionen.
alter table public.sb_treffen enable row level security;
alter table public.sb_postits enable row level security;
alter table public.sb_geloest enable row level security;
revoke all on public.sb_treffen, public.sb_postits, public.sb_geloest from anon;
grant select, insert, update, delete on public.sb_treffen, public.sb_postits, public.sb_geloest to authenticated;

drop policy if exists sb_mod_treffen on public.sb_treffen;
create policy sb_mod_treffen on public.sb_treffen for all to authenticated
  using (public.ist_moderation()) with check (public.ist_moderation());
drop policy if exists sb_mod_postits on public.sb_postits;
create policy sb_mod_postits on public.sb_postits for all to authenticated
  using (public.ist_moderation()) with check (public.ist_moderation());
drop policy if exists sb_mod_geloest on public.sb_geloest;
create policy sb_mod_geloest on public.sb_geloest for all to authenticated
  using (public.ist_moderation()) with check (public.ist_moderation());

-- ---------------------------------------------------------------------
-- Funktionen für Teilnehmende (ohne Login)
-- ---------------------------------------------------------------------
create or replace function public.sb_status(p_code text, p_token uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'titel', t.titel,
    'offen', t.zustand -> 'offen',
    'wand_handy', coalesce((t.zustand ->> 'wand_handy')::boolean, false),
    'meine', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'block', p.block, 'text', p.text) order by p.created_at)
                       from public.sb_postits p where p.treffen_id = t.id and p.token = p_token), '[]'::jsonb),
    'alle', case when coalesce((t.zustand ->> 'wand_handy')::boolean, false) then
              coalesce((select jsonb_agg(jsonb_build_object('block', p.block, 'text', p.text, 'farbe', p.farbe) order by p.created_at)
                        from public.sb_postits p
                        where p.treffen_id = t.id
                          and coalesce((t.zustand -> 'offen' ->> p.block)::boolean, false)), '[]'::jsonb)
            else '[]'::jsonb end,
    'geloest', coalesce((select jsonb_agg(g.aufgabe) from public.sb_geloest g
                         where g.treffen_id = t.id and g.token = p_token), '[]'::jsonb)
  )
  from public.sb_treffen t
  where upper(t.code) = upper(trim(p_code))
  limit 1;
$$;

create or replace function public.sb_postit_speichern(p_code text, p_token uuid, p_block text, p_id uuid, p_text text)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_t public.sb_treffen%rowtype;
  v_text text := trim(coalesce(p_text, ''));
  v_id uuid;
begin
  if p_token is null or length(v_text) = 0 or length(v_text) > 300 or p_block not in ('ideen','best','heraus') then
    return null;
  end if;
  select * into v_t from public.sb_treffen where upper(code) = upper(trim(p_code));
  if not found or not coalesce((v_t.zustand -> 'offen' ->> p_block)::boolean, false) then
    return null;
  end if;
  if p_id is not null then
    update public.sb_postits set text = v_text, updated_at = now()
     where id = p_id and treffen_id = v_t.id and token = p_token and block = p_block
     returning id into v_id;
    return v_id;
  end if;
  if (select count(*) from public.sb_postits where treffen_id = v_t.id and token = p_token) >= 40 then
    return null;
  end if;
  insert into public.sb_postits (treffen_id, block, token, text)
  values (v_t.id, p_block, p_token, v_text) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.sb_postit_loeschen(p_code text, p_token uuid, p_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_n int;
begin
  delete from public.sb_postits p
   using public.sb_treffen t
   where p.id = p_id and p.token = p_token and p.treffen_id = t.id
     and upper(t.code) = upper(trim(p_code))
     and coalesce((t.zustand -> 'offen' ->> p.block)::boolean, false);
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

create or replace function public.sb_geloest_melden(p_code text, p_token uuid, p_aufgabe text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_t public.sb_treffen%rowtype;
begin
  if p_token is null or p_aufgabe not in ('punkte','muenzen') then return false; end if;
  select * into v_t from public.sb_treffen where upper(code) = upper(trim(p_code));
  if not found or not coalesce((v_t.zustand -> 'offen' ->> 'einstieg')::boolean, false) then return false; end if;
  insert into public.sb_geloest (treffen_id, aufgabe, token) values (v_t.id, p_aufgabe, p_token)
  on conflict do nothing;
  return true;
end;
$$;

revoke all on function public.sb_status(text, uuid) from public;
revoke all on function public.sb_postit_speichern(text, uuid, text, uuid, text) from public;
revoke all on function public.sb_postit_loeschen(text, uuid, uuid) from public;
revoke all on function public.sb_geloest_melden(text, uuid, text) from public;
grant execute on function public.sb_status(text, uuid) to anon, authenticated;
grant execute on function public.sb_postit_speichern(text, uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.sb_postit_loeschen(text, uuid, uuid) to anon, authenticated;
grant execute on function public.sb_geloest_melden(text, uuid, text) to anon, authenticated;

-- Fertig. Prüfen: select * from public.sb_treffen;
