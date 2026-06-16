-- Create public.cats table
create table public.cats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  breed text not null,
  affection integer not null default 50,
  hunger integer not null default 30,
  energy integer not null default 70,
  gender text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.cats enable row level security;

-- Policies for public.cats
create policy "Users can view their own cats" on public.cats
  for select to authenticated using (auth.uid() = user_id);

create policy "Users can insert their own cats" on public.cats
  for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update their own cats" on public.cats
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own cats" on public.cats
  for delete to authenticated using (auth.uid() = user_id);
