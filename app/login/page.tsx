'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  // Show error when redirected back from /auth/callback with ?error=auth_failed
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'auth_failed') {
      setError('The sign-in link was invalid or expired. Please request a new one.');
    }
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#07111f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, padding: '0 24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#e8eef7', letterSpacing: '-.04em' }}>OpsPulse</div>
          <div style={{ fontSize: 13, color: '#8fa3bb', marginTop: 6 }}>Orca Operations Platform</div>
        </div>

        <div style={{
          background: 'rgba(13,25,43,.76)', border: '1px solid rgba(255,255,255,.09)',
          borderRadius: 20, padding: '32px 28px',
        }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>📬</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eef7', marginBottom: 8 }}>Check your inbox</div>
              <div style={{ fontSize: 13, color: '#8fa3bb', lineHeight: 1.6 }}>
                A sign-in link was sent to <strong style={{ color: '#e8eef7' }}>{email}</strong>.<br />
                Click it to access OpsPulse.
              </div>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                style={{ marginTop: 24, background: 'transparent', border: '1px solid rgba(255,255,255,.15)', color: '#8fa3bb', borderRadius: 10, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#e8eef7', marginBottom: 6 }}>Sign in</div>
              <div style={{ fontSize: 13, color: '#8fa3bb', marginBottom: 24 }}>
                Use your <strong style={{ color: '#c9d7e8' }}>@orca-ai.io</strong> email to access the Operations platform.
              </div>

              <form onSubmit={signIn}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8fa3bb', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                    Work Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@orca-ai.io"
                    required
                    style={{
                      width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)',
                      borderRadius: 10, padding: '11px 14px', color: '#e8eef7', fontSize: 14,
                      fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#5b8dee'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,.09)'; }}
                  />
                </div>

                {error && (
                  <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 14, padding: '8px 12px', background: 'rgba(239,68,68,.08)', borderRadius: 8 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', background: '#5b8dee', color: '#fff', border: 'none',
                    borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {loading ? 'Sending link…' : 'Send sign-in link'}
                </button>
              </form>

              <div style={{ marginTop: 20, fontSize: 12, color: '#6b7e94', textAlign: 'center', lineHeight: 1.5 }}>
                Access is restricted to approved Operations team members.<br />
                Contact your team lead if you need access.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
