-- Fix: Make companies INSERT policy PERMISSIVE (was RESTRICTIVE, blocking all inserts)
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
CREATE POLICY "Users can create companies" 
ON public.companies 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also fix SELECT and UPDATE policies to be PERMISSIVE
DROP POLICY IF EXISTS "Users can view companies they belong to" ON public.companies;
CREATE POLICY "Users can view companies they belong to" 
ON public.companies 
FOR SELECT 
TO authenticated
USING (is_company_member(id));

DROP POLICY IF EXISTS "Members can update company" ON public.companies;
CREATE POLICY "Members can update company" 
ON public.companies 
FOR UPDATE 
TO authenticated
USING (is_company_member(id));

-- Create the missing trigger for automatic company member creation
CREATE OR REPLACE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_company();