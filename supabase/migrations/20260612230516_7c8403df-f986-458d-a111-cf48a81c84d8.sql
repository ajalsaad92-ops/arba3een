-- Prevent privilege escalation via self-update on profiles.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_director_or_supervisor(auth.uid()) then
    return new;
  end if;

  if (new.special_permissions is distinct from old.special_permissions)
     or (new.permitted_office_ids is distinct from old.permitted_office_ids)
     or (new.office_id is distinct from old.office_id)
     or (new.is_active is distinct from old.is_active)
     or (new.id is distinct from old.id) then
    raise exception 'You are not allowed to modify privileged profile fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_privilege_escalation on public.profiles;

create trigger trg_prevent_profile_privilege_escalation
before update on public.profiles
for each row
execute function public.prevent_profile_privilege_escalation();