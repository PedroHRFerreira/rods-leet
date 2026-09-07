begin;

update private.settings
set coordinator_url = 'https://bsjcuygtpiqyomnulpsw.supabase.co/functions/v1/coordinator',
    execution_enabled = coordinator_secret is not null;

commit;
