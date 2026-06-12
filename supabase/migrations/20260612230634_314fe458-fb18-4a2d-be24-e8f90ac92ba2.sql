drop policy if exists "extension_requests read" on public.extension_requests;

create policy "extension_requests read"
on public.extension_requests
for select
to authenticated
using (
  requested_by = auth.uid()
  or public.is_director_or_supervisor(auth.uid())
  or office_id = public.current_user_office_id()
);