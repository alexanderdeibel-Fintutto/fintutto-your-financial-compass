-- Fix: "database error saving new user" on registration
--
-- Root cause: When handle_new_user() creates a personal company during signup,
-- the on_company_created trigger fires handle_new_company(), which calls auth.uid().
-- During signup, auth.uid() is NULL (no auth session exists yet), causing a
-- NOT NULL constraint violation on company_members.user_id.
-- Additionally, handle_new_user() already inserts the company_members row itself,
-- so handle_new_company() would create a duplicate entry even if auth.uid() worked.
--
-- Fix: Skip personal companies in handle_new_company() since handle_new_user()
-- already handles membership creation for those.

CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Personal companies are created by handle_new_user() which already
  -- handles company_members insertion using NEW.id (the actual user id).
  -- We must skip here because auth.uid() is NULL during signup trigger context.
  IF NEW.is_personal = true THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  RETURN NEW;
END;
$$;
