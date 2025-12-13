/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TripInput, Itinerary, Activity, WishlistItem } from './types';
import { generateItinerary, refineItinerary } from './services/geminiService';
import TravelForm from './components/TravelForm';
import ItineraryView from './components/ItineraryView';
import AIChat from './components/AIChat';
import ThemeToggle from './components/ThemeToggle';
import { Compass, Sparkles, RefreshCw, LayoutDashboard, ArrowRight } from 'lucide-react';

const App: React.FC = () => {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [view, setView] = useState<'home' | 'planner'>('home');
  const [savedPlans, setSavedPlans] = useState<Itinerary[]>([]);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cicerone_saved_plans');
    if (saved) {
      try {
        setSavedPlans(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved plans");
      }
    }
  }, []);

  const saveToHistory = (plan: Itinerary) => {
      const updated = [plan, ...savedPlans.filter(p => p.id !== plan.id)];
      setSavedPlans(updated);
      localStorage.setItem('cicerone_saved_plans', JSON.stringify(updated));
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
      alert("Failed to generate itinerary. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateActivity = (dayIndex: number, activityId: string, updates: Partial<Activity>) => {
    if (!itinerary) return;
    
    // Immutable update to ensure React re-renders correctly
    const newItinerary = {
      ...itinerary,
      days: itinerary.days.map((day, idx) => {
        if (idx !== dayIndex) return day;
        return {
          ...day,
          activities: day.activities.map(act => {
            if (act.id !== activityId) return act;
            return { ...act, ...updates };
          })
        };
      })
    };
    
    setItinerary(newItinerary);
    saveToHistory(newItinerary);
  };

  const handleReorderActivities = (dayIndex: number, newActivities: Activity[]) => {
      if(!itinerary) return;
      
      const newItinerary = {
        ...itinerary,
        days: itinerary.days.map((day, idx) => 
          idx === dayIndex ? { ...day, activities: newActivities } : day
        )
      };
      
      setItinerary(newItinerary);
      // Note: We don't auto-save reorder immediately to avoid spamming LS, or we could.
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

  const Dashboard = () => (
      <div className="max-w-6xl mx-auto p-6">
          <h1 className="text-4xl font-heading font-bold mb-8">My Journeys</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <button 
                onClick={() => {
                  setItinerary(null);
                  setView('planner');
                }}
                className="h-64 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center text-zinc-400 hover:border-primary hover:text-primary transition-all group"
              >
                  <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-800 group-hover:bg-primary/10 mb-4 transition-colors">
                    <Compass className="w-8 h-8" />
                  </div>
                  <span className="font-bold">Plan New Trip</span>
              </button>
              
              {savedPlans.map(plan => (
                  <div key={plan.id} onClick={() => { setItinerary(plan); setView('planner'); }} className="h-64 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col justify-between hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/20 transition-all"/>
                      <div>
                          <h3 className="text-2xl font-bold mb-2">{plan.destination}</h3>
                          <p className="text-sm text-zinc-500">{plan.days.length} Days • {plan.totalBudget} {plan.currency}</p>
                      </div>
                      <div className="flex justify-between items-end">
                          <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-500">
                             {new Date().toLocaleDateString()}
                          </span>
                          <ArrowRight className="w-5 h-5 text-zinc-300 group-hover:text-primary transition-colors" />
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 transition-colors duration-300 font-sans">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Compass className="w-5 h-5" />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">Cicerone</span>
          </div>
          <div className="flex items-center gap-4">
             {view === 'planner' && itinerary && (
               <button 
                 onClick={() => setShowRefineInput(!showRefineInput)}
                 className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-100 dark:bg-zinc-900 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
               >
                 <Sparkles className="w-4 h-4 text-primary" /> 
                 Refine Plan
               </button>
             )}
             <ThemeToggle />
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

      <main className="p-4 md:p-8">
        <AnimatePresence mode="wait">
          {view === 'home' ? (
             !itinerary ? (
                <Dashboard />
             ) : (
                // If itinerary exists in state but we are in 'home' view (implicit from previous logic, but let's be explicit)
                // Actually if itinerary exists, we might want to just show dashboard unless user clicked it.
                // Simplified: Dashboard logic handles itinerary selection.
                <Dashboard />
             )
          ) : !itinerary ? (
            <motion.div 
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[70vh]"
            >
               <div className="text-center mb-12 max-w-2xl px-4">
                 <h1 className="text-4xl md:text-6xl font-heading font-bold mb-6 tracking-tight bg-gradient-to-br from-zinc-900 via-zinc-700 to-zinc-900 dark:from-white dark:via-zinc-300 dark:to-zinc-500 bg-clip-text text-transparent">
                   Where to next?
                 </h1>
                 <p className="text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed">
                   Your personal AI travel architect. Plan detailed itineraries, manage budgets, import from social media, and discover hidden gems.
                 </p>
               </div>
               <TravelForm onSubmit={handleCreateItinerary} isLoading={isLoading} />
            </motion.div>
          ) : (
            <motion.div
              key="itinerary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full"
            >
               <ItineraryView 
                 itinerary={itinerary} 
                 onUpdateActivity={handleUpdateActivity}
                 onRefineRequest={(prompt) => {
                   setRefinePrompt(prompt);
                   handleRefine();
                 }}
                 onReorderActivities={handleReorderActivities}
                 onAddWishlistItem={handleAddWishlistItem}
                 isRefining={isRefining}
               />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AIChat />
    </div>
  );
};

export default App;