'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const INPUT: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.09)', borderRadius: 10,
  padding: '11px 14px', color: '#e8eef7', fontSize: 14,
  fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
};

// Users arrive here after clicking a password-reset link in their email.
// Supabase has already exchanged the code for a session via /auth/callback.
export default function ResetPasswordPage() {
  const [password, setPassword]   = useState('');
  const [confirm,  setConfirm]    = useState('');
  const [error,    setError]      = useState('');
  const [done,     setDone]       = useState(false);
  const [loading,  setLoading]    = useState(false);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      setDone(true);
      setTimeout(() => { window.location.href = '/'; }, 2500);
    }
    setLoading(false);
  }

  const wrap: React.CSSProperties = {
    minHeight: '100vh', background: '#07111f',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  };

  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#e8eef7', letterSpacing: '-.04em' }}>OpsPulse</div>
          <div style={{ fontSize: 13, color: '#8fa3bb', marginTop: 6 }}>Orca Operations Platform</div>
        </div>

        <div style={{ background: 'rgba(13,25,43,.76)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 20, padding: '32px 28px' }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eef7', marginBottom: 8 }}>Password updated</div>
              <div style={{ fontSize: 13, color: '#8fa3bb' }}>Redirecting you to the dashboard…</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#e8eef7', marginBottom: 6 }}>Set new password</div>
              <div style={{ fontSize: 13, color: '#8fa3bb', marginBottom: 24 }}>Choose a strong password for your account.</div>
              <form onSubmit={updatePassword}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8fa3bb', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                    New Password
                  </label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters" required autoFocus style={INPUT} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8fa3bb', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                    Confirm Password
                  </label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your new password" required style={INPUT} />
                </div>
                {error && (
                  <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 14, padding: '8px 12px', background: 'rgba(239,68,68,.08)', borderRadius: 8 }}>
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading} style={{ width: '100%', background: '#5b8dee', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1, fontFamily: 'inherit' }}>
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
