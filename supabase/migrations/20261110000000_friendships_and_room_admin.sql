-- Aplicar depois de supabase/schema.sql nos projetos que já usam o esquema base.
-- Esta migração pode ser reaplicada: tabelas, colunas, índices, políticas e
-- gatilhos são criados de forma incremental.

begin;

-- Papéis de participação. O usuário que criou uma sala sempre é administrador.
alter table public.room_members
  add column if not exists role text not null default 'member';

update public.room_members set role = 'member' where role is null;
alter table public.room_members alter column role set default 'member';
alter table public.room_members alter column role set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.room_members'::regclass
      and conname = 'room_members_role_check'
  ) then
    alter table public.room_members
      add constraint room_members_role_check check (role in ('admin', 'member'));
  end if;
end;
$$;

update public.room_members as members
set role = 'admin'
from public.rooms as rooms
where rooms.id = members.room_id
  and rooms.created_by = members.user_id
  and members.role <> 'admin';

insert into public.room_members (room_id, user_id, role)
select id, created_by, 'admin' from public.rooms
on conflict (room_id, user_id) do update set role = 'admin';

create or replace function public.is_room_admin(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_room_admin(uuid) from public;
grant execute on function public.is_room_admin(uuid) to authenticated;

create or replace function public.add_room_creator_as_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.room_members (room_id, user_id, role)
  values (new.id, new.created_by, 'admin')
  on conflict (room_id, user_id) do update set role = 'admin';
  return new;
end;
$$;

drop trigger if exists room_creator_membership on public.rooms;
create trigger room_creator_membership
  after insert on public.rooms
  for each row execute function public.add_room_creator_as_admin();

drop policy if exists "Membros: entrar como eu mesmo" on public.room_members;
create policy "Membros: entrar como eu mesmo"
  on public.room_members for insert to authenticated
  with check (user_id = auth.uid() and role = 'member');

drop policy if exists "Membros: sair (apagar a própria linha)" on public.room_members;
create policy "Membros: sair (apagar a própria linha)"
  on public.room_members for delete to authenticated
  using (user_id = auth.uid() and role = 'member');

drop policy if exists "Salas: apagar como administrador" on public.rooms;
create policy "Salas: apagar como administrador"
  on public.rooms for delete to authenticated
  using (public.is_room_admin(id));
grant delete on public.rooms to authenticated;

-- A solicitação mantém histórico do resultado; amizades aceitas ficam numa
-- relação canônica para que não dependam de quem iniciou o pedido.
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'canceled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_distinct_users check (requester_id <> addressee_id)
);

create unique index if not exists friend_requests_one_pending_per_pair_idx
  on public.friend_requests (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where status = 'pending';
create index if not exists friend_requests_addressee_pending_idx
  on public.friend_requests (addressee_id, created_at desc)
  where status = 'pending';
create index if not exists friend_requests_requester_pending_idx
  on public.friend_requests (requester_id, created_at desc)
  where status = 'pending';

create table if not exists public.friendships (
  user_low uuid not null references public.profiles (id) on delete cascade,
  user_high uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  constraint friendships_sorted_users check (user_low < user_high)
);

create index if not exists friendships_user_high_idx
  on public.friendships (user_high, user_low);

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "Pedidos de amizade: participantes leem" on public.friend_requests;
create policy "Pedidos de amizade: participantes leem"
  on public.friend_requests for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Amizades: participantes leem" on public.friendships;
create policy "Amizades: participantes leem"
  on public.friendships for select to authenticated
  using (auth.uid() = user_low or auth.uid() = user_high);

revoke all on public.friend_requests, public.friendships from anon, authenticated;
grant select on public.friend_requests, public.friendships to authenticated;

create table if not exists public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  invited_user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint room_invites_distinct_users check (invited_user_id <> invited_by)
);

create unique index if not exists room_invites_one_pending_per_user_idx
  on public.room_invites (room_id, invited_user_id)
  where status = 'pending';
create index if not exists room_invites_user_pending_idx
  on public.room_invites (invited_user_id, created_at desc)
  where status = 'pending';

alter table public.room_invites enable row level security;

drop policy if exists "Convites de sala: destinatário ou admin lê" on public.room_invites;
create policy "Convites de sala: destinatário ou admin lê"
  on public.room_invites for select to authenticated
  using (invited_user_id = auth.uid() or public.is_room_admin(room_id));

revoke all on public.room_invites from anon, authenticated;
grant select on public.room_invites to authenticated;

-- O perfil de outra pessoa só aparece quando há uma relação de amizade,
-- solicitação pendente, convite ou participação conjunta numa sala.
create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null and (
    p_profile_id = auth.uid()
    or exists (
      select 1 from public.friendships
      where (user_low = auth.uid() and user_high = p_profile_id)
         or (user_high = auth.uid() and user_low = p_profile_id)
    )
    or exists (
      select 1 from public.friend_requests
      where status = 'pending'
        and ((requester_id = auth.uid() and addressee_id = p_profile_id)
          or (addressee_id = auth.uid() and requester_id = p_profile_id))
    )
    or exists (
      select 1 from public.room_invites
      where status = 'pending'
        and ((invited_by = auth.uid() and invited_user_id = p_profile_id)
          or (invited_user_id = auth.uid() and invited_by = p_profile_id))
    )
    or exists (
      select 1
      from public.room_members as mine
      join public.room_members as theirs on theirs.room_id = mine.room_id
      where mine.user_id = auth.uid() and theirs.user_id = p_profile_id
    )
  );
$$;

revoke all on function public.can_view_profile(uuid) from public;
grant execute on function public.can_view_profile(uuid) to authenticated;

drop policy if exists "Perfis: leitura para quem está logado" on public.profiles;
drop policy if exists "Perfis: leitura por relações" on public.profiles;
create policy "Perfis: leitura por relações"
  on public.profiles for select to authenticated
  using (public.can_view_profile(id));

create or replace function public.send_friend_request_by_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_target uuid;
begin
  if v_actor is null then
    raise exception 'Sessão necessária.' using errcode = '28000';
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));
  if char_length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;

  select id into v_target
  from auth.users
  where lower(btrim(email)) = v_email
  limit 1;

  if v_target is null or v_target = v_actor then
    return;
  end if;

  if exists (
    select 1 from public.friendships
    where user_low = least(v_actor, v_target)
      and user_high = greatest(v_actor, v_target)
  ) or exists (
    select 1 from public.friend_requests
    where status = 'pending'
      and ((requester_id = v_actor and addressee_id = v_target)
        or (requester_id = v_target and addressee_id = v_actor))
  ) then
    return;
  end if;

  insert into public.friend_requests (requester_id, addressee_id)
  values (v_actor, v_target);
exception
  when unique_violation then
    -- Outra tentativa simultânea já criou o pedido pendente.
    return;
end;
$$;

create or replace function public.respond_friend_request(
  p_request_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.friend_requests%rowtype;
begin
  if v_actor is null or p_request_id is null or p_accept is null then
    raise exception 'Pedido inválido.' using errcode = '22023';
  end if;

  select * into v_request
  from public.friend_requests
  where id = p_request_id
  for update;

  if not found or v_request.addressee_id <> v_actor or v_request.status <> 'pending' then
    raise exception 'Pedido indisponível.' using errcode = '22023';
  end if;

  update public.friend_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_request_id;

  if p_accept then
    insert into public.friendships (user_low, user_high)
    values (
      least(v_request.requester_id, v_request.addressee_id),
      greatest(v_request.requester_id, v_request.addressee_id)
    )
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  update public.friend_requests
  set status = 'canceled', responded_at = now()
  where id = p_request_id
    and requester_id = v_actor
    and status = 'pending';

  if not found then
    raise exception 'Pedido indisponível.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.invite_room_member_by_email(
  p_room_id uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_target uuid;
begin
  if v_actor is null or p_room_id is null or not public.is_room_admin(p_room_id) then
    raise exception 'Ação não permitida.' using errcode = '42501';
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));
  if char_length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;

  select id into v_target
  from auth.users
  where lower(btrim(email)) = v_email
  limit 1;

  if v_target is null or v_target = v_actor
    or exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_target) then
    return;
  end if;

  insert into public.room_invites (room_id, invited_user_id, invited_by)
  values (p_room_id, v_target, v_actor)
  on conflict (room_id, invited_user_id) where status = 'pending' do nothing;
end;
$$;

create or replace function public.invite_friend_to_room(
  p_room_id uuid,
  p_friend_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or p_room_id is null or not public.is_room_admin(p_room_id) then
    raise exception 'Ação não permitida.' using errcode = '42501';
  end if;

  if p_friend_id is null or p_friend_id = v_actor
    or not exists (
      select 1 from public.friendships
      where (user_low = least(v_actor, p_friend_id)
        and user_high = greatest(v_actor, p_friend_id))
    )
    or exists (select 1 from public.room_members where room_id = p_room_id and user_id = p_friend_id) then
    return;
  end if;

  insert into public.room_invites (room_id, invited_user_id, invited_by)
  values (p_room_id, p_friend_id, v_actor)
  on conflict (room_id, invited_user_id) where status = 'pending' do nothing;
end;
$$;

create or replace function public.respond_room_invite(
  p_invite_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_invite public.room_invites%rowtype;
begin
  if v_actor is null or p_invite_id is null or p_accept is null then
    raise exception 'Convite inválido.' using errcode = '22023';
  end if;

  select * into v_invite
  from public.room_invites
  where id = p_invite_id
  for update;

  if not found or v_invite.invited_user_id <> v_actor or v_invite.status <> 'pending' then
    raise exception 'Convite indisponível.' using errcode = '22023';
  end if;

  update public.room_invites
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_invite_id;

  if p_accept then
    insert into public.room_members (room_id, user_id, role)
    values (v_invite.room_id, v_actor, 'member')
    on conflict (room_id, user_id) do nothing;
  end if;
end;
$$;

revoke all on function public.send_friend_request_by_email(text) from public;
revoke all on function public.respond_friend_request(uuid, boolean) from public;
revoke all on function public.cancel_friend_request(uuid) from public;
revoke all on function public.invite_room_member_by_email(uuid, text) from public;
revoke all on function public.invite_friend_to_room(uuid, uuid) from public;
revoke all on function public.respond_room_invite(uuid, boolean) from public;

grant execute on function public.send_friend_request_by_email(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.invite_room_member_by_email(uuid, text) to authenticated;
grant execute on function public.invite_friend_to_room(uuid, uuid) to authenticated;
grant execute on function public.respond_room_invite(uuid, boolean) to authenticated;

-- Atualiza a aba de Amizades quando chega ou muda um pedido/convite.
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['friend_requests', 'friendships', 'room_invites'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

drop policy if exists "Mensagens: apagar as próprias" on public.messages;
drop policy if exists "Mensagens: apagar próprias ou admin" on public.messages;
create policy "Mensagens: apagar próprias ou admin"
  on public.messages for delete to authenticated
  using (user_id = auth.uid() or public.is_room_admin(room_id));

notify pgrst, 'reload schema';

commit;
