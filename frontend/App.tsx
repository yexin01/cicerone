/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TripInput, Itinerary, Activity, WishlistItem } from '../shared/types';
import { generateItinerary, refineItinerary, recalculateDaySchedule } from './services/geminiService';
import { getSupabase, saveItineraryToCloud, fetchItinerariesFromCloud, signOut } from './services/supabaseClient';
import TravelForm from './components/TravelForm';
import ItineraryView from './components/ItineraryView';
import AIChat from './components/AIChat';
import ThemeToggle from './components/ThemeToggle';
import LandingPage from './pages/LandingPage';
import CloudSetup from './components/CloudSetup';
import { Compass, Sparkles, RefreshCw, Plane, Cloud, User } from 'lucide-react';

const App: React.FC = () => {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [view, setView] = useState<'home' | 'planner'>('home');
  const [savedPlans, setSavedPlans] = useState<Itinerary[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Auth & Cloud State
  const [isCloudSetupOpen, setIsCloudSetupOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Initial load & Auth Listener
  useEffect(() => {
    const checkUser = async () => {
        const supabase = getSupabase();
        
        // 1. Check local storage fallback first
        const saved = localStorage.getItem('cicerone_saved_plans');
        if (saved) {
            try {
                setSavedPlans(JSON.parse(saved));
            } catch (e) {}
        }

        // 2. Setup Supabase Auth Listener if configured
        if (supabase) {
            // Get initial session
            const { data } = await supabase.auth.getSession();
            if (data.session?.user) {
                setUser(data.session.user);
                loadCloudPlans();
            }

            // Listen for auth changes (specifically redirects from Google)
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                if (session?.user) {
                    setUser(session.user);
                    loadCloudPlans();
                    // Close the modal if it's open (e.g. after a redirect)
                    setIsCloudSetupOpen(false);
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setSavedPlans([]);
                }
            });

            return () => subscription.unsubscribe();
        }
    };
    checkUser();
  }, []);

  const loadCloudPlans = async () => {
      try {
          const plans = await fetchItinerariesFromCloud();
          setSavedPlans(plans);
      } catch (e) {
          console.error("Failed to load cloud plans", e);
      }
  };

  const saveToHistory = async (plan: Itinerary) => {
      const updated = [plan, ...savedPlans.filter(p => p.id !== plan.id)];
      setSavedPlans(updated);
      
      if (user) {
          try {
             await saveItineraryToCloud(plan, user.id);
          } catch(e) {
             console.error("Cloud save failed", e);
             // Silent fail for auto-save, alerts handled by manual save
          }
      } else {
          localStorage.setItem('cicerone_saved_plans', JSON.stringify(updated));
      }
  };

  const handleManualSave = async () => {
        if (!itinerary) return;
        if (!user) {
            setIsCloudSetupOpen(true);
            return;
        }
        
        // Explicit save logic
        await saveItineraryToCloud(itinerary, user.id);
        
        // Update local list just in case
        const updated = [itinerary, ...savedPlans.filter(p => p.id !== itinerary.id)];
        setSavedPlans(updated);
        
        // User feedback is handled by button state in ItineraryView or we can alert here
        alert("Trip saved successfully to Cicerone Cloud!");
  };

  const handleCreateItinerary = async (input: TripInput) => {
    setIsLoading(true);
    try {
      const result = await generateItinerary(input);
      // Generate ID
      result.id = Date.now().toString();
      setItinerary(result);
      setView('planner');
      saveToHistory(result);
    } catch (error) {
      console.error("Generation failed:", error);
      alert("Failed to generate itinerary. Please try again. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateItinerary = (updates: Partial<Itinerary>) => {
    if (!itinerary) return;
    const newItinerary = { ...itinerary, ...updates };
    setItinerary(newItinerary);
    saveToHistory(newItinerary);
  };

  const handleUpdateActivity = async (dayIndex: number, activityId: string, updates: Partial<Activity>) => {
    if (!itinerary) return;
    
    // 1. Optimistic Immutable Update
    const updatedDays = itinerary.days.map((day, idx) => {
      if (idx !== dayIndex) return day;
      return {
        ...day,
        activities: day.activities.map(act => {
          if (act.id !== activityId) return act;
          return { ...act, ...updates };
        })
      };
    });

    const newItinerary = {
      ...itinerary,
      days: updatedDays
    };
    
    setItinerary(newItinerary);
    saveToHistory(newItinerary);

    // 2. Trigger Recalculation if specific fields changed (like Transport)
    if (updates.selectedTransport) {
         setIsRefining(true);
         try {
             const dayActivities = newItinerary.days[dayIndex].activities;
             const prevLocation = itinerary.logistics.accommodation.address || itinerary.destination;
             
             const recalculatedActivities = await recalculateDaySchedule(dayActivities, prevLocation);
             
             const refinedItinerary = {
                 ...newItinerary,
                 days: newItinerary.days.map((day, idx) => 
                    idx === dayIndex ? { ...day, activities: recalculatedActivities } : day
                 )
             };
             setItinerary(refinedItinerary);
             saveToHistory(refinedItinerary);
         } catch (e) {
             console.error("Failed to recalculate schedule after update", e);
         } finally {
             setIsRefining(false);
         }
    }
  };

  const handleReorderActivities = async (dayIndex: number, newActivities: Activity[]) => {
      if(!itinerary) return;
      
      // 1. Immediate UI Update (Optimistic)
      const optimisticItinerary = {
        ...itinerary,
        days: itinerary.days.map((day, idx) => 
          idx === dayIndex ? { ...day, activities: newActivities } : day
        )
      };
      setItinerary(optimisticItinerary);
      
      // 2. Trigger Intelligent Recalculation
      setIsRefining(true);
      try {
         const prevLocation = itinerary.logistics.accommodation.address || itinerary.destination;
         const updatedActivities = await recalculateDaySchedule(newActivities, prevLocation);
         
         const finalItinerary = {
            ...optimisticItinerary,
            days: optimisticItinerary.days.map((day, idx) => 
               idx === dayIndex ? { ...day, activities: updatedActivities } : day
            )
         };
         
         setItinerary(finalItinerary);
         saveToHistory(finalItinerary);
      } catch (e) {
         console.error("Failed to recalculate", e);
      } finally {
         setIsRefining(false);
      }
  };

  const handleAddWishlistItem = (item: WishlistItem) => {
      if(!itinerary) return;
      const newItinerary = { ...itinerary, wishlist: [...(itinerary.wishlist || []), item] };
      setItinerary(newItinerary);
      saveToHistory(newItinerary);
  };

  const handleRefine = async () => {
    if (!itinerary || !refinePrompt.trim()) return;
    setIsRefining(true);
    try {
      const updated = await refineItinerary(itinerary, refinePrompt);
      updated.id = itinerary.id; // Keep same ID
      setItinerary(updated);
      setRefinePrompt('');
      setShowRefineInput(false);
      saveToHistory(updated);
    } catch (error) {
      alert("Refinement failed.");
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 transition-colors duration-300 font-sans">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-black shadow-lg shadow-zinc-500/10">
              <Compass className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
                <span className="font-heading font-bold text-lg leading-none">Cicerone</span>
                <span className="text-[10px] text-zinc-500 font-medium">Your AI travel buddy</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {view === 'planner' && itinerary && (
               <button 
                 onClick={() => setShowRefineInput(!showRefineInput)}
                 className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-100 dark:bg-zinc-900 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
               >
                 <Sparkles className="w-4 h-4 text-primary" /> 
                 Refine Plan
               </button>
             )}
             
             <div className="flex items-center gap-2 md:gap-3">
                {view === 'home' && (
                    <button 
                        onClick={() => { setItinerary(null); setView('planner'); }}
                        className="hidden md:flex bg-zinc-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex-row items-center gap-2"
                    >
                        <Plane className="w-3 h-3"/> Plan Trip
                    </button>
                )}
                
                {/* Cloud Button */}
                <button 
                    onClick={() => setIsCloudSetupOpen(true)}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${user ? 'bg-primary/10 text-primary' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}
                    title={user ? `Logged in as ${user.email}` : "Setup Cloud Sync"}
                >
                    {user ? <User className="w-4 h-4"/> : <Cloud className="w-4 h-4"/>}
                    {user && <span className="text-xs font-bold hidden md:inline">Synced</span>}
                </button>

                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1 hidden md:block"></div>
                <ThemeToggle />
             </div>
          </div>
        </div>
        
        {/* Quick Refine Bar */}
        <AnimatePresence>
          {showRefineInput && itinerary && view === 'planner' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-hidden"
            >
              <div className="max-w-3xl mx-auto py-4 px-6 flex gap-3">
                 <input 
                   type="text" 
                   value={refinePrompt}
                   onChange={(e) => setRefinePrompt(e.target.value)}
                   placeholder="e.g. 'I'm busy on Tuesday afternoon', 'Find cheaper dinner options'..."
                   className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
                   onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                 />
                 <button 
                   onClick={handleRefine}
                   disabled={isRefining || !refinePrompt.trim()}
                   className="px-6 py-2 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-600 disabled:opacity-50"
                 >
                   {isRefining ? <RefreshCw className="animate-spin w-4 h-4" /> : 'Update'}
                 </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main>
        <AnimatePresence mode="wait">
          {view === 'home' ? (
             <motion.div
               key="landing"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
             >
                <LandingPage 
                    savedPlans={savedPlans}
                    onStartPlanning={() => { setItinerary(null); setView('planner'); }}
                    onOpenChat={() => setIsChatOpen(true)}
                    onSelectPlan={(plan) => { setItinerary(plan); setView('planner'); }}
                />
             </motion.div>
          ) : !itinerary ? (
            <motion.div 
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[80vh] px-4"
            >
               <div className="text-center mb-12 max-w-2xl px-4">
                 <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4 tracking-tight">
                   Where are we going?
                 </h1>
                 <p className="text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed">
                   Tell Cicerone about your dream trip, and watch the magic happen.
                 </p>
               </div>
               <TravelForm onSubmit={handleCreateItinerary} isLoading={isLoading} />
            </motion.div>
          ) : (
            <motion.div
              key="itinerary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full p-4 md:p-8"
            >
               <ItineraryView 
                 itinerary={itinerary} 
                 onUpdateActivity={handleUpdateActivity}
                 onUpdateItinerary={handleUpdateItinerary}
                 onRefineRequest={(prompt) => {
                   setRefinePrompt(prompt);
                   handleRefine();
                 }}
                 onReorderActivities={handleReorderActivities}
                 onAddWishlistItem={handleAddWishlistItem}
                 onSave={handleManualSave}
                 isRefining={isRefining}
               />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AIChat 
        isOpen={isChatOpen} 
        onToggle={() => setIsChatOpen(!isChatOpen)}
        onClose={() => setIsChatOpen(false)}
      />

      <CloudSetup 
          isOpen={isCloudSetupOpen}
          onClose={() => setIsCloudSetupOpen(false)}
          onLoginSuccess={(u) => { setUser(u); loadCloudPlans(); }}
          onLogout={() => { 
              setUser(null); 
              setSavedPlans([]); 
              // Note: signOut is called inside CloudSetup, App just updates local state
          }}
          currentUser={user}
      />
    </div>
  );
};

export default App;