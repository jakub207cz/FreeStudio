'use strict';
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Lock, Mail, AlertCircle, Scissors, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Pokud je již uživatel přihlášen, přesměrovat na dashboard
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/admin');
      }
    };
    checkUser();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      if (data.session) {
        router.push('/admin');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Nesprávný e-mail nebo heslo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-neutral-950 to-neutral-950 -z-10" />

      <div className="w-full max-w-md space-y-8 bg-neutral-900/60 backdrop-blur-md p-8 rounded-2xl border border-neutral-800 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30 text-amber-400 mb-4">
            <Scissors className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            Free Studio Admin
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            Přihlášení pro administraci rezervací
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg flex items-center space-x-2 text-sm animate-shake">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-neutral-950/80 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-sm"
                  placeholder="barbara@freestudio.cz"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Heslo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 bg-neutral-950/80 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-neutral-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-950 focus:ring-amber-500 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                'Přihlásit se'
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-2">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs text-neutral-400 hover:text-amber-400 transition-all font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Zpět na rezervační formulář</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
