-- Retake database schema. Run this once in the Supabase SQL editor.
--
-- Design notes
-- ------------
-- The browser only ever holds the anon key, so every table is locked down
-- with row level security and all writes go through the functions at the
-- bottom of this file. A host proves they own a room with a host_key, a
-- player proves they own their seat with a player_key, and the person who
-- made a question set proves it with an edit_key. None of those keys are
-- readable through the API; they only travel in function arguments.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.sets (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'Untitled set',
  questions   jsonb not null default '[]'::jsonb,
  source_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.set_secrets (
  set_id   uuid primary key references public.sets(id) on delete cascade,
  edit_key text not null
);

create table if not exists public.rooms (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,
  set_id               uuid not null references public.sets(id) on delete cascade,
  phase                text not null default 'lobby'
                       check (phase in ('lobby','question','reveal','leaderboard','ended')),
  current_index        int  not null default -1,
  question_started_at  timestamptz,
  seconds_per_question int  not null default 20,
  created_at           timestamptz not null default now()
);

create table if not exists public.room_secrets (
  room_id  uuid primary key references public.rooms(id) on delete cascade,
  host_key text not null
);

create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  name       text not null,
  score      int  not null default 0,
  joined_at  timestamptz not null default now(),
  unique (room_id, name)
);

create table if not exists public.player_secrets (
  player_id  uuid primary key references public.players(id) on delete cascade,
  player_key text not null
);

create table if not exists public.answers (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  question_index int  not null,
  choice         text not null,
  correct        boolean not null,
  ms             int  not null,
  points         int  not null default 0,
  created_at     timestamptz not null default now(),
  unique (room_id, player_id, question_index)
);

create index if not exists answers_room_idx on public.answers (room_id, question_index);
create index if not exists players_room_idx on public.players (room_id);

-- ---------------------------------------------------------------------------
-- Row level security: anyone can read games (names are self-chosen
-- nicknames, results are meant to be shown on a projector); nobody can
-- write directly.
-- ---------------------------------------------------------------------------

alter table public.sets           enable row level security;
alter table public.set_secrets    enable row level security;
alter table public.rooms          enable row level security;
alter table public.room_secrets   enable row level security;
alter table public.players        enable row level security;
alter table public.player_secrets enable row level security;
alter table public.answers        enable row level security;

drop policy if exists "sets are public to read"    on public.sets;
drop policy if exists "rooms are public to read"   on public.rooms;
drop policy if exists "players are public to read" on public.players;
drop policy if exists "answers are public to read" on public.answers;

create policy "sets are public to read"    on public.sets    for select using (true);
create policy "rooms are public to read"   on public.rooms   for select using (true);
create policy "players are public to read" on public.players for select using (true);
create policy "answers are public to read" on public.answers for select using (true);
-- *_secrets tables have RLS on and no policies, so the API cannot read them.

-- Realtime: clients subscribe to these three tables.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table public.players;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'answers'
  ) then
    alter publication supabase_realtime add table public.answers;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Two UUIDs back to back: 256 random bits, no extension needed.
create or replace function public.random_key()
returns text language sql volatile as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
$$;

-- Join codes avoid 0/O and 1/I so they are easy to read off a projector.
create or replace function public.random_code()
returns text language plpgsql volatile as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end $$;

-- ---------------------------------------------------------------------------
-- Question sets
-- ---------------------------------------------------------------------------

create or replace function public.create_set(p_title text, p_questions jsonb, p_source_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_key text := random_key();
begin
  insert into sets (title, questions, source_name)
  values (coalesce(nullif(trim(p_title), ''), 'Untitled set'), p_questions, p_source_name)
  returning id into v_id;
  insert into set_secrets (set_id, edit_key) values (v_id, v_key);
  return jsonb_build_object('id', v_id, 'edit_key', v_key);
end $$;

create or replace function public.update_set(p_id uuid, p_edit_key text, p_title text, p_questions jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from set_secrets where set_id = p_id and edit_key = p_edit_key) then
    raise exception 'not allowed';
  end if;
  update sets
     set title = coalesce(nullif(trim(p_title), ''), title),
         questions = p_questions,
         updated_at = now()
   where id = p_id;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Rooms (one live game of one set)
-- ---------------------------------------------------------------------------

create or replace function public.create_room(p_set_id uuid, p_seconds int default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_id uuid;
  v_key text := random_key();
begin
  loop
    v_code := random_code();
    exit when not exists (select 1 from rooms where code = v_code);
  end loop;
  insert into rooms (code, set_id, seconds_per_question)
  values (v_code, p_set_id, greatest(5, least(120, coalesce(p_seconds, 20))))
  returning id into v_id;
  insert into room_secrets (room_id, host_key) values (v_id, v_key);
  return jsonb_build_object('code', v_code, 'host_key', v_key);
end $$;

-- The host moves the game forward. Every transition goes through here so
-- the server owns question_started_at and nobody can fake the clock.
create or replace function public.host_set_phase(p_code text, p_host_key text, p_phase text, p_index int default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_room rooms%rowtype;
begin
  select r.* into v_room from rooms r
    join room_secrets s on s.room_id = r.id
   where r.code = upper(p_code) and s.host_key = p_host_key;
  if not found then
    raise exception 'not allowed';
  end if;

  update rooms
     set phase = p_phase,
         current_index = coalesce(p_index, current_index),
         question_started_at = case when p_phase = 'question' then now() else question_started_at end
   where id = v_room.id;
  return true;
end $$;

-- A player picks a name and gets a seat. Reusing the same name in a room
-- hands back a fresh key for that seat, which is how a phone that reloaded
-- the page gets back in.
create or replace function public.join_room(p_code text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_room rooms%rowtype;
  v_name text := left(regexp_replace(trim(p_name), '\s+', ' ', 'g'), 24);
  v_player_id uuid;
  v_key text := random_key();
begin
  if v_name = '' then
    raise exception 'name required';
  end if;
  select * into v_room from rooms where code = upper(p_code);
  if not found then
    raise exception 'no such game';
  end if;
  if v_room.phase = 'ended' then
    raise exception 'game over';
  end if;

  select id into v_player_id from players where room_id = v_room.id and lower(name) = lower(v_name);
  if found then
    update player_secrets set player_key = v_key where player_id = v_player_id;
  else
    insert into players (room_id, name) values (v_room.id, v_name) returning id into v_player_id;
    insert into player_secrets (player_id, player_key) values (v_player_id, v_key);
  end if;
  return jsonb_build_object('player_id', v_player_id, 'player_key', v_key, 'name', v_name);
end $$;

-- Scoring: a right answer is worth 500, plus up to 500 more the faster it
-- came in. The server measures the time, so a slow phone can't be gamed.
create or replace function public.submit_answer(p_code text, p_player_key text, p_question_index int, p_choice text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_room rooms%rowtype;
  v_player players%rowtype;
  v_question jsonb;
  v_correct boolean;
  v_ms int;
  v_points int := 0;
  v_limit_ms int;
begin
  select r.* into v_room from rooms r where r.code = upper(p_code);
  if not found then raise exception 'no such game'; end if;

  select p.* into v_player from players p
    join player_secrets s on s.player_id = p.id
   where p.room_id = v_room.id and s.player_key = p_player_key;
  if not found then raise exception 'not allowed'; end if;

  if v_room.phase <> 'question' or v_room.current_index <> p_question_index then
    raise exception 'too late';
  end if;

  select questions -> p_question_index into v_question from sets where id = v_room.set_id;
  if v_question is null then raise exception 'no such question'; end if;

  v_ms := greatest(0, (extract(epoch from (now() - v_room.question_started_at)) * 1000)::int);
  v_limit_ms := v_room.seconds_per_question * 1000;
  v_correct := (v_question ->> 'answer') = p_choice;
  if v_correct then
    v_points := 500 + round(500 * greatest(0, 1 - v_ms::numeric / v_limit_ms))::int;
  end if;

  insert into answers (room_id, player_id, question_index, choice, correct, ms, points)
  values (v_room.id, v_player.id, p_question_index, p_choice, v_correct, v_ms, v_points);

  update players set score = score + v_points where id = v_player.id;

  return jsonb_build_object('correct', v_correct, 'points', v_points, 'answer', v_question ->> 'answer');
exception
  when unique_violation then
    raise exception 'already answered';
end $$;

grant execute on function public.create_set(text, jsonb, text) to anon, authenticated;
grant execute on function public.update_set(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.create_room(uuid, int) to anon, authenticated;
grant execute on function public.host_set_phase(text, text, text, int) to anon, authenticated;
grant execute on function public.join_room(text, text) to anon, authenticated;
grant execute on function public.submit_answer(text, text, int, text) to anon, authenticated;
revoke execute on function public.random_key() from anon, authenticated, public;
revoke execute on function public.random_code() from anon, authenticated, public;
