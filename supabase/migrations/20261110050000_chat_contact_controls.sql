begin;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_distinct_users check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;
drop policy if exists "Bloqueios: quem bloqueou pode consultar" on public.user_blocks;
create policy "Bloqueios: quem bloqueou pode consultar"
  on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid());
revoke all on public.user_blocks from anon, authenticated;
grant select on public.user_blocks to authenticated;

create table if not exists public.direct_conversation_clears (
  conversation_id uuid not null references public.direct_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  cleared_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.direct_conversation_clears enable row level security;
drop policy if exists "Histórico direto apagado: cada pessoa consulta o próprio" on public.direct_conversation_clears;
create policy "Histórico direto apagado: cada pessoa consulta o próprio"
  on public.direct_conversation_clears for select to authenticated
  using (user_id = auth.uid());
revoke all on public.direct_conversation_clears from anon, authenticated;
grant select on public.direct_conversation_clears to authenticated;

create or replace function public.is_blocked_between(p_first_user uuid, p_second_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = p_first_user and blocked_id = p_second_user)
       or (blocker_id = p_second_user and blocked_id = p_first_user)
  );
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

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
    or exists (
      select 1 from public.user_blocks
      where blocker_id = auth.uid() and blocked_id = p_profile_id
    )
  );
$$;

create or replace function public.is_direct_conversation_member(p_conversation_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.direct_conversations as conversation
    join public.friendships as friendship
      on friendship.user_low = conversation.user_low
      and friendship.user_high = conversation.user_high
    where conversation.id = p_conversation_id
      and auth.uid() in (conversation.user_low, conversation.user_high)
      and not public.is_blocked_between(conversation.user_low, conversation.user_high)
  );
$$;

drop policy if exists "Conversas diretas: participantes leem" on public.direct_conversations;
create policy "Conversas diretas: participantes leem"
  on public.direct_conversations for select to authenticated
  using (public.is_direct_conversation_member(id));

create or replace function public.get_or_create_direct_conversation(p_friend_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_conversation_id uuid;
begin
  if v_actor is null then
    raise exception 'Sessão necessária.' using errcode = '28000';
  end if;
  if p_friend_id is null or p_friend_id = v_actor then
    raise exception 'Escolha outra pessoa para conversar.' using errcode = '22023';
  end if;

  v_low := least(v_actor, p_friend_id);
  v_high := greatest(v_actor, p_friend_id);

  if public.is_blocked_between(v_actor, p_friend_id) then
    raise exception 'Esta conversa não está disponível.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.friendships
    where user_low = v_low and user_high = v_high
  ) then
    raise exception 'Conversas individuais só estão disponíveis entre amigos.'
      using errcode = '42501';
  end if;

  insert into public.direct_conversations (user_low, user_high)
  values (v_low, v_high)
  on conflict (user_low, user_high) do nothing
  returning id into v_conversation_id;

  if v_conversation_id is null then
    select id into v_conversation_id
    from public.direct_conversations
    where user_low = v_low and user_high = v_high;
  end if;

  return v_conversation_id;
end;
$$;

create or replace function public.clear_direct_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_low uuid;
  v_high uuid;
begin
  if v_actor is null or p_conversation_id is null then
    raise exception 'Conversa inválida.' using errcode = '22023';
  end if;

  select user_low, user_high into v_low, v_high
  from public.direct_conversations
  where id = p_conversation_id;

  if not found or v_actor not in (v_low, v_high)
    or public.is_blocked_between(v_low, v_high)
    or not exists (
      select 1 from public.friendships
      where user_low = v_low and user_high = v_high
    ) then
    raise exception 'Conversa não encontrada.' using errcode = '42501';
  end if;

  insert into public.direct_conversation_clears (conversation_id, user_id, cleared_at)
  values (p_conversation_id, v_actor, clock_timestamp())
  on conflict (conversation_id, user_id)
  do update set cleared_at = excluded.cleared_at;
end;
$$;

