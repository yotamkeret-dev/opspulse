-- Enable RLS on company tables (previously unprotected)
ALTER TABLE public.companies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- A user can read only their own membership row
CREATE POLICY "company_members_select_own"
  ON public.company_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- A user can read a company only if they are a member of it
CREATE POLICY "companies_select_for_members"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = companies.id
        AND company_members.user_id    = auth.uid()
    )
  );
