import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/apiClient';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Loader2,
  AlertCircle
} from 'lucide-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const success = await login(email, password);
      if (!success) {
        setError('Identifiants invalides. Veuillez reessayer.');
        return;
      }
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Identifiants invalides. Verifiez email/mot de passe.');
        } else if (err.status === 404) {
          setError('API d authentification introuvable. Demarrez le serveur auth.');
        } else {
          setError(`Erreur API (${err.status}).`);
        }
      } else {
        setError('Connexion impossible. Verifiez que l API auth est demarree.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#020617]">
      <div
        className="absolute inset-0 opacity-40 scale-105"
        style={{
          backgroundImage: `url('/C:/Users/Diva KALALA/.gemini/antigravity/brain/c27b2775-a653-454d-a5d9-b36b9a29fdca/neox_login_backdrop_1774079560113.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(3px)'
        }}
      />

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neox-emerald/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />

      <main className="relative z-10 w-full max-w-md px-6 animate-in fade-in zoom-in duration-700">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-8 rounded-2xl shadow-2xl overflow-hidden group">
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />

          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-neox-emerald/20 flex items-center justify-center rounded-xl border border-neox-emerald/30 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <ShieldCheck className="text-neox-emerald w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">NEOX CORE</h1>
            <p className="text-slate-400 text-sm mt-1">Plateforme ERP d'Entreprise</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-widest ml-1">Email Professionnel</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-neox-emerald transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-neox-emerald/50 focus:ring-1 focus:ring-neox-emerald/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-widest ml-1">Mot de Passe</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-neox-emerald transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-neox-emerald/50 focus:ring-1 focus:ring-neox-emerald/20 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-center gap-2 text-red-500 text-sm animate-in slide-in-from-top-2">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-neox-emerald hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#064e3b] font-bold py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 group/btn shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Se Connecter
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">
              Securise par NEOX SHIELD © 2026
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
