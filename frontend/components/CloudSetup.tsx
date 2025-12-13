/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, X, Check, Loader2, LogIn, LogOut, Settings, Mail, Lock, UserPlus, AlertCircle } from 'lucide-react';
import { getSupabase, signOut } from '../services/supabaseClient';

interface CloudSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
  onLogout: () => void;
  currentUser: any;
}

const CloudSetup: React.FC<CloudSetupProps> = ({ isOpen, onClose, onLoginSuccess, onLogout, currentUser }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authCreds, setAuthCreds] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // Check connection on mount
  useEffect(() => {
    const client = getSupabase();
    if (client) setIsConnected(true);
  }, [isOpen]);

  const handleSignOut = async () => {
      setIsLoading(true);
      await signOut(); 
      onLogout();
      setIsLoading(false);
      onClose();
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError('');
      setSuccessMsg('');
      
      const supabase = getSupabase();
      if (!supabase) {
          setError("Database connection error. Check your Vercel Environment Variables.");
          setIsLoading(false);
          return;
      }

      try {
          let result;
          if (authMode === 'signup') {
              result = await supabase.auth.signUp(authCreds);
          } else {
              result = await supabase.auth.signInWithPassword(authCreds);
          }

          if (result.error) throw result.error;

          if (result.data.user) {
              // Handle Email Confirmation case
              if (authMode === 'signup' && !result.data.session) {
                 setSuccessMsg("Account created! Please check your email to confirm your address.");
                 setAuthCreds({ ...authCreds, password: '' }); 
              } else {
                 setSuccessMsg("Success!");
                 setTimeout(() => {
                     onLoginSuccess(result.data.user);
                     onClose();
                 }, 500);
              }
          }
      } catch (err: any) {
          console.error(err);
          // Friendly error messages
          if (err.message.includes("Invalid login")) setError("Incorrect email or password.");
          else if (err.message.includes("already registered")) setError("This email is already registered.");
          else setError(err.message || "Authentication failed");
      } finally {
          setIsLoading(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/30">
           <h2 className="font-bold flex items-center gap-2.5 text-zinc-800 dark:text-zinc-100">
               <div className="p-2 bg-primary/10 rounded-xl">
                   <Cloud className="w-5 h-5 text-primary"/> 
               </div>
               {currentUser ? 'Your Profile' : (authMode === 'login' ? 'Welcome Back' : 'Join Cicerone')}
           </h2>
           <button 
             onClick={onClose} 
             className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
           >
               <X className="w-5 h-5"/>
           </button>
        </div>

        <div className="p-6">
           <AnimatePresence mode="wait">
               {error && (
                   <motion.div 
                     initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                     className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-start gap-3"
                   >
                       <AlertCircle className="w-5 h-5 shrink-0 mt-0.5"/> 
                       <span className="leading-snug font-medium">{error}</span>
                   </motion.div>
               )}
               {successMsg && (
                   <motion.div 
                     initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                     className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/50 text-green-600 dark:text-green-400 text-sm rounded-xl flex items-start gap-3"
                   >
                       <Check className="w-5 h-5 shrink-0 mt-0.5"/>
                       <span className="leading-snug font-medium">{successMsg}</span>
                   </motion.div>
               )}
           </AnimatePresence>

           {currentUser ? (
               /* VIEW 1: LOGGED IN PROFILE */
               <div className="text-center py-2">
                   <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white dark:border-zinc-800 shadow-xl">
                       <span className="text-3xl font-bold text-primary">{currentUser.email?.[0]?.toUpperCase() || 'U'}</span>
                   </div>
                   
                   <h3 className="font-bold text-xl mb-1">{currentUser.user_metadata?.full_name || 'Traveler'}</h3>
                   <p className="text-sm text-zinc-500 mb-8 font-medium bg-zinc-100 dark:bg-zinc-800 py-1 px-3 rounded-full inline-block">{currentUser.email}</p>
                   
                   <button 
                       onClick={handleSignOut}
                       disabled={isLoading}
                       className="w-full py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center gap-2 transition-all"
                   >
                       {isLoading ? <Loader2 className="animate-spin w-4 h-4"/> : <LogOut className="w-4 h-4"/>}
                       Sign Out
                   </button>
               </div>
           ) : (
               /* VIEW 2: LOGIN / SIGNUP FORM */
               <div className="space-y-6">
                   {/* Auth Mode Tabs */}
                   <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-2">
                       <button 
                          onClick={() => { setAuthMode('login'); setError(''); }}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                              authMode === 'login' 
                              ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' 
                              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                          }`}
                       >
                           Sign In
                       </button>
                       <button 
                          onClick={() => { setAuthMode('signup'); setError(''); }}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                              authMode === 'signup' 
                              ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' 
                              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                          }`}
                       >
                           Create Account
                       </button>
                   </div>

                   {!isConnected && (
                        <p className="text-xs text-center text-red-500 bg-red-50 p-2 rounded-lg">
                            Warning: Supabase keys not detected. Please check Vercel settings.
                        </p>
                   )}

                   <form onSubmit={handleEmailAuth} className="space-y-4">
                       <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-500 ml-1">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400 group-focus-within:text-primary transition-colors"/>
                                <input 
                                    type="email"
                                    required
                                    placeholder="name@example.com"
                                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                    value={authCreds.email}
                                    onChange={e => setAuthCreds({...authCreds, email: e.target.value})}
                                />
                            </div>
                       </div>
                       <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-500 ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400 group-focus-within:text-primary transition-colors"/>
                                <input 
                                    type="password"
                                    required
                                    minLength={6}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                    value={authCreds.password}
                                    onChange={e => setAuthCreds({...authCreds, password: e.target.value})}
                                />
                            </div>
                            {authMode === 'signup' && (
                                <p className="text-[10px] text-zinc-400 ml-1">Must be at least 6 characters</p>
                            )}
                       </div>
                       
                       <button 
                          type="submit"
                          disabled={isLoading}
                          className="w-full py-3 mt-2 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                       >
                           {isLoading ? <Loader2 className="animate-spin w-4 h-4"/> : (authMode === 'login' ? <LogIn className="w-4 h-4"/> : <UserPlus className="w-4 h-4"/>)}
                           {authMode === 'login' ? 'Sign In' : 'Create Account'}
                       </button>
                   </form>
               </div>
           )}
        </div>
      </motion.div>
    </div>
  );
};

export default CloudSetup;