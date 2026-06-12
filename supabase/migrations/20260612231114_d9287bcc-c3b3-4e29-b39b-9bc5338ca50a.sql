drop trigger if exists trg_prevent_profile_privilege_escalation on public.profiles;

create trigger trg_prevent_profile_privilege_escalation
before update on public.profiles
for each row
execute function public.prevent_profile_privilege_escalation();