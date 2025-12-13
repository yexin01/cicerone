/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { Itinerary, Activity, WishlistItem } from '../../shared/types';
import { MapPin, Lock, Unlock, DollarSign, Share2, Plus, ArrowRight, Ban, ExternalLink, Link as LinkIcon, Edit3, Map, Star, ThumbsUp, ThumbsDown, Loader2, Navigation, Footprints, Car, Train, Bus, Bike, Sparkles, Save, Download } from 'lucide-react';
import MapComponent from './MapComponent';
import { analyzeSocialContent } from '../../frontend/services/geminiService';

interface ItineraryViewProps {
  itinerary: Itinerary;
  onUpdateActivity: (dayIndex: number, activityId: string, updates: Partial<Activity>) => void;
  onUpdateItinerary: (updates: Partial<Itinerary>) => void;
  onRefineRequest: (prompt: string) => void;
  onReorderActivities: (dayIndex: number, newActivities: Activity[]) => void;
  onAddWishlistItem: (item: WishlistItem) => void;
  isRefining: boolean;
}

const ItineraryView: React.FC<ItineraryViewProps> = ({ 
  itinerary, onUpdateActivity, onUpdateItinerary, onRefineRequest, onReorderActivities, onAddWishlistItem, isRefining 
}) => {
  const [selectedDay, setSelectedDay] = useState(0);
  const [editingItem, setEditingItem] = useState<{ id: string, field: string } | null>(null);
  const [wishlistUrl, setWishlistUrl] = useState('');
  const [analyzingLink, setAnalyzingLink] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [highlightedActivity, setHighlightedActivity] = useState<string | null>(null);
  const [refineInput, setRefineInput] = useState('');

  const calculateTotalCost = () => {
    let total = 0;
    itinerary.days.forEach(day => {
      day.activities.forEach(act => {
        total += act.actualCost !== undefined ? act.actualCost : (act.estimatedCost || 0);
      });
    });
    return total;
  };

  const handleShare = () => {
    // Basic simulation of sharing URL
    const baseUrl = window.location.href.split('?')[0];
    const dummyShareUrl = `${baseUrl}?planId=${itinerary.id}&share=true`;
    navigator.clipboard.writeText(dummyShareUrl);
    alert(`Share Link Copied: ${dummyShareUrl}\n(Note: In a real app, this would point to a backend record)`);
  };

  const handleSave = () => {
    // Export to JSON
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(itinerary, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `cicerone-trip-${itinerary.destination.toLowerCase().replace(/\s+/g, '-')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleAnalyzeLink = async () => {
    if(!wishlistUrl) return;
    setAnalyzingLink(true);
    try {
        const item = await analyzeSocialContent(wishlistUrl);
        onAddWishlistItem(item);
        setWishlistUrl('');
    } catch(e) {
        alert("Could not analyze link.");
    } finally {
        setAnalyzingLink(false);
    }
  };

  const handleRefineSubmit = () => {
      if(!refineInput.trim()) return;
      onRefineRequest(refineInput);
      setRefineInput('');
  };

  const handleDragReorder = (newOrder: Activity[]) => {
      onReorderActivities(selectedDay, newOrder);
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'food': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'culture': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      case 'nature': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'blocked': return 'text-zinc-500 bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  const TransportDisplay = ({ activity }: { activity: Activity }) => {
    const rawText = activity.transportToNext || '';
    const options = rawText.split('|').map(t => t.trim()).filter(Boolean);
    const selected = activity.selectedTransport || options[0]; // Default to first

    const parseOption = (opt: string) => {
        // Regex to capture: Mode: Time (Cost)
        // Matches "Walk: 30m" or "Taxi: 15m ($10)"
        const match = opt.match(/^([^:]+):\s*([^(\n]+)(?:\s*\(([^)]+)\))?$/);
        if (match) {
            return { mode: match[1].trim(), time: match[2].trim(), cost: match[3]?.trim(), original: opt };
        }
        // Fallback split
        const parts = opt.split(':');
        return { 
            mode: parts[0]?.trim() || 'Transport', 
            time: parts[1]?.trim() || '', 
            cost: null,
            original: opt 
        };
    };

    const getModeConfig = (modeStr: string) => {
        const m = modeStr.toLowerCase();
        if (m.includes('walk') || m.includes('foot')) return { 
            icon: Footprints, 
            color: 'text-emerald-600 dark:text-emerald-400', 
            bg: 'bg-emerald-100 dark:bg-emerald-900/30' 
        };
        if (m.includes('taxi') || m.includes('car') || m.includes('uber') || m.includes('drive')) return { 
            icon: Car, 
            color: 'text-amber-600 dark:text-amber-400', 
            bg: 'bg-amber-100 dark:bg-amber-900/30' 
        };
        if (m.includes('train') || m.includes('metro') || m.includes('subway') || m.includes('rail')) return { 
            icon: Train, 
            color: 'text-blue-600 dark:text-blue-400', 
            bg: 'bg-blue-100 dark:bg-blue-900/30' 
        };
        if (m.includes('bus')) return { 
            icon: Bus, 
            color: 'text-indigo-600 dark:text-indigo-400', 
            bg: 'bg-indigo-100 dark:bg-indigo-900/30' 
        };
        if (m.includes('bike') || m.includes('cycle')) return {
            icon: Bike,
            color: 'text-cyan-600 dark:text-cyan-400',
            bg: 'bg-cyan-100 dark:bg-cyan-900/30'
        };
        return { 
            icon: Navigation, 
            color: 'text-zinc-600 dark:text-zinc-400', 
            bg: 'bg-zinc-100 dark:bg-zinc-800' 
        };
    };

    const handleSelect = (option: string) => {
        onUpdateActivity(selectedDay, activity.id, { selectedTransport: option });
    };

    if (options.length === 0) return null;

    return (
      <div className="mt-3 bg-white/50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
         <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/80 flex justify-between items-center backdrop-blur-sm">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                <Navigation className="w-3 h-3"/> Travel to Next Stop
            </span>
            <span className="text-[10px] text-zinc-400">Select option</span>
         </div>
         <div className="p-2 space-y-2">
             {options.map((option, idx) => {
                 const { mode, time, cost } = parseOption(option);
                 const isSelected = selected === option;
                 const { icon: Icon, color, bg } = getModeConfig(mode);
                 
                 return (
                     <div 
                        key={idx} 
                        onClick={(e) => { e.stopPropagation(); handleSelect(option); }}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border ${
                            isSelected 
                            ? 'bg-white dark:bg-zinc-800 border-primary/40 shadow-sm ring-1 ring-primary/20' 
                            : 'bg-transparent border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-zinc-200 dark:hover:border-zinc-700'
                        }`}
                     >
                        <div className={`p-2 rounded-md shrink-0 transition-colors ${isSelected ? bg : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                            <Icon className={`w-4 h-4 ${isSelected ? color : 'text-zinc-400'}`} />
                        </div>
                        
                        <div className="flex-1 flex justify-between items-center min-w-0">
                            <div className="flex flex-col">
                                <span className={`text-xs font-bold leading-none mb-1 ${isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                    {mode}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-medium">
                                    {time}
                                </span>
                            </div>
                            {cost && (
                                <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${
                                    isSelected 
                                    ? (cost.toLowerCase().includes('free') ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300')
                                    : 'text-zinc-400 bg-zinc-50 dark:bg-zinc-900'
                                }`}>
                                    {cost}
                                </span>
                            )}
                        </div>
                        
                        {/* Radio indicator */}
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'border-primary bg-primary' : 'border-zinc-300 dark:border-zinc-600 group-hover:border-zinc-400'
                        }`}>
                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                     </div>
                 );
             })}
         </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-1">{itinerary.destination}</h1>
          <div className="flex gap-4 text-xs md:text-sm text-zinc-500">
             <span className="flex items-center gap-1 font-mono">
                <DollarSign className="w-4 h-4"/> Budget: {itinerary.currency}
                {editingItem?.id === 'root' && editingItem.field === 'totalBudget' ? (
                    <input 
                        type="number"
                        className="w-20 bg-transparent border-b border-primary outline-none focus:bg-white dark:focus:bg-zinc-800"
                        autoFocus
                        defaultValue={itinerary.totalBudget}
                        onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) onUpdateItinerary({ totalBudget: val });
                            setEditingItem(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                    />
                ) : (
                    <span 
                        className="cursor-pointer hover:text-primary border-b border-dashed border-transparent hover:border-primary transition-colors"
                        onClick={() => setEditingItem({ id: 'root', field: 'totalBudget' })}
                        title="Click to edit budget"
                    >
                        {itinerary.totalBudget}
                    </span>
                )}
             </span>
             <span className="flex items-center gap-1 font-mono text-primary"><DollarSign className="w-4 h-4"/> Est. Total: {itinerary.currency}{calculateTotalCost()}</span>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setShowMap(!showMap)} className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium">
             <MapPin className="w-4 h-4" /> {showMap ? 'Hide Map' : 'Show Map'}
           </button>
           <button onClick={handleSave} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-xs font-bold">
             <Download className="w-4 h-4" /> Save
           </button>
           <button onClick={handleShare} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity text-xs font-bold">
             <Share2 className="w-4 h-4" /> Share
           </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* Left Column: Wishlist & Days */}
        <div className="lg:w-1/4 flex flex-col gap-4 overflow-y-auto pr-2">
           {/* Refinement Box */}
           <div className="bg-gradient-to-br from-primary/10 to-transparent p-4 rounded-xl border border-primary/10 mb-2">
                <h3 className="font-bold text-xs uppercase tracking-wider mb-2 text-primary flex items-center gap-2">
                    <Sparkles className="w-3 h-3"/> AI Adjustment
                </h3>
                <div className="flex gap-2">
                    <input 
                        className="flex-1 bg-white/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" 
                        placeholder="e.g. 'Relax schedule', 'Add dinner'"
                        value={refineInput}
                        onChange={(e) => setRefineInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRefineSubmit()}
                    />
                    <button 
                        onClick={handleRefineSubmit}
                        disabled={isRefining || !refineInput.trim()}
                        className="bg-primary text-white p-1.5 rounded-lg disabled:opacity-50 hover:bg-blue-600 transition-colors"
                    >
                        {isRefining ? <Loader2 className="animate-spin w-4 h-4"/> : <ArrowRight className="w-4 h-4"/>}
                    </button>
                </div>
            </div>

           {/* Wishlist Input */}
           <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-xs uppercase tracking-wider mb-3 text-zinc-500 flex items-center gap-2">
                  <LinkIcon className="w-3 h-3"/> Import from Social
              </h3>
              <div className="flex gap-2 mb-3">
                  <input 
                    className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm"
                    placeholder="Paste TikTok/IG link..."
                    value={wishlistUrl}
                    onChange={(e) => setWishlistUrl(e.target.value)}
                  />
                  <button 
                    onClick={handleAnalyzeLink} 
                    disabled={analyzingLink}
                    className="bg-primary text-white p-1.5 rounded-lg disabled:opacity-50"
                  >
                     {analyzingLink ? <ArrowRight className="animate-spin w-4 h-4"/> : <Plus className="w-4 h-4"/>}
                  </button>
              </div>
              
              {/* Wishlist Items */}
              {itinerary.wishlist && itinerary.wishlist.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {itinerary.wishlist.map(item => (
                        <div key={item.id} className="p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded border border-zinc-100 dark:border-zinc-800 text-xs">
                            <p className="font-bold truncate">{item.analysis?.possibleName || "New Item"}</p>
                            <p className="text-zinc-500 truncate">{item.analysis?.summary}</p>
                            <button 
                                onClick={() => onRefineRequest(`Add ${item.analysis?.possibleName} to the plan`)}
                                className="text-primary text-[10px] hover:underline mt-1"
                            >
                                + Add to Plan
                            </button>
                        </div>
                    ))}
                </div>
              )}
           </div>

           {/* Day Selector */}
           <div className="space-y-1">
             {itinerary.days.map((day, idx) => (
               <button
                 key={day.date}
                 onClick={() => setSelectedDay(idx)}
                 className={`w-full text-left p-3 rounded-xl text-sm font-medium transition-all border ${
                   selectedDay === idx 
                   ? 'bg-primary text-white border-primary shadow-lg shadow-blue-500/20' 
                   : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                 }`}
               >
                 <div className="flex justify-between items-center">
                   <span>Day {day.dayNumber}</span>
                   <span className={`text-xs ${selectedDay === idx ? 'text-blue-100' : 'text-zinc-400'}`}>
                     {new Date(day.date).toLocaleDateString('en-US', {weekday: 'short'})}
                   </span>
                 </div>
               </button>
             ))}
           </div>
        </div>

        {/* Center: Timeline */}
        <div className="lg:w-2/5 flex flex-col h-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
           <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm z-10 sticky top-0 flex justify-between items-center">
               <h2 className="font-bold text-lg">Day {itinerary.days[selectedDay].dayNumber} Timeline</h2>
               <AnimatePresence>
                 {isRefining && (
                    <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 text-xs text-primary font-medium bg-primary/10 px-3 py-1 rounded-full"
                    >
                        <Loader2 className="w-3 h-3 animate-spin"/> Optimizing Schedule...
                    </motion.div>
                 )}
               </AnimatePresence>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
             <Reorder.Group 
                axis="y" 
                values={itinerary.days[selectedDay].activities} 
                onReorder={handleDragReorder}
                className="space-y-4"
             >
                {itinerary.days[selectedDay].activities.map((activity) => (
                  <Reorder.Item 
                    key={activity.id} 
                    value={activity}
                    className={`relative rounded-xl border p-4 cursor-grab active:cursor-grabbing transition-colors ${
                       highlightedActivity === activity.id ? 'ring-2 ring-primary border-transparent' : ''
                    } ${
                        activity.type === 'blocked' 
                        ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-70 border-dashed'
                        : activity.isMandatory
                           ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/50 hover:border-amber-400 dark:hover:border-amber-600'
                           : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                    onHoverStart={() => setHighlightedActivity(activity.id)}
                    onHoverEnd={() => setHighlightedActivity(null)}
                  >
                     <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                {activity.time}
                            </span>
                            {activity.type === 'blocked' ? (
                                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full border border-zinc-400 text-zinc-500 flex items-center gap-1">
                                    <Ban className="w-3 h-3"/> Blocked
                                </span>
                            ) : (
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getTypeColor(activity.type)}`}>
                                    {activity.type}
                                </span>
                            )}
                            
                            {/* Mandatory Indicator */}
                            {activity.isMandatory && (
                                <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                                   <Star className="w-2.5 h-2.5 fill-current"/> Mandatory
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                             {!['blocked', 'logistics'].includes(activity.type) && (
                                <>
                                  <button 
                                      onClick={() => onUpdateActivity(selectedDay, activity.id, { isMandatory: !activity.isMandatory })}
                                      onPointerDown={(e) => e.stopPropagation()} 
                                      className={`p-1.5 rounded-md transition-colors ${activity.isMandatory ? 'text-amber-500 bg-amber-100 dark:bg-amber-900/30' : 'text-zinc-300 hover:text-amber-400'}`}
                                      title={activity.isMandatory ? "Marked as Mandatory" : "Mark as Mandatory"}
                                  >
                                      <Star className={`w-3 h-3 ${activity.isMandatory ? 'fill-current' : ''}`} />
                                  </button>
                                  <button 
                                      onClick={() => onUpdateActivity(selectedDay, activity.id, { isLocked: !activity.isLocked })}
                                      onPointerDown={(e) => e.stopPropagation()} 
                                      className={`p-1.5 rounded-md transition-colors ${activity.isLocked ? 'text-red-500 bg-red-50 dark:bg-red-900/30' : 'text-zinc-300 hover:text-zinc-500'}`}
                                      title={activity.isLocked ? "Time & Place Locked" : "Lock Time & Place"}
                                  >
                                      {activity.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                  </button>
                                </>
                             )}
                        </div>
                     </div>

                     <div className="flex gap-3">
                         {/* Optional Image */}
                         {activity.imageUrl && (
                             <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                 <img 
                                    src={activity.imageUrl} 
                                    alt={activity.title} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                 />
                             </div>
                         )}
                         
                         <div className="flex-1 min-w-0">
                             <div className="mb-2 space-y-1">
                                {/* Title Edit */}
                                {editingItem?.id === activity.id && editingItem.field === 'title' ? (
                                   <input
                                      autoFocus
                                      className="w-full font-bold text-base bg-white dark:bg-black border border-primary rounded px-1 outline-none"
                                      defaultValue={activity.title}
                                      onBlur={(e) => {
                                         onUpdateActivity(selectedDay, activity.id, { title: e.target.value });
                                         setEditingItem(null);
                                      }}
                                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                      onPointerDown={(e) => e.stopPropagation()}
                                   />
                                ) : (
                                   <h3 
                                      className="font-bold text-base leading-tight hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-1 -mx-1 cursor-text transition-colors truncate"
                                      onClick={(e) => { e.stopPropagation(); setEditingItem({ id: activity.id, field: 'title' }); }}
                                      onPointerDown={(e) => e.stopPropagation()}
                                   >
                                      {activity.title}
                                   </h3>
                                )}

                                {/* Location Edit & Maps Link */}
                                <div className="flex items-center gap-1 text-xs text-zinc-500">
                                   <MapPin className="w-3 h-3 shrink-0" />
                                   {editingItem?.id === activity.id && editingItem.field === 'location' ? (
                                      <input
                                         autoFocus
                                         className="w-full bg-white dark:bg-black border border-primary rounded px-1 outline-none"
                                         defaultValue={activity.location}
                                         onBlur={(e) => {
                                            onUpdateActivity(selectedDay, activity.id, { location: e.target.value });
                                            setEditingItem(null);
                                         }}
                                         onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                         onPointerDown={(e) => e.stopPropagation()}
                                      />
                                   ) : (
                                      <span 
                                         className="hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-1 -mx-1 cursor-text transition-colors truncate mr-2"
                                         onClick={(e) => { e.stopPropagation(); setEditingItem({ id: activity.id, field: 'location' }); }}
                                         onPointerDown={(e) => e.stopPropagation()}
                                      >
                                         {activity.location || "Add location..."}
                                      </span>
                                   )}
                                   
                                   {activity.googleMapsUrl && (
                                       <a 
                                        href={activity.googleMapsUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-primary hover:underline flex items-center gap-0.5"
                                        onPointerDown={(e) => e.stopPropagation()}
                                       >
                                           <Map className="w-3 h-3"/> Maps
                                       </a>
                                   )}
                                </div>
                             </div>

                             {/* Description Edit */}
                             {editingItem?.id === activity.id && editingItem.field === 'description' ? (
                                   <textarea
                                      autoFocus
                                      className="w-full text-xs bg-white dark:bg-black border border-primary rounded px-1 outline-none resize-none"
                                      defaultValue={activity.description}
                                      onBlur={(e) => {
                                         onUpdateActivity(selectedDay, activity.id, { description: e.target.value });
                                         setEditingItem(null);
                                      }}
                                      onKeyDown={(e) => {
                                         if(e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            e.currentTarget.blur();
                                         }
                                      }}
                                      onPointerDown={(e) => e.stopPropagation()}
                                   />
                                ) : (
                                   <p 
                                      className="text-xs text-zinc-500 mt-1 line-clamp-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-1 -mx-1 cursor-text transition-colors"
                                      onClick={(e) => { e.stopPropagation(); setEditingItem({ id: activity.id, field: 'description' }); }}
                                      onPointerDown={(e) => e.stopPropagation()}
                                   >
                                      {activity.description || "Add description..."}
                                   </p>
                                )}
                         </div>
                     </div>

                     {/* Price & Link */}
                     {activity.priceDetail && (
                         <div className="flex items-center gap-3 mt-2 text-xs">
                             <span className={`px-1.5 py-0.5 rounded border ${
                                 activity.priceDetail.category === 'free' ? 'border-green-200 bg-green-50 text-green-700' : 'border-zinc-200 text-zinc-600'
                             }`}>
                                 {activity.priceDetail.category === 'free' ? 'FREE' : 'PAID'}
                             </span>
                             {activity.priceDetail.amount && (
                                 <span className="font-mono">{itinerary.currency}{activity.priceDetail.amount}</span>
                             )}
                             {activity.priceDetail.bookingLink && (
                                 <a 
                                    href={activity.priceDetail.bookingLink} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline"
                                    onPointerDown={(e) => e.stopPropagation()}
                                 >
                                     Book <ExternalLink className="w-3 h-3"/>
                                 </a>
                             )}
                         </div>
                     )}

                     {/* Transport To Next */}
                     {activity.transportToNext && (
                        <TransportDisplay activity={activity} />
                     )}
                     
                     {/* Footer Actions: Notes & Feedback */}
                     <div className="mt-3 pt-3 border-t border-dashed border-zinc-100 dark:border-zinc-800 flex justify-between items-start">
                        {/* Notes */}
                        <div className="flex-1 mr-4">
                            {editingItem?.id === activity.id && editingItem.field === 'userNotes' ? (
                                <textarea 
                                    autoFocus
                                    className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700 outline-none"
                                    defaultValue={activity.userNotes}
                                    onBlur={(e) => {
                                        onUpdateActivity(selectedDay, activity.id, { userNotes: e.target.value });
                                        setEditingItem(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if(e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            onUpdateActivity(selectedDay, activity.id, { userNotes: (e.target as HTMLTextAreaElement).value });
                                            setEditingItem(null);
                                        }
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <div 
                                    onClick={(e) => { e.stopPropagation(); setEditingItem({ id: activity.id, field: 'userNotes' }); }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="text-xs text-zinc-400 hover:text-zinc-600 cursor-pointer flex items-center gap-2 group/note"
                                >
                                    <Edit3 className="w-3 h-3 opacity-0 group-hover/note:opacity-100 transition-opacity"/>
                                    {activity.userNotes || "Add a note..."}
                                </div>
                            )}
                        </div>

                        {/* Feedback Controls */}
                        {!['blocked', 'logistics'].includes(activity.type) && (
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => onUpdateActivity(selectedDay, activity.id, { feedback: activity.feedback === 'like' ? 'neutral' : 'like' })}
                                    className={`p-1.5 rounded transition-colors ${activity.feedback === 'like' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-zinc-300 hover:text-green-500'}`}
                                    title="I like this"
                                >
                                    <ThumbsUp className={`w-3 h-3 ${activity.feedback === 'like' ? 'fill-current' : ''}`} />
                                </button>
                                <button 
                                    onClick={() => onUpdateActivity(selectedDay, activity.id, { feedback: activity.feedback === 'dislike' ? 'neutral' : 'dislike' })}
                                    className={`p-1.5 rounded transition-colors ${activity.feedback === 'dislike' ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : 'text-zinc-300 hover:text-red-500'}`}
                                    title="I dislike this"
                                >
                                    <ThumbsDown className={`w-3 h-3 ${activity.feedback === 'dislike' ? 'fill-current' : ''}`} />
                                </button>
                            </div>
                        )}
                     </div>
                  </Reorder.Item>
                ))}
             </Reorder.Group>
           </div>
        </div>

        {/* Right Column: Map */}
        <div className={`lg:w-[35%] transition-all duration-300 ${showMap ? 'flex' : 'hidden lg:flex'} flex-col gap-4 h-[300px] lg:h-auto`}>
           <MapComponent 
             activities={itinerary.days[selectedDay].activities} 
             selectedActivityId={highlightedActivity}
             onMarkerClick={(id) => {
                 setHighlightedActivity(id);
             }}
           />
           {/* Blocked Slot Creator */}
           <div className="p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 border-dashed">
               <p className="text-xs text-zinc-500 font-bold uppercase mb-2">Unavailable Time?</p>
               <button 
                  onClick={() => onRefineRequest(`I am busy from 2pm to 4pm on Day ${itinerary.days[selectedDay].dayNumber} for work`)}
                  className="w-full py-2 text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-400 transition-colors flex items-center justify-center gap-2"
               >
                   <Ban className="w-3 h-3"/> Add Blocked Slot
               </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ItineraryView;