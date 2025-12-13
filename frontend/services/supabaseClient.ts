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
        return supabase;
    } catch (e) {
        console.error("Failed to init supabase", e);
        return null;
    }
};

// Initialize automatically from Environment Variables
const envUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (envUrl && envKey) {
    initSupabase(envUrl, envKey);
}

export const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
}

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