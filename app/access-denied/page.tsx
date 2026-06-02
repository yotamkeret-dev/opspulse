'use client';
import { createClient } from '@/lib/supabase/client';

export default function AccessDeniedPage() {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#07111f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 400, padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#e8eef7', letterSpacing: '-.04em', marginBottom: 4 }}>OpsPulse</div>
        <div style={{ fontSize: 13, color: '#8fa3bb', marginBottom: 40 }}>Orca Operations Platform</div>

        <div style={{
          background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.25)',
          borderRadius: 20, padding: '32px 28px',
        }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e8eef7', marginBottom: 10 }}>Access Denied</div>
          <div style={{ fontSize: 13, color: '#8fa3bb', lineHeight: 1.6, marginBottom: 24 }}>
            Your email address is not on the approved Operations team member list.
            <br /><br />
            If you believe this is an error, please contact your Operations team lead to request access.
          </div>
          <button
            onClick={signOut}
            style={{
              background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)',
              color: '#e8eef7', borderRadius: 10, padding: '10px 24px',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
