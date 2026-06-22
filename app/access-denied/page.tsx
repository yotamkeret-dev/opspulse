'use client';
import { createClient } from '@/lib/supabase/client';

export default function AccessDeniedPage() {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.logo}>OpsPulse</div>
        <div style={styles.subtitle}>Orca Operations Platform</div>

        <div style={styles.card}>
          <div style={styles.icon}>🔒</div>
          <div style={styles.title}>Access Denied</div>
          <div style={styles.message}>
            Your email address is not on the approved Operations team member list.
            <br /><br />
            If you believe this is an error, please contact your Operations team lead to request access.
          </div>
          <button onClick={signOut} style={styles.button}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#07111f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  },
  container: {
    maxWidth: 400,
    padding: '0 24px',
    textAlign: 'center',
  },
  logo: {
    fontSize: 28,
    fontWeight: 800,
    color: '#e8eef7',
    letterSpacing: '-.04em',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#8fa3bb',
    marginBottom: 40,
  },
  card: {
    background: 'rgba(239,68,68,.06)',
    border: '1px solid rgba(239,68,68,.25)',
    borderRadius: 20,
    padding: '32px 28px',
  },
  icon: {
    fontSize: 36,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#e8eef7',
    marginBottom: 10,
  },
  message: {
    fontSize: 13,
    color: '#8fa3bb',
    lineHeight: 1.6,
    marginBottom: 24,
  },
  button: {
    background: 'rgba(255,255,255,.08)',
    border: '1px solid rgba(255,255,255,.14)',
    color: '#e8eef7',
    borderRadius: 10,
    padding: '10px 24px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'inherit',
  },
};
