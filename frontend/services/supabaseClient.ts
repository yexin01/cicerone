/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Itinerary } from '../../shared/types';

let supabase: SupabaseClient | null = null;

export const getSupabase = () => supabase;

export const initSupabase = (url: string, key: string) => {
    if (!url || !key) return null;
    try {
        supabase = createClient(url, key);
        // Only persist to local storage if we are NOT using env vars (manual entry)
        // We can check if these match the env vars to decide, but simple existence check is enough for now.
        return supabase;
    } catch (e) {
        console.error("Failed to init supabase", e);
        return null;
    }
};

// 1. Try to load from Environment Variables (Deployment Mode)
// Note: In a standard Vite/Vercel setup, these might be import.meta.env.VITE_SUPABASE_URL
// But we stick to process.env for consistency with the provided architecture.
const envUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (envUrl && envKey) {
    initSupabase(envUrl, envKey);
} else {
    // 2. Fallback to local storage (Manual/Dev Mode)
    const savedConfig = localStorage.getItem('cicerone_supabase_config');
    if (savedConfig) {
        try {
            const { url, key } = JSON.parse(savedConfig);
            initSupabase(url, key);
        } catch(e) {}
    }
}

export const signInWithGoogle = async () => {
    if (!supabase) throw new Error("Cloud not configured");
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
            redirectTo: window.location.origin // Redirect back to the app after auth
        },
    });
    if (error) throw error;
    return data;
};

export const saveItineraryToCloud = async (itinerary: Itinerary, userId: string) => {
    if (!supabase) throw new Error("Cloud not configured");
    
    const { error } = await supabase
        .from('itineraries')
        .upsert({
            id: itinerary.id,
            user_id: userId,
            destination: itinerary.destination,
            trip_data: itinerary,
            created_at: new Date().toISOString()
        });

    if (error) throw error;
};

export const fetchItinerariesFromCloud = async () => {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data.map((row: any) => row.trip_data as Itinerary);
};