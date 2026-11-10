begin;

alter table public.room_invites
  add column if not exists email_notification_attempted_at timestamptz,
  add column if not exists email_notification_sent_at timestamptz;

drop function if exists public.invite_room_member_by_email(uuid, text);
create function public.invite_room_member_by_email(
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
  where room_id = p_room_id
    and invited_user_id = v_target
    and status = 'pending'
  limit 1;

  if v_invited_by = v_actor and v_email_sent_at is null then
    return v_invite_id;
  end if;
  return null;
end;
$$;

drop function if exists public.invite_friend_to_room(uuid, uuid);
create function public.invite_friend_to_room(
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
  where room_id = p_room_id
    and invited_user_id = p_friend_id
    and status = 'pending'
  limit 1;

  if v_invited_by = v_actor and v_email_sent_at is null then
    return v_invite_id;
  end if;
  return null;
end;
$$;

revoke all on function public.invite_room_member_by_email(uuid, text) from public;
revoke all on function public.invite_friend_to_room(uuid, uuid) from public;
grant execute on function public.invite_room_member_by_email(uuid, text) to authenticated;
grant execute on function public.invite_friend_to_room(uuid, uuid) to authenticated;

commit;
