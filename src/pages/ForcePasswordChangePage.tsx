import React, { useState } from 'react';
import { ShieldCheck, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ForcePasswordChangePage: React.FC = () => {
  const { completePasswordChange } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 10) {
      setError('Le nouveau mot de passe doit contenir au moins 10 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    setIsLoading(true);
    try {
      await completePasswordChange(currentPassword, newPassword);
      navigate('/', { replace: true });
    } catch {
      setError('Impossible de modifier le mot de passe. Verifiez vos informations.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#020617] px-6">
      <main className="w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-8 rounded-2xl shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-amber-500/20 flex items-center justify-center rounded-xl border border-amber-500/30 mb-4">
              <ShieldCheck className="text-amber-400 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Mise a jour obligatoire</h1>
            <p className="text-slate-400 text-sm mt-1 text-center">
              Pour votre securite, vous devez changer votre mot de passe avant d'acceder a l'application.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'Mot de passe temporaire', value: currentPassword, set: setCurrentPassword },
              { label: 'Nouveau mot de passe', value: newPassword, set: setNewPassword },
              { label: 'Confirmer le nouveau mot de passe', value: confirmPassword, set: setConfirmPassword },
            ].map((field, idx) => (
              <div className="space-y-2" key={field.label}>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-widest ml-1">{field.label}</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    autoFocus={idx === 0}
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                  />
                </div>
              </div>
            ))}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#422006] font-bold py-3.5 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Valider et Continuer'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ForcePasswordChangePage;