create or replace function public.remove_direct_friendship(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_low uuid;
  v_high uuid;
begin
  if v_actor is null or p_friend_id is null or p_friend_id = v_actor then
    raise exception 'Amizade inválida.' using errcode = '22023';
  end if;

  v_low := least(v_actor, p_friend_id);
  v_high := greatest(v_actor, p_friend_id);

  delete from public.friendships
  where user_low = v_low and user_high = v_high;
  if not found then
    raise exception 'Esta amizade não está mais ativa.' using errcode = '22023';
  end if;

  delete from public.direct_conversations
  where user_low = v_low and user_high = v_high;
end;
$$;

create or replace function public.block_direct_contact(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_low uuid;
  v_high uuid;
begin
  if v_actor is null or p_blocked_id is null or p_blocked_id = v_actor then
    raise exception 'Pessoa inválida.' using errcode = '22023';
  end if;

  v_low := least(v_actor, p_blocked_id);
  v_high := greatest(v_actor, p_blocked_id);

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_actor, p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.friendships
  where user_low = v_low and user_high = v_high;
  delete from public.friend_requests
  where (requester_id = v_actor and addressee_id = p_blocked_id)
     or (requester_id = p_blocked_id and addressee_id = v_actor);
  delete from public.room_invites
  where (invited_by = v_actor and invited_user_id = p_blocked_id)
     or (invited_by = p_blocked_id and invited_user_id = v_actor);
  delete from public.direct_conversations
  where user_low = v_low and user_high = v_high;
end;
$$;

create or replace function public.unblock_direct_contact(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or p_blocked_id is null or p_blocked_id = v_actor then
    raise exception 'Pessoa inválida.' using errcode = '22023';
  end if;

  delete from public.user_blocks
  where blocker_id = v_actor and blocked_id = p_blocked_id;
end;
$$;

create or replace function public.can_access_direct_audio(p_name text, p_upload boolean default false)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
begin
  if auth.uid() is null or array_length(v_parts, 1) <> 3 then
    return false;
  end if;
  if p_upload and v_parts[2] <> auth.uid()::text then
    return false;
  end if;

  return public.is_direct_conversation_member(v_parts[1]::uuid);
exception
  when invalid_text_representation then
    return false;
end;
$$;

create or replace function public.send_friend_request_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_target uuid;
  v_request_id uuid;
  v_requester_id uuid;
  v_email_sent_at timestamptz;
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

  if v_target is null or v_target = v_actor
    or public.is_blocked_between(v_actor, v_target) then
    return null;
  end if;

  if exists (
    select 1 from public.friendships
    where user_low = least(v_actor, v_target)
      and user_high = greatest(v_actor, v_target)
  ) then
    return null;
  end if;

  select id, requester_id, email_notification_sent_at
    into v_request_id, v_requester_id, v_email_sent_at
  from public.friend_requests
  where status = 'pending'
    and ((requester_id = v_actor and addressee_id = v_target)
      or (requester_id = v_target and addressee_id = v_actor))
  limit 1;

  if v_request_id is not null then
    if v_requester_id = v_actor and v_email_sent_at is null then
      return v_request_id;
    end if;
    return null;
  end if;

  insert into public.friend_requests (requester_id, addressee_id)
  values (v_actor, v_target)
  returning id into v_request_id;

  return v_request_id;
exception
  when unique_violation then
    select id, requester_id, email_notification_sent_at
      into v_request_id, v_requester_id, v_email_sent_at
    from public.friend_requests
    where status = 'pending'
      and ((requester_id = v_actor and addressee_id = v_target)
        or (requester_id = v_target and addressee_id = v_actor))
    limit 1;

    if v_requester_id = v_actor and v_email_sent_at is null then
      return v_request_id;
    end if;
    return null;
end;
$$;

create or replace function public.invite_room_member_by_email(
  p_room_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_target uuid;
  v_invite_id uuid;
  v_invited_by uuid;
  v_email_sent_at timestamptz;
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
    or public.is_blocked_between(v_actor, v_target)
    or exists (
      select 1 from public.room_members
      where room_id = p_room_id and user_id = v_target
    ) then
    return null;
  end if;

  insert into public.room_invites (room_id, invited_user_id, invited_by)
  values (p_room_id, v_target, v_actor)
  on conflict (room_id, invited_user_id) where status = 'pending' do nothing
  returning id into v_invite_id;

  if v_invite_id is not null then
    return v_invite_id;
  end if;

  select id, invited_by, email_notification_sent_at
    into v_invite_id, v_invited_by, v_email_sent_at
  from public.room_invites
  where room_id = p_room_id and invited_user_id = v_target and status = 'pending'
  limit 1;

  if v_invited_by = v_actor and v_email_sent_at is null then
    return v_invite_id;
  end if;
  return null;
end;
$$;

create or replace function public.invite_friend_to_room(
  p_room_id uuid,
  p_friend_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_invite_id uuid;
  v_invited_by uuid;
  v_email_sent_at timestamptz;
begin
  if v_actor is null or p_room_id is null or not public.is_room_admin(p_room_id) then
    raise exception 'Ação não permitida.' using errcode = '42501';
  end if;

  if p_friend_id is null or p_friend_id = v_actor
    or public.is_blocked_between(v_actor, p_friend_id)
    or not exists (
      select 1 from public.friendships
      where user_low = least(v_actor, p_friend_id)
        and user_high = greatest(v_actor, p_friend_id)
    )
    or exists (
      select 1 from public.room_members
      where room_id = p_room_id and user_id = p_friend_id
    ) then
    return null;
  end if;

  insert into public.room_invites (room_id, invited_user_id, invited_by)
  values (p_room_id, p_friend_id, v_actor)
  on conflict (room_id, invited_user_id) where status = 'pending' do nothing
  returning id into v_invite_id;

  if v_invite_id is not null then
    return v_invite_id;
  end if;

  select id, invited_by, email_notification_sent_at
    into v_invite_id, v_invited_by, v_email_sent_at
  from public.room_invites
  where room_id = p_room_id and invited_user_id = p_friend_id and status = 'pending'
  limit 1;

  if v_invited_by = v_actor and v_email_sent_at is null then
    return v_invite_id;
  end if;
  return null;
end;
$$;

revoke all on function public.clear_direct_conversation(uuid) from public;
revoke all on function public.remove_direct_friendship(uuid) from public;
revoke all on function public.block_direct_contact(uuid) from public;
revoke all on function public.unblock_direct_contact(uuid) from public;
revoke all on function public.send_friend_request_by_email(text) from public;
revoke all on function public.invite_room_member_by_email(uuid, text) from public;
revoke all on function public.invite_friend_to_room(uuid, uuid) from public;
grant execute on function public.clear_direct_conversation(uuid) to authenticated;
grant execute on function public.remove_direct_friendship(uuid) to authenticated;
grant execute on function public.block_direct_contact(uuid) to authenticated;
grant execute on function public.unblock_direct_contact(uuid) to authenticated;
grant execute on function public.send_friend_request_by_email(text) to authenticated;
grant execute on function public.invite_room_member_by_email(uuid, text) to authenticated;
grant execute on function public.invite_friend_to_room(uuid, uuid) to authenticated;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function public.is_direct_conversation_member(uuid) to authenticated;
grant execute on function public.can_access_direct_audio(text, boolean) to authenticated;

do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'user_blocks',
      'direct_conversation_clears',
      'direct_conversations'
    ] loop
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

notify pgrst, 'reload schema';

commit;
