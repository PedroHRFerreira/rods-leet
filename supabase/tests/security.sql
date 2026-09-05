begin;
do $$
declare r jsonb; lease jsonb; blocked boolean=false;
begin
 if not public.bff_nonce(repeat('a',64)) or public.bff_nonce(repeat('a',64)) then raise exception 'replay accepted'; end if;
 if not public.security_rate('test',1,60) or public.security_rate('test',1,60) then raise exception 'rate exceeded'; end if;
 r=public.bff_session('oauth-put',repeat('b',64),'encrypted');
 if public.bff_session('get',repeat('b',64)) is not null then raise exception 'oauth confused with session'; end if;
 if public.bff_session('oauth-take',repeat('b',64))->>'payload'<>'encrypted' or public.bff_session('oauth-take',repeat('b',64)) is not null then raise exception 'oauth reuse'; end if;
 r=public.bff_session('create',repeat('c',64),'encrypted');
 lease=public.bff_session('claim',repeat('c',64));
 if public.bff_session('claim',repeat('c',64)) is not null then raise exception 'concurrent refresh owner'; end if;
 if public.bff_session('update',repeat('c',64),'evil',1,gen_random_uuid()) is not null then raise exception 'wrong owner'; end if;
 r=public.bff_session('update',repeat('c',64),'new',1,(lease->>'owner')::uuid);
 if (r->>'version')::integer<>2 then raise exception 'version not incremented'; end if;
 if public.bff_session('update',repeat('c',64),'old',1,(lease->>'owner')::uuid) is not null then raise exception 'stale writer'; end if;
 perform public.bff_session('delete',repeat('c',64));
 if public.bff_session('update',repeat('c',64),'revived',2,(lease->>'owner')::uuid) is not null then raise exception 'logout resurrected'; end if;
 perform public.bff_session('create',repeat('d',64),'encrypted');
 update private.bff_sessions set touched_at=now()-interval '3 hours' where id=repeat('d',64);
 if public.bff_session('get',repeat('d',64)) is not null then raise exception 'idle session accepted'; end if;
 perform public.bind_request('00000000-0000-0000-0000-000000000001','key','POST:/attempts',repeat('a',64));
 perform public.bind_request('00000000-0000-0000-0000-000000000001','key','POST:/attempts',repeat('a',64));
 begin
 perform public.bind_request('00000000-0000-0000-0000-000000000001','key','POST:/attempts',repeat('b',64));
 exception when others then if sqlerrm='idempotency_conflict' then blocked=true; else raise; end if; end;
 if not blocked then raise exception 'changed payload accepted'; end if;
 if has_function_privilege('authenticated','public.bff_session(text,text,text,bigint,uuid)','execute') then raise exception 'browser can access sessions'; end if;
 if has_table_privilege('anon','private.bff_sessions','select') then raise exception 'anonymous session read'; end if;
end $$;
rollback;
