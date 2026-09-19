-- Investorer skal ikke kunne lese teamets profiler.
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Interne kan se profiler"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.er_intern(auth.uid()) OR auth.uid() = user_id);