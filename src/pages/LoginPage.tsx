import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Changed fallback from '/home' to '/' (or change to '/dashboard' if your root is elsewhere)
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await login(email, password);

      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.message || 'Login failed. Please check your credentials.');
        setPassword('');
      }
    } catch (err: any) {
      setError('Something went wrong. Please check your network connection and try again.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#11130f] px-4 py-10 font-sans text-[#f8f4e8]">
      {/* Background decorative glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#a52b24]/20 blur-[100px]" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-[#557449]/20 blur-[110px]" />
      </div>

      <section className="relative z-10 w-full max-w-md">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-[#c33a30]/50 bg-[#211b17]">
            <span className="text-5xl">🐓</span>
          </div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.4em] text-[#d4a56a]">
            Quality poultry • Backyard raised
          </p>
          <h1 className="text-4xl font-black uppercase leading-none tracking-tight sm:text-5xl">
            EGB <span className="text-[#cf4438]">Backyard</span>
          </h1>
        </header>

        <div className="rounded-2xl border border-white/10 bg-[#191b16]/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#cf4438]">
              Admin Access
            </p>
            <h2 className="mt-2 text-2xl font-bold">Farm access</h2>
            <p className="mt-2 text-sm text-[#a9aa9e]">
              Sign in to manage your EGB Backyard account.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-400/30 bg-red-950/40 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#d7d7ca]">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                required
                disabled={loading}
                placeholder="maribao848@gmail.com"
                className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3.5 text-sm text-white outline-none focus:border-[#c33a30]"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#d7d7ca]">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  required
                  disabled={loading}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3.5 pr-16 text-sm text-white outline-none focus:border-[#c33a30]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 text-xs font-semibold text-[#d4a56a]"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#b83229] px-5 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-[#cf4438] disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Enter the backyard →'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
