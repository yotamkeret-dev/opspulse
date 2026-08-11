'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Company = {
  id:    string;
  name:  string;
  slug?: string;
};

export type CompanyContextValue = {
  companyId:      string | null;
  currentCompany: Company | null;
  role:           string | null;
  loading:        boolean;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const CompanyContext = createContext<CompanyContextValue>({
  companyId:      null,
  currentCompany: null,
  role:           null,
  loading:        true,
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function fetchUserCompany(userId: string): Promise<{
  company: Company;
  role: string;
} | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('company_members')
    .select('role, companies(id, name, slug)')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  const raw = data.companies as unknown;
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== 'string' || typeof c.name !== 'string') return null;

  return {
    company: {
      id:   c.id,
      name: c.name,
      slug: typeof c.slug === 'string' ? c.slug : undefined,
    },
    role: typeof data.role === 'string' ? data.role : 'member',
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<CompanyContextValue>({
    companyId:      null,
    currentCompany: null,
    role:           null,
    loading:        true,
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setValue({ companyId: null, currentCompany: null, role: null, loading: false });
        return;
      }

      const result = await fetchUserCompany(user.id);
      if (result) {
        setValue({
          companyId:      result.company.id,
          currentCompany: result.company,
          role:           result.role,
          loading:        false,
        });
      } else {
        setValue({ companyId: null, currentCompany: null, role: null, loading: false });
      }
    });
  }, []);

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCompany(): CompanyContextValue {
  return useContext(CompanyContext);
}
