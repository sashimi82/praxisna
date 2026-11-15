-- praxisNA Live – Update 2: Memory
-- Im SQL Editor ausführen (darf mehrmals laufen).

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
