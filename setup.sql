-- ============================================
-- BATTLE BOTS — Database Setup v2
-- Run this in Supabase SQL Editor
-- ============================================

-- Clean up old tables if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS join_match;
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

-- Matches (attack/defense system)
-- Each round: player picks attack (high/mid/low) and defense (high/mid/low)
-- choices format: [{"attack":"high","defense":"mid"}, ...]
create table matches (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid references profiles(id) not null,
  challenger_robot jsonb not null,
  challenger_choices jsonb not null,
  opponent_id uuid references profiles(id),
  opponent_robot jsonb,
  opponent_choices jsonb,
  status text default 'waiting' check (status in ('waiting', 'complete')),
  winner_id uuid references profiles(id),
  round_results jsonb,
  created_at timestamptz default now()
);

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
create policy "Anyone can view completed matches"
  on matches for select using (status = 'complete');

create policy "Challengers can view own matches"
  on matches for select using (auth.uid() = challenger_id);

create policy "Opponents can view joined matches"
  on matches for select using (auth.uid() = opponent_id);

create policy "Authenticated users can see waiting matches"
  on matches for select using (status = 'waiting' and auth.uid() is not null);

create policy "Users can create matches"
  on matches for insert with check (auth.uid() = challenger_id);

-- Function to join and resolve a match
create or replace function join_match(
  p_match_id uuid,
  p_choices jsonb,
  p_robot jsonb
) returns jsonb as $$
declare
  v_match matches;
  v_result jsonb;
  v_round_results jsonb := '[]'::jsonb;
  v_challenger_hits int := 0;
  v_opponent_hits int := 0;
  v_c_choice jsonb;
  v_o_choice jsonb;
  v_c_attack text;
  v_c_defense text;
  v_o_attack text;
  v_o_defense text;
  v_c_hit boolean;
  v_o_hit boolean;
  v_winner_id uuid;
begin
  select * into v_match from matches where id = p_match_id for update;

  if v_match is null then
    raise exception 'Match not found';
  end if;

  if v_match.status != 'waiting' then
    raise exception 'Match already completed';
  end if;

  if v_match.challenger_id = auth.uid() then
    raise exception 'Cannot play against yourself';
  end if;

  if jsonb_array_length(p_choices) != 3 then
    raise exception 'Must provide exactly 3 rounds';
  end if;

  -- Resolve each round
  for i in 0..2 loop
    v_c_choice := v_match.challenger_choices->i;
    v_o_choice := p_choices->i;

    v_c_attack := v_c_choice->>'attack';
    v_c_defense := v_c_choice->>'defense';
    v_o_attack := v_o_choice->>'attack';
    v_o_defense := v_o_choice->>'defense';

    -- Challenger hits if their attack != opponent defense
    v_c_hit := (v_c_attack != v_o_defense);
    -- Opponent hits if their attack != challenger defense
    v_o_hit := (v_o_attack != v_c_defense);

    if v_c_hit then v_challenger_hits := v_challenger_hits + 1; end if;
    if v_o_hit then v_opponent_hits := v_opponent_hits + 1; end if;

    v_round_results := v_round_results || jsonb_build_object(
      'round', i + 1,
      'challenger_attack', v_c_attack,
      'challenger_defense', v_c_defense,
      'opponent_attack', v_o_attack,
      'opponent_defense', v_o_defense,
      'challenger_hit', v_c_hit,
      'opponent_hit', v_o_hit
    );
  end loop;

  -- Determine winner
  if v_challenger_hits > v_opponent_hits then
    v_winner_id := v_match.challenger_id;
  elsif v_opponent_hits > v_challenger_hits then
    v_winner_id := auth.uid();
  else
    v_winner_id := null;
  end if;

  -- Update match
  update matches set
    opponent_id = auth.uid(),
    opponent_robot = p_robot,
    opponent_choices = p_choices,
    status = 'complete',
    winner_id = v_winner_id,
    round_results = v_round_results
  where id = p_match_id;

  -- Update win/loss counters
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
    'challenger_hits', v_challenger_hits,
    'opponent_hits', v_opponent_hits,
    'winner_id', v_winner_id
  ) into v_result;

  return v_result;
end;
$$ language plpgsql security definer;

-- Profile creation is handled in app code (app.js)
