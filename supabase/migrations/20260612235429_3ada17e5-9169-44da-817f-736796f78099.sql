ALTER TABLE public.daily_reports REPLICA IDENTITY FULL;
ALTER TABLE public.emergencies REPLICA IDENTITY FULL;
ALTER TABLE public.extension_requests REPLICA IDENTITY FULL;
ALTER TABLE public.time_windows REPLICA IDENTITY FULL;
ALTER TABLE public.agent_locations REPLICA IDENTITY FULL;
ALTER TABLE public.border_crossings REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergencies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.extension_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_windows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.border_crossings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;