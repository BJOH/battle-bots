-- ============================================
-- BATTLE BOTS — Database Setup v3
-- Run this in Supabase SQL Editor
-- ============================================

-- Clean up old tables if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS join_match;
DROP FUNCTION IF EXISTS decline_match;
DROP FUNCTION IF EXISTS mark_match_viewed;
DROP FUNCTION IF EXISTS resolve_rps;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS robots;
DROP TABLE IF EXISTS profiles;

-- Profiles
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_robot jsonb,
  wins int default 0,
  losses int default 0,
  created_at timestamptz default now()
);

-- Matches — each match is 1:1 with a specific opponent chosen at creation.
-- choices format: ['rock','paper','scissors']
create table matches (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid references profiles(id) not null,
  challenger_robot jsonb not null,
  challenger_choices jsonb not null,
  target_opponent_id uuid references profiles(id) not null,
  opponent_id uuid references profiles(id),
  opponent_robot jsonb,
  opponent_choices jsonb,
  status text default 'waiting' check (status in ('waiting', 'complete', 'declined')),
  winner_id uuid references profiles(id),
  round_results jsonb,
  challenger_viewed_at timestamptz,
  opponent_viewed_at timestamptz,
  created_at timestamptz default now()
);

create index matches_target_idx on matches(target_opponent_id);
create index matches_challenger_idx on matches(challenger_id);

-- Enable RLS
alter table profiles enable row level security;
alter table matches enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- Matches policies
create policy "Participants can view their matches"
  on matches for select using (
    auth.uid() = challenger_id
    or auth.uid() = target_opponent_id
    or auth.uid() = opponent_id
  );

create policy "Anyone authenticated can view completed matches"
  on matches for select using (status = 'complete' and auth.uid() is not null);

create policy "Users can create matches as themselves"
  on matches for insert with check (auth.uid() = challenger_id);

create policy "Participants can update viewed timestamps"
  on matches for update using (
    auth.uid() = challenger_id or auth.uid() = target_opponent_id or auth.uid() = opponent_id
  );

-- Function to join and resolve a match (Rock/Paper/Scissors)
create or replace function join_match(
  p_match_id uuid,
  p_choices jsonb,
  p_robot jsonb
) returns jsonb as $$
declare
  v_match matches;
  v_result jsonb;
  v_round_results jsonb := '[]'::jsonb;
  v_challenger_wins int := 0;
  v_opponent_wins int := 0;
  v_c_move text;
  v_o_move text;
  v_round_winner text;
  v_winner_id uuid;
begin
  select * into v_match from matches where id = p_match_id for update;

  if v_match is null then
    raise exception 'Match not found';
  end if;

  if v_match.status != 'waiting' then
    raise exception 'Match already resolved';
  end if;

  if v_match.challenger_id = auth.uid() then
    raise exception 'Cannot play against yourself';
  end if;

  if v_match.target_opponent_id != auth.uid() then
    raise exception 'This challenge is not for you';
  end if;

  if jsonb_array_length(p_choices) != 3 then
    raise exception 'Must provide exactly 3 rounds';
  end if;

  for i in 0..2 loop
    v_c_move := v_match.challenger_choices->>i;
    v_o_move := p_choices->>i;

    if v_c_move = v_o_move then
      v_round_winner := 'draw';
    elsif (v_c_move = 'rock' and v_o_move = 'scissors')
       or (v_c_move = 'paper' and v_o_move = 'rock')
       or (v_c_move = 'scissors' and v_o_move = 'paper') then
      v_round_winner := 'challenger';
      v_challenger_wins := v_challenger_wins + 1;
    else
      v_round_winner := 'opponent';
      v_opponent_wins := v_opponent_wins + 1;
    end if;

    v_round_results := v_round_results || jsonb_build_object(
      'round', i + 1,
      'challenger_move', v_c_move,
      'opponent_move', v_o_move,
      'winner', v_round_winner
    );
  end loop;

  if v_challenger_wins > v_opponent_wins then
    v_winner_id := v_match.challenger_id;
  elsif v_opponent_wins > v_challenger_wins then
    v_winner_id := auth.uid();
  else
    v_winner_id := null;
  end if;

  update matches set
    opponent_id = auth.uid(),
    opponent_robot = p_robot,
    opponent_choices = p_choices,
    status = 'complete',
    winner_id = v_winner_id,
    round_results = v_round_results,
    opponent_viewed_at = now()
  where id = p_match_id;

  if v_winner_id is not null then
    update profiles set wins = wins + 1 where id = v_winner_id;
    if v_winner_id = v_match.challenger_id then
      update profiles set losses = losses + 1 where id = auth.uid();
    else
      update profiles set losses = losses + 1 where id = v_match.challenger_id;
    end if;
  end if;

  select jsonb_build_object(
    'match_id', p_match_id,
    'round_results', v_round_results,
    'challenger_wins', v_challenger_wins,
    'opponent_wins', v_opponent_wins,
    'winner_id', v_winner_id
  ) into v_result;

  return v_result;
end;
$$ language plpgsql security definer;

-- Decline an incoming challenge
create or replace function decline_match(p_match_id uuid) returns void as $$
declare
  v_match matches;
begin
  select * into v_match from matches where id = p_match_id for update;
  if v_match is null then
    raise exception 'Match not found';
  end if;
  if v_match.target_opponent_id != auth.uid() then
    raise exception 'This challenge is not for you';
  end if;
  if v_match.status != 'waiting' then
    raise exception 'Match already resolved';
  end if;
  update matches set status = 'declined' where id = p_match_id;
end;
$$ language plpgsql security definer;

-- Mark a completed match as viewed by the current user
create or replace function mark_match_viewed(p_match_id uuid) returns void as $$
declare
  v_match matches;
begin
  select * into v_match from matches where id = p_match_id;
  if v_match is null then return; end if;
  if auth.uid() = v_match.challenger_id then
    update matches set challenger_viewed_at = now() where id = p_match_id and challenger_viewed_at is null;
  elsif auth.uid() = v_match.opponent_id then
    update matches set opponent_viewed_at = now() where id = p_match_id and opponent_viewed_at is null;
  end if;
end;
$$ language plpgsql security definer;

-- Profile creation is handled in app code (app.js)
