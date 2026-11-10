begin;

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create or replace function public.touch_user_presence()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_last_seen_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Sessão necessária.' using errcode = '28000';
  end if;

  update public.profiles
  set last_seen_at = now()
  where id = v_user_id
  returning last_seen_at into v_last_seen_at;

  return v_last_seen_at;
end;
$$;

revoke all on function public.touch_user_presence() from public;
grant execute on function public.touch_user_presence() to authenticated;

commit;
