/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, DollarSign, Users, Plane, Home, ArrowRight, Loader2, Train, Car, Bus } from 'lucide-react';
import { TripInput, TripLogistics } from '../types';

interface TravelFormProps {
  onSubmit: (input: TripInput) => void;
  isLoading: boolean;
}

const TravelForm: React.FC<TravelFormProps> = ({ onSubmit, isLoading }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<TripInput>({
    destination: '',
    startDate: new Date().toISOString().split('T')[0],
    durationDays: 3,
    budget: 'Moderate',
    travelers: 1,
    interests: [],
    logistics: {
      arrival: { type: 'flight', location: '', time: '10:00', address: '' },
      departure: { type: 'flight', location: '', time: '18:00', address: '' },
      accommodation: { name: '', address: '' }
    }
  });

  const INTERESTS = ['Food & Dining', 'History & Culture', 'Nature & Outdoors', 'Art & Museums', 'Nightlife', 'Shopping', 'Relaxation'];

  const toggleInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const updateLogistics = (section: keyof TripLogistics, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      logistics: {
        ...prev.logistics,
        [section]: {
          ...prev.logistics[section],
          [field]: value
        }
      }
    }));
  };

  const TransportIcon = ({ type }: { type: string }) => {
      switch(type) {
          case 'train': return <Train className="w-4 h-4" />;
          case 'car': return <Car className="w-4 h-4" />;
          case 'bus': return <Bus className="w-4 h-4" />;
          default: return <Plane className="w-4 h-4" />;
      }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const nextStep = () => {
    setStep(prev => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 md:p-8 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl transition-colors duration-300">
      <div className="mb-8 flex justify-between items-center">
         <h2 className="text-2xl font-bold font-heading tracking-tight">
           {step === 1 ? 'Trip Essentials' : step === 2 ? 'Logistics' : 'Preferences'}
         </h2>
         <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-1.5 w-8 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
            ))}
         </div>
      </div>

      <form onSubmit={handleSubmit}>
        <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
          {step === 1 && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Destination</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    placeholder="e.g., Tokyo, Japan"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-3.5 w-5 h-5 text-zinc-400" />
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                   <label className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Duration (Days)</label>
                   <input
                      type="number"
                      min="1"
                      max="14"
                      required
                      value={formData.durationDays}
                      onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                   />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Budget</label>
                   <div className="relative">
                      <DollarSign className="absolute left-4 top-3.5 w-5 h-5 text-zinc-400" />
                      <select
                        value={formData.budget}
                        onChange={(e) => setFormData({...formData, budget: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary outline-none appearance-none"
                      >
                        <option>Budget</option>
                        <option>Moderate</option>
                        <option>Luxury</option>
                      </select>
                   </div>
                </div>
                 <div className="space-y-2">
                   <label className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Travelers</label>
                   <div className="relative">
                      <Users className="absolute left-4 top-3.5 w-5 h-5 text-zinc-400" />
                      <input
                        type="number"
                        min="1"
                        value={formData.travelers}
                        onChange={(e) => setFormData({ ...formData, travelers: parseInt(e.target.value) })}
                        className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                      />
                   </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
             <div className="space-y-6">
                {/* Arrival */}
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-sm">
                        <TransportIcon type={formData.logistics.arrival.type} /> Arrival
                    </div>
                    <select 
                       value={formData.logistics.arrival.type}
                       onChange={(e) => updateLogistics('arrival', 'type', e.target.value)}
                       className="text-xs bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:outline-none"
                    >
                        <option value="flight">Flight</option>
                        <option value="train">Train</option>
                        <option value="car">Car/Taxi</option>
                        <option value="bus">Bus</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                     <input 
                        placeholder={formData.logistics.arrival.type === 'flight' ? "Flight # / Airport" : "Station / Location"}
                        className="col-span-1 p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm"
                        value={formData.logistics.arrival.location}
                        onChange={(e) => updateLogistics('arrival', 'location', e.target.value)}
                     />
                     <input 
                        type="time"
                        className="col-span-1 p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm"
                        value={formData.logistics.arrival.time}
                        onChange={(e) => updateLogistics('arrival', 'time', e.target.value)}
                     />
                  </div>
                  <input 
                    placeholder="Specific Address (Optional)"
                    className="w-full p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm"
                    value={formData.logistics.arrival.address}
                    onChange={(e) => updateLogistics('arrival', 'address', e.target.value)}
                  />
                </div>

                {/* Accommodation */}
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30">
                  <div className="flex items-center gap-2 mb-4 text-primary font-bold uppercase tracking-wider text-sm">
                    <Home className="w-4 h-4" /> Accommodation
                  </div>
                  <div className="space-y-3">
                     <input 
                        placeholder="Hotel Name"
                        className="w-full p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm"
                        value={formData.logistics.accommodation.name}
                        onChange={(e) => updateLogistics('accommodation', 'name', e.target.value)}
                     />
                     <input 
                        placeholder="Address"
                        className="w-full p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm"
                        value={formData.logistics.accommodation.address}
                        onChange={(e) => updateLogistics('accommodation', 'address', e.target.value)}
                     />
                  </div>
                </div>

                {/* Departure */}
                 <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-sm">
                        <TransportIcon type={formData.logistics.departure.type} /> Departure
                    </div>
                    <select 
                       value={formData.logistics.departure.type}
                       onChange={(e) => updateLogistics('departure', 'type', e.target.value)}
                       className="text-xs bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:outline-none"
                    >
                        <option value="flight">Flight</option>
                        <option value="train">Train</option>
                        <option value="car">Car/Taxi</option>
                        <option value="bus">Bus</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                     <input 
                        placeholder="Location"
                        className="col-span-1 p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm"
                        value={formData.logistics.departure.location}
                        onChange={(e) => updateLogistics('departure', 'location', e.target.value)}
                     />
                     <input 
                        type="time"
                        className="col-span-1 p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm"
                        value={formData.logistics.departure.time}
                        onChange={(e) => updateLogistics('departure', 'time', e.target.value)}
                     />
                  </div>
                  <input 
                    placeholder="Specific Address (Optional)"
                    className="w-full p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm"
                    value={formData.logistics.departure.address}
                    onChange={(e) => updateLogistics('departure', 'address', e.target.value)}
                  />
                </div>
             </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <label className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Select Interests</label>
              <div className="grid grid-cols-2 gap-3">
                {INTERESTS.map(interest => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`p-4 rounded-xl border text-sm font-medium transition-all duration-200 text-left ${
                      formData.interests.includes(interest)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <div className="flex gap-4 mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
           {step > 1 && (
             <button
               type="button"
               onClick={prevStep}
               className="px-6 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
             >
               Back
             </button>
           )}
           
           {step < 3 ? (
             <button
               type="button"
               onClick={nextStep}
               className="flex-1 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-bold tracking-wide hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
             >
               Next <ArrowRight className="w-4 h-4" />
             </button>
           ) : (
             <button
               type="submit"
               disabled={isLoading}
               className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-bold tracking-wide hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isLoading ? <Loader2 className="animate-spin w-5 h-5"/> : 'Generate Itinerary'}
             </button>
           )}
        </div>
      </form>
    </div>
  );
};

export default TravelForm;