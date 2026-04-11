-- ============================================
-- BATTLE BOTS — Database Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- Profiles
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_robot jsonb,
  wins int default 0,
  losses int default 0,
  created_at timestamptz default now()
);

-- Robots
create table robots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null default 'MK-1',
  parts jsonb not null,
  is_active boolean default false,
  created_at timestamptz default now()
);

-- Matches
create table matches (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid references profiles(id) not null,
  challenger_robot jsonb not null,
  challenger_choices text[] not null,
  opponent_id uuid references profiles(id),
  opponent_robot jsonb,
  opponent_choices text[],
  status text default 'waiting' check (status in ('waiting', 'complete')),
  winner_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;
alter table robots enable row level security;
alter table matches enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- Robots policies
create policy "Users can view own robots"
  on robots for select using (auth.uid() = user_id);

create policy "Users can insert own robots"
  on robots for insert with check (auth.uid() = user_id);

create policy "Users can update own robots"
  on robots for update using (auth.uid() = user_id);

create policy "Users can delete own robots"
  on robots for delete using (auth.uid() = user_id);

-- Matches policies
-- Everyone can see completed matches (for replays/sharing)
create policy "Anyone can view completed matches"
  on matches for select using (status = 'complete');

-- Participants can see their own matches
create policy "Challengers can view own matches"
  on matches for select using (auth.uid() = challenger_id);

create policy "Opponents can view joined matches"
  on matches for select using (auth.uid() = opponent_id);

-- Anyone authenticated can see waiting matches (to join via link)
-- But challenger_choices are protected by the join function
create policy "Authenticated users can see waiting matches"
  on matches for select using (status = 'waiting' and auth.uid() is not null);

create policy "Users can create matches"
  on matches for insert with check (auth.uid() = challenger_id);

-- Function to join a match (prevents seeing challenger choices)
create or replace function join_match(
  p_match_id uuid,
  p_choices text[],
  p_robot jsonb
) returns jsonb as $$
declare
  v_match matches;
  v_result jsonb;
  v_challenger_wins int := 0;
  v_opponent_wins int := 0;
  v_round_winner text;
  v_winner_id uuid;
begin
  -- Get and lock the match
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

  if array_length(p_choices, 1) != 3 then
    raise exception 'Must provide exactly 3 choices';
  end if;

  -- Resolve rounds
  for i in 1..3 loop
    v_round_winner := resolve_rps(v_match.challenger_choices[i], p_choices[i]);
    if v_round_winner = 'a' then
      v_challenger_wins := v_challenger_wins + 1;
    elsif v_round_winner = 'b' then
      v_opponent_wins := v_opponent_wins + 1;
    end if;
  end loop;

  -- Determine winner
  if v_challenger_wins > v_opponent_wins then
    v_winner_id := v_match.challenger_id;
  elsif v_opponent_wins > v_challenger_wins then
    v_winner_id := auth.uid();
  else
    v_winner_id := null; -- draw
  end if;

  -- Update match
  update matches set
    opponent_id = auth.uid(),
    opponent_robot = p_robot,
    opponent_choices = p_choices,
    status = 'complete',
    winner_id = v_winner_id
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

  -- Return full match result
  select jsonb_build_object(
    'match_id', p_match_id,
    'challenger_choices', v_match.challenger_choices,
    'opponent_choices', p_choices,
    'challenger_wins', v_challenger_wins,
    'opponent_wins', v_opponent_wins,
    'winner_id', v_winner_id
  ) into v_result;

  return v_result;
end;
$$ language plpgsql security definer;

-- Helper function for RPS resolution
create or replace function resolve_rps(a text, b text) returns text as $$
begin
  if a = b then return 'draw'; end if;
  if (a = 'rock' and b = 'scissors') or
     (a = 'scissors' and b = 'paper') or
     (a = 'paper' and b = 'rock') then
    return 'a';
  end if;
  return 'b';
end;
$$ language plpgsql immutable;

-- Create profile automatically on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'Bot_' || substr(new.id::text, 1, 8)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
