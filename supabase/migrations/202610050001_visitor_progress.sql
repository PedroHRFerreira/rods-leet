-- Admission is enforced in the database too, including previously opened attempts.
begin;

create function private.guard_visitor_progress() returns trigger
language plpgsql security definer set search_path='' as $$
declare target text; completed_count integer; reserved_count integer;
begin
 if not exists(select 1 from auth.users where id=new.user_id and is_anonymous=true) then return new; end if;
 -- The same lock is held by start_attempt, submit_quiz and finish_evaluation.
 perform 1 from public.profiles where id=new.user_id for update;
 if tg_table_name='attempts' then target:=new.challenge_id;
 else select challenge_id into target from public.challenge_versions where id=new.challenge_version_id;
 end if;
 if exists(select 1 from public.completions where user_id=new.user_id and challenge_id=target) then return new; end if;
 select count(distinct challenge_id) into completed_count from public.completions where user_id=new.user_id;
 if completed_count>=10 then raise exception 'visitor_challenge_limit'; end if;
 if tg_table_name='submissions' then
 if new.kind='submission' then
  -- An in-flight official evaluation reserves its possible completion slot.
  -- A quiz cannot become the eleventh completion while that evaluation finishes.
  select count(distinct v.challenge_id) into reserved_count
  from public.submissions s join public.challenge_versions v on v.id=s.challenge_version_id
  where s.user_id=new.user_id and s.kind='submission' and s.status<>'finished'
    and v.challenge_id<>target
    and not exists(select 1 from public.completions c where c.user_id=new.user_id and c.challenge_id=v.challenge_id);
  if completed_count+reserved_count>=10 then raise exception 'execution_active'; end if;
 end if;
 end if;
 return new;
end $$;

create trigger guard_visitor_attempt before insert on public.attempts
for each row execute function private.guard_visitor_progress();
create trigger guard_visitor_submission before insert on public.submissions
for each row execute function private.guard_visitor_progress();
revoke all on function private.guard_visitor_progress() from public,anon,authenticated;

commit;
