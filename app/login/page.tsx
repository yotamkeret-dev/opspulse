'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isApproved } from '@/lib/approved-members';

type Mode = 'password' | 'magic-link' | 'forgot-password';

const INPUT: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.09)', borderRadius: 10,
  padding: '11px 14px', color: '#e8eef7', fontSize: 14,
  fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
};

const BTN_PRIMARY: React.CSSProperties = {
  width: '100%', background: '#5b8dee', color: '#fff', border: 'none',
  borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
};

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#8fa3bb',
  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6,
};

function authErrorMessage(raw: string): string {
  if (raw.includes('Invalid login credentials')) return 'Incorrect email or password. Please try again.';
  if (raw.includes('Email not confirmed'))       return 'Your account is not yet activated. Contact your administrator.';
  if (raw.includes('User not found'))            return 'No account found for this email address.';
  if (raw.includes('Too many requests'))         return 'Too many attempts. Please wait a few minutes before trying again.';
  return raw;
}

export default function LoginPage() {
  const [mode,     setMode]     = useState<Mode>('password');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('error') === 'auth_failed') setError('The sign-in link was invalid or has expired. Please try again.');
  }, []);

  function switchMode(m: Mode) { setMode(m); setError(''); setSent(false); }

  // ── Email + Password ───────────────────────────────────────────────────
  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (err) { setError(authErrorMessage(err.message)); setLoading(false); return; }
    // Double-check approved list even after successful Supabase auth
    if (!isApproved(data.user?.email)) {
      await supabase.auth.signOut();
      window.location.href = '/access-denied';
      return;
    }
    window.location.href = '/';
  }

  // ── Google OAuth ───────────────────────────────────────────────────────
  async function signInWithGoogle() {
    setLoading(true); setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) { setError(err.message); setLoading(false); }
  }

  // ── Magic link (backup) ────────────────────────────────────────────────
  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) setError(err.message); else setSent(true);
    setLoading(false);
  }

  // ── Password reset ─────────────────────────────────────────────────────
  async function sendPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/callback?type=recovery` }
    );
    if (err) setError(err.message); else setSent(true);
    setLoading(false);
  }

  // ─────────────────────────────────────────────────────────────────────
  const wrap: React.CSSProperties = {
    minHeight: '100vh', background: '#07111f',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  };
  const card: React.CSSProperties = {
    background: 'rgba(13,25,43,.76)', border: '1px solid rgba(255,255,255,.09)',
    borderRadius: 20, padding: '32px 28px',
  };
  const linkBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: '#5b8dee',
    fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
  };
  const errorBox: React.CSSProperties = {
    fontSize: 13, color: '#ef4444', marginBottom: 14,
    padding: '8px 12px', background: 'rgba(239,68,68,.08)', borderRadius: 8,
  };

  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#e8eef7', letterSpacing: '-.04em' }}>OpsPulse</div>
          <div style={{ fontSize: 13, color: '#8fa3bb', marginTop: 6 }}>Orca Operations Platform</div>
        </div>

        <div style={card}>

          {/* ── Sent confirmation ─────────────────────────────────── */}
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>
                {mode === 'forgot-password' ? '📩' : '📬'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eef7', marginBottom: 8 }}>
                {mode === 'forgot-password' ? 'Reset link sent' : 'Check your inbox'}
              </div>
              <div style={{ fontSize: 13, color: '#8fa3bb', lineHeight: 1.6 }}>
                {mode === 'forgot-password' ? (
                  <>A password reset link was sent to <strong style={{ color: '#e8eef7' }}>{email}</strong>.<br />Click it to set a new password.</>
                ) : (
                  <>A sign-in link was sent to <strong style={{ color: '#e8eef7' }}>{email}</strong>.<br />Click it to access OpsPulse.</>
                )}
              </div>
              <button style={{ ...linkBtn, marginTop: 24, border: '1px solid rgba(255,255,255,.15)', color: '#8fa3bb', borderRadius: 10, padding: '8px 20px' }}
                onClick={() => switchMode('password')}>
                Back to sign in
              </button>
            </div>

          ) : mode === 'password' ? (
            /* ── Email + Password (primary) ───────────────────────── */
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#e8eef7', marginBottom: 6 }}>Sign in</div>
              <div style={{ fontSize: 13, color: '#8fa3bb', marginBottom: 24 }}>
                Enter your <strong style={{ color: '#c9d7e8' }}>@orca-ai.io</strong> email and password.
              </div>
              <form onSubmit={signInWithPassword}>
                <div style={{ marginBottom: 14 }}>
                  <label style={LABEL}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@orca-ai.io" required autoFocus style={INPUT} />
                </div>
                <div style={{ marginBottom: 6 }}>
                  <label style={LABEL}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required style={INPUT} />
                </div>
                <div style={{ textAlign: 'right', marginBottom: 18 }}>
                  <button type="button" style={linkBtn} onClick={() => switchMode('forgot-password')}>
                    Forgot password?
                  </button>
                </div>
                {error && <div style={errorBox}>{error}</div>}
                <button type="submit" disabled={loading} style={{ ...BTN_PRIMARY, opacity: loading ? .7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              {/* ── OR divider ── */}
              <div style={{ display:'flex', alignItems:'center', gap:10, margin:'18px 0 14px' }}>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,.08)' }}/>
                <span style={{ fontSize:11, color:'#6b7e94', textTransform:'uppercase', letterSpacing:'.06em' }}>or</span>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,.08)' }}/>
              </div>

              {/* ── Google sign-in button ── */}
              <button
                type="button"
                disabled={loading}
                onClick={signInWithGoogle}
                style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                  padding:'11px 0', borderRadius:12, border:'1px solid rgba(255,255,255,.12)',
                  background:'rgba(255,255,255,.06)', color:'#e8eef7', fontSize:14, fontWeight:600,
                  cursor: loading ? 'not-allowed' : 'pointer', fontFamily:'inherit',
                  opacity: loading ? .7 : 1, transition:'background .15s',
                }}
                onMouseOver={e => (e.currentTarget.style.background='rgba(255,255,255,.11)')}
                onMouseOut={e => (e.currentTarget.style.background='rgba(255,255,255,.06)')}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width:18, height:18 }}/>
                Sign in with Google
              </button>

              <div style={{ marginTop: 18, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 16 }}>
                <button type="button" style={{ ...linkBtn, opacity: .75 }} onClick={() => switchMode('magic-link')}>
                  Use email magic link instead
                </button>
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: '#6b7e94', textAlign: 'center' }}>
                Access restricted to approved Operations team members.
              </div>
            </>

          ) : mode === 'magic-link' ? (
            /* ── Magic link (backup) ──────────────────────────────── */
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#e8eef7', marginBottom: 6 }}>Magic link sign in</div>
              <div style={{ fontSize: 13, color: '#8fa3bb', marginBottom: 24 }}>
                We'll send a one-click sign-in link to your email.
              </div>
              <form onSubmit={sendMagicLink}>
                <div style={{ marginBottom: 16 }}>
                  <label style={LABEL}>Work Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@orca-ai.io" required autoFocus style={INPUT} />
                </div>
                {error && <div style={errorBox}>{error}</div>}
                <button type="submit" disabled={loading} style={{ ...BTN_PRIMARY, opacity: loading ? .7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Sending…' : 'Send sign-in link'}
                </button>
              </form>
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button type="button" style={{ ...linkBtn, opacity: .8 }} onClick={() => switchMode('password')}>
                  ← Back to password sign in
                </button>
              </div>
            </>

          ) : (
            /* ── Forgot password ──────────────────────────────────── */
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#e8eef7', marginBottom: 6 }}>Reset password</div>
              <div style={{ fontSize: 13, color: '#8fa3bb', marginBottom: 24 }}>
                Enter your email and we'll send a password reset link.
              </div>
              <form onSubmit={sendPasswordReset}>
                <div style={{ marginBottom: 16 }}>
                  <label style={LABEL}>Work Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@orca-ai.io" required autoFocus style={INPUT} />
                </div>
                {error && <div style={errorBox}>{error}</div>}
                <button type="submit" disabled={loading} style={{ ...BTN_PRIMARY, opacity: loading ? .7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button type="button" style={{ ...linkBtn, opacity: .8 }} onClick={() => switchMode('password')}>
                  ← Back to sign in
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
