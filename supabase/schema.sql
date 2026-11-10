-- ChatRoom: esquema do banco (execute no SQL Editor do Supabase).
-- Pode ser executado novamente se as tabelas existentes já tiverem a estrutura
-- deste esquema. IF NOT EXISTS não corrige tabelas com colunas incompatíveis.

-- 1) Perfis --------------------------------------------------------------
-- Uma linha por usuário, criada automaticamente (veja o gatilho abaixo).
-- É daqui que vêm o nome e a cor mostrados nas mensagens.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  avatar_color text not null default '#2563EB',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Perfis: leitura para quem está logado" on public.profiles;
create policy "Perfis: leitura para quem está logado"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Perfis: atualizar o próprio" on public.profiles;
create policy "Perfis: atualizar o próprio"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

grant select, update on public.profiles to authenticated;

-- Gatilho: toda vez que alguém se cadastra (uma linha nova em auth.users),
-- criamos o perfil correspondente sozinhos. "security definer" é necessário
-- aqui porque o gatilho roda no meio do cadastro, antes de existir sessão.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_color)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    (array['#2563EB', '#7C3AED', '#DB2777', '#059669', '#D97706', '#DC2626', '#0891B2'])
      [1 + floor(random() * 7)]
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Salas ----------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 60),
  description text not null default '',
  emoji text not null default '💬',
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

drop policy if exists "Salas: leitura para quem está logado" on public.rooms;
create policy "Salas: leitura para quem está logado"
  on public.rooms for select to authenticated using (true);

drop policy if exists "Salas: criar como dono" on public.rooms;
create policy "Salas: criar como dono"
  on public.rooms for insert to authenticated
  with check (auth.uid() = created_by);

grant select, insert on public.rooms to authenticated;

-- 3) Participação nas salas ------------------------------------------------
-- Entrar numa sala é um ato explícito: só quem tem uma linha aqui consegue
-- ler ou mandar mensagem naquela sala (políticas de "messages" abaixo).
create table if not exists public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.room_members enable row level security;

-- "Você está nesta sala?" — numa função à parte, e não direto na política.
-- Uma política de "room_members" que consultasse "room_members" de novo
-- reaplicaria essa MESMA política à subconsulta, causando recursão infinita
-- de verdade (o Postgres recusa com o erro "infinite recursion detected").
-- Com "security definer", a função consulta a tabela ignorando o RLS por
-- dentro, e a política só chama a função — sem se referenciar de volta.
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

drop policy if exists "Membros: a própria linha e os colegas de sala" on public.room_members;
create policy "Membros: a própria linha e os colegas de sala"
  on public.room_members for select to authenticated
  using (user_id = auth.uid() or public.is_room_member(room_id));

drop policy if exists "Membros: entrar como eu mesmo" on public.room_members;
create policy "Membros: entrar como eu mesmo"
  on public.room_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Membros: sair (apagar a própria linha)" on public.room_members;
create policy "Membros: sair (apagar a própria linha)"
  on public.room_members for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.room_members to authenticated;

-- 4) Mensagens --------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_room_idx on public.messages (room_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "Mensagens: ler as das salas em que estou" on public.messages;
create policy "Mensagens: ler as das salas em que estou"
  on public.messages for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "Mensagens: enviar nas salas em que estou" on public.messages;
create policy "Mensagens: enviar nas salas em que estou"
  on public.messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id));

drop policy if exists "Mensagens: apagar as próprias" on public.messages;
create policy "Mensagens: apagar as próprias"
  on public.messages for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.messages to authenticated;

-- 5) Tempo real ---------------------------------------------------------
-- Sem isto, os inserts em "messages" acontecem no banco mas não chegam aos
-- outros usuários conectados: é este publish que liga a tabela ao Realtime.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- 6) Convites por e-mail -----------------------------------------------------
create table if not exists public.room_invites (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms (id) on delete cascade,
  email       text not null check (char_length(email) between 5 and 254 and position('@' in email) > 1),
  token       uuid not null unique default gen_random_uuid(),
  invited_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz
);

create index if not exists room_invites_room_idx on public.room_invites (room_id);

alter table public.room_invites enable row level security;

drop policy if exists "Convites: membros veem os da sala" on public.room_invites;
create policy "Convites: membros veem os da sala"
  on public.room_invites for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "Convites: membros convidam" on public.room_invites;
create policy "Convites: membros convidam"
  on public.room_invites for insert to authenticated
  with check (invited_by = auth.uid() and public.is_room_member(room_id));

drop policy if exists "Convites: quem convidou pode cancelar" on public.room_invites;
create policy "Convites: quem convidou pode cancelar"
  on public.room_invites for delete to authenticated
  using (invited_by = auth.uid());

grant select, insert, delete on public.room_invites to authenticated;

create or replace function public.accept_invite(p_token uuid)
returns uuid
language plpgsql security definer
set search_path = public as $$
declare
  v_invite public.room_invites;
begin
  select i.* into v_invite
  from public.room_invites i
  where i.token = p_token
    and i.accepted_at is null
    and i.expires_at > now()
    and lower(i.email) = lower((select u.email from auth.users u where u.id = auth.uid()))
  for update;

  if not found then
    raise exception 'Convite inválido, expirado ou destinado a outro e-mail';
  end if;

  insert into public.room_members (room_id, user_id)
  values (v_invite.room_id, auth.uid())
  on conflict do nothing;

  update public.room_invites set accepted_at = now() where id = v_invite.id;

  return v_invite.room_id;
end;
$$;

revoke all on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;

-- Atualiza o cache de esquema usado pelo PostgREST.
notify pgrst, 'reload schema';
