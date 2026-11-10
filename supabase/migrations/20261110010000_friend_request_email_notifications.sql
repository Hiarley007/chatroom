alter table public.friend_requests
  add column if not exists email_notification_attempted_at timestamptz,
  add column if not exists email_notification_sent_at timestamptz;

drop function if exists public.send_friend_request_by_email(text);

create function public.send_friend_request_by_email(p_email text)
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

  if v_target is null or v_target = v_actor then
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

revoke all on function public.send_friend_request_by_email(text) from public;
grant execute on function public.send_friend_request_by_email(text) to authenticated;
