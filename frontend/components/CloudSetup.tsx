/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, Lock, X, Check, Loader2, Database, LogIn, LogOut } from 'lucide-react';
import { initSupabase, getSupabase, fetchItinerariesFromCloud, signInWithGoogle } from '../services/supabaseClient';

interface CloudSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
  onLogout: () => void;
  currentUser: any;
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const CloudSetup: React.FC<CloudSetupProps> = ({ isOpen, onClose, onLoginSuccess, onLogout, currentUser }) => {
  const [config, setConfig] = useState({ url: '', key: '' });
  const [isConnected, setIsConnected] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authCreds, setAuthCreds] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Check if already initialized (via Env vars or previous session)
    if (getSupabase()) {
        setIsConnected(true);
    } else {
        const saved = localStorage.getItem('cicerone_supabase_config');
        if (saved) {
            setConfig(JSON.parse(saved));
            if (initSupabase(JSON.parse(saved).url, JSON.parse(saved).key)) {
                 setIsConnected(true);
            }
        }
    }
  }, [isOpen]);

  const handleConnect = () => {
      const client = initSupabase(config.url, config.key);
      if (client) {
          setIsConnected(true);
          // Persist manually entered config
          localStorage.setItem('cicerone_supabase_config', JSON.stringify(config));
          setSuccessMsg("Connected to Supabase!");
      } else {
          setError("Invalid Configuration");
      }
  };

  const handleDisconnect = () => {
      localStorage.removeItem('cicerone_supabase_config');
      setConfig({ url: '', key: '' });
      setIsConnected(false);
      onLogout();
      // Force reload to clear singleton if needed, or just allow re-entry
      window.location.reload();
  };

  const handleGoogleLogin = async () => {
      setError('');
      setIsLoading(true);
      try {
          await signInWithGoogle();
      } catch (err: any) {
          setError(err.message);
          setIsLoading(false);
      }
  };

  const handleAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError('');
      const supabase = getSupabase();
      
      if (!supabase) return;

      try {
          let result;
          if (authMode === 'signup') {
              result = await supabase.auth.signUp(authCreds);
          } else {
              result = await supabase.auth.signInWithPassword(authCreds);
          }

          if (result.error) throw result.error;

          if (result.data.user) {
              onLoginSuccess(result.data.user);
              if (authMode === 'signup') {
                  setSuccessMsg("Account created! You can now save trips.");
              } else {
                  onClose();
              }
          }
      } catch (err: any) {
          setError(err.message);
      } finally {
          setIsLoading(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
      >
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
           <h2 className="font-bold flex items-center gap-2">
               <Cloud className="w-5 h-5 text-primary"/> Cloud Sync
           </h2>
           <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
               <X className="w-5 h-5"/>
           </button>
        </div>

        <div className="p-6">
           {error && (
               <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                   <X className="w-4 h-4"/> {error}
               </div>
           )}
           {successMsg && (
               <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg flex items-center gap-2">
                   <Check className="w-4 h-4"/> {successMsg}
               </div>
           )}

           {!isConnected ? (
               <div className="space-y-4">
                   <p className="text-sm text-zinc-500">
                       Enter your Supabase credentials to enable cloud save. These are stored locally in your browser.
                   </p>
                   <div>
                       <label className="text-xs font-bold uppercase text-zinc-400">Project URL</label>
                       <input 
                          className="w-full mt-1 p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                          value={config.url}
                          onChange={e => setConfig({...config, url: e.target.value})}
                          placeholder="https://xyz.supabase.co"
                       />
                   </div>
                   <div>
                       <label className="text-xs font-bold uppercase text-zinc-400">Anon Public Key</label>
                       <input 
                          type="password"
                          className="w-full mt-1 p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                          value={config.key}
                          onChange={e => setConfig({...config, key: e.target.value})}
                          placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
                       />
                   </div>
                   <button 
                      onClick={handleConnect}
                      className="w-full py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg font-bold text-sm"
                   >
                       Connect
                   </button>
               </div>
           ) : (
               <div className="space-y-6">
                   <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-900/30">
                       <span className="text-sm text-green-700 dark:text-green-400 font-medium flex items-center gap-2">
                           <Database className="w-4 h-4"/> Connected to Supabase
                       </span>
                       {/* Only show disconnect if it was manually set (in localStorage) */}
                       {localStorage.getItem('cicerone_supabase_config') && (
                           <button onClick={handleDisconnect} className="text-xs text-red-500 hover:underline">
                               Disconnect
                           </button>
                       )}
                   </div>

                   {currentUser ? (
                       <div className="text-center py-4">
                           <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 overflow-hidden">
                               {currentUser.user_metadata?.avatar_url ? (
                                   <img src={currentUser.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover"/>
                               ) : (
                                   <span className="text-xl font-bold text-primary">{currentUser.email?.[0]?.toUpperCase() || 'U'}</span>
                               )}
                           </div>
                           <p className="font-bold">{currentUser.email}</p>
                           <p className="text-xs text-zinc-500 mb-4">Logged In</p>
                           <button 
                               onClick={onLogout}
                               className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 mx-auto"
                           >
                               <LogOut className="w-4 h-4"/> Sign Out
                           </button>
                       </div>
                   ) : (
                       <div className="space-y-4">
                           <form onSubmit={handleAuth} className="space-y-4">
                               <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                                   <button 
                                      type="button"
                                      onClick={() => setAuthMode('login')}
                                      className={`flex-1 pb-2 text-sm font-bold ${authMode === 'login' ? 'text-primary border-b-2 border-primary -mb-[17px]' : 'text-zinc-400'}`}
                                   >
                                       Login
                                   </button>
                                   <button 
                                      type="button"
                                      onClick={() => setAuthMode('signup')}
                                      className={`flex-1 pb-2 text-sm font-bold ${authMode === 'signup' ? 'text-primary border-b-2 border-primary -mb-[17px]' : 'text-zinc-400'}`}
                                   >
                                       Sign Up
                                   </button>
                               </div>
                               
                               <input 
                                  type="email"
                                  required
                                  placeholder="Email"
                                  className="w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                                  value={authCreds.email}
                                  onChange={e => setAuthCreds({...authCreds, email: e.target.value})}
                               />
                               <input 
                                  type="password"
                                  required
                                  placeholder="Password"
                                  className="w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                                  value={authCreds.password}
                                  onChange={e => setAuthCreds({...authCreds, password: e.target.value})}
                               />
                               
                               <button 
                                  type="submit"
                                  disabled={isLoading}
                                  className="w-full py-2 bg-primary text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                               >
                                   {isLoading ? <Loader2 className="animate-spin w-4 h-4"/> : <LogIn className="w-4 h-4"/>}
                                   {authMode === 'login' ? 'Sign In' : 'Create Account'}
                               </button>
                           </form>

                           {/* Google Auth Section */}
                           <div className="relative my-4">
                               <div className="absolute inset-0 flex items-center">
                                   <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
                               </div>
                               <div className="relative flex justify-center text-xs uppercase">
                                   <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-500">Or continue with</span>
                               </div>
                           </div>

                           <button 
                              type="button"
                              onClick={handleGoogleLogin}
                              className="w-full py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                           >
                               <GoogleIcon />
                               Google
                           </button>
                       </div>
                   )}
               </div>
           )}
        </div>
      </motion.div>
    </div>
  );
};

export default CloudSetup;