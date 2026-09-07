-- The coordinator secret is provisioned directly in the target environment.
-- Keeping credentials out of version control is intentional.
update private.settings
set execution_enabled = coordinator_secret is not null
where coordinator_url = 'https://bsjcuygtpiqyomnulpsw.supabase.co/functions/v1/coordinator';
