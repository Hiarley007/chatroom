begin;

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references public.profiles (id) on delete cascade,
  user_high uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_preview text not null default '',
  last_message_type text,
  constraint direct_conversations_distinct_users check (user_low < user_high),
  constraint direct_conversations_pair_unique unique (user_low, user_high)
);

create index if not exists direct_conversations_user_low_idx
  on public.direct_conversations (user_low, updated_at desc);
create index if not exists direct_conversations_user_high_idx
  on public.direct_conversations (user_high, updated_at desc);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message_type text not null default 'text' check (message_type in ('text', 'audio')),
  body text not null default '',
  audio_path text,
  audio_duration_ms integer,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint direct_messages_content_check check (
    (message_type = 'text'
      and char_length(trim(body)) between 1 and 2000
      and audio_path is null
      and audio_duration_ms is null)
    or (message_type = 'audio'
      and body = ''
      and audio_path is not null
      and audio_duration_ms is not null
      and audio_duration_ms between 0 and 600000)
  )
);

alter table public.direct_messages
  add column if not exists read_at timestamptz;

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at desc);

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

create or replace function public.is_direct_conversation_member(p_conversation_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.direct_conversations
    where id = p_conversation_id
      and auth.uid() in (user_low, user_high)
  );
$$;

revoke all on function public.is_direct_conversation_member(uuid) from public;
grant execute on function public.is_direct_conversation_member(uuid) to authenticated;

drop policy if exists "Conversas diretas: participantes leem" on public.direct_conversations;
create policy "Conversas diretas: participantes leem"
  on public.direct_conversations for select to authenticated
  using (auth.uid() in (user_low, user_high));

drop policy if exists "Mensagens diretas: participantes leem" on public.direct_messages;
create policy "Mensagens diretas: participantes leem"
  on public.direct_messages for select to authenticated
  using (public.is_direct_conversation_member(conversation_id));

drop policy if exists "Mensagens diretas: participantes enviam" on public.direct_messages;
create policy "Mensagens diretas: participantes enviam"
  on public.direct_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_direct_conversation_member(conversation_id)
    and read_at is null
    and (
      audio_path is null
      or audio_path like conversation_id::text || '/' || auth.uid()::text || '/%'
    )
  );

drop policy if exists "Mensagens diretas: destinatários marcam leitura" on public.direct_messages;
create policy "Mensagens diretas: destinatários marcam leitura"
  on public.direct_messages for update to authenticated
  using (
    sender_id <> auth.uid()
    and public.is_direct_conversation_member(conversation_id)
    and read_at is null
  )
  with check (
    sender_id <> auth.uid()
    and public.is_direct_conversation_member(conversation_id)
    and read_at is not null
  );

revoke all on public.direct_conversations, public.direct_messages from anon, authenticated;
grant select on public.direct_conversations to authenticated;
grant select, insert on public.direct_messages to authenticated;
grant update (read_at) on public.direct_messages to authenticated;

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

revoke all on function public.get_or_create_direct_conversation(uuid) from public;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

create or replace function public.update_direct_conversation_preview()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.direct_conversations
  set updated_at = new.created_at,
      last_message_type = new.message_type,
      last_message_preview = case
        when new.message_type = 'audio' then '🎤 Mensagem de áudio'
        else left(new.body, 140)
      end
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists direct_messages_update_conversation_preview on public.direct_messages;
create trigger direct_messages_update_conversation_preview
  after insert on public.direct_messages
  for each row execute function public.update_direct_conversation_preview();

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

  return exists (
    select 1 from public.direct_conversations
    where id::text = v_parts[1]
      and auth.uid() in (user_low, user_high)
  );
end;
$$;

revoke all on function public.can_access_direct_audio(text, boolean) from public;
grant execute on function public.can_access_direct_audio(text, boolean) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'direct-audio',
  'direct-audio',
  false,
  10485760,
  array['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/webm', 'audio/3gpp', 'audio/aac']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Áudios diretos: participantes escutam" on storage.objects;
create policy "Áudios diretos: participantes escutam"
  on storage.objects for select to authenticated
  using (bucket_id = 'direct-audio' and public.can_access_direct_audio(name));

drop policy if exists "Áudios diretos: participantes enviam" on storage.objects;
create policy "Áudios diretos: participantes enviam"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'direct-audio' and public.can_access_direct_audio(name, true));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'direct_messages'
    ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
