/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Itinerary, TripInput, WishlistItem } from '../types';

const API_KEY = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

const PriceDetailSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING, enum: ['free', 'paid', 'partial_free'] },
    amount: { type: Type.NUMBER },
    currency: { type: Type.STRING },
    bookingLink: { type: Type.STRING },
    description: { type: Type.STRING }
  }
};

const ActivitySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    time: { type: Type.STRING, description: "24h format HH:MM" },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    location: { type: Type.STRING },
    coordinates: { 
        type: Type.OBJECT, 
        properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } } 
    },
    type: { type: Type.STRING, enum: ['food', 'culture', 'nature', 'transport', 'leisure', 'logistics', 'blocked', 'custom'] },
    durationMinutes: { type: Type.INTEGER },
    estimatedCost: { type: Type.NUMBER },
    priceDetail: PriceDetailSchema,
    isLocked: { type: Type.BOOLEAN },
    transportToNext: { type: Type.STRING }
  },
  required: ['id', 'time', 'title', 'location', 'type', 'durationMinutes']
};

const DayPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    date: { type: Type.STRING, description: "YYYY-MM-DD" },
    dayNumber: { type: Type.INTEGER },
    activities: { type: Type.ARRAY, items: ActivitySchema }
  },
  required: ['date', 'dayNumber', 'activities']
};

const ItinerarySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    destination: { type: Type.STRING },
    title: { type: Type.STRING },
    totalBudget: { type: Type.NUMBER },
    currency: { type: Type.STRING },
    days: { type: Type.ARRAY, items: DayPlanSchema }
  },
  required: ['destination', 'days']
};

export const generateItinerary = async (input: TripInput): Promise<Itinerary> => {
  const model = "gemini-2.5-flash";
  
  const prompt = `
    Create a detailed travel itinerary for ${input.destination}.
    Duration: ${input.durationDays} days starting ${input.startDate}.
    Budget: ${input.budget}.
    Travelers: ${input.travelers}.
    Interests: ${input.interests.join(', ')}.
    
    Logistics:
    - Arrival: ${input.logistics.arrival.type} at ${input.logistics.arrival.location} (${input.logistics.arrival.time}). Address: ${input.logistics.arrival.address || 'N/A'}.
    - Departure: ${input.logistics.departure.type} from ${input.logistics.departure.location} (${input.logistics.departure.time}). Address: ${input.logistics.departure.address || 'N/A'}.
    - Stay: ${input.logistics.accommodation.name} at ${input.logistics.accommodation.address}.

    Requirements:
    1. Include the arrival and departure as 'logistics' activities.
    2. Provide coordinates (approx lat/lng) for each location for map visualization.
    3. Include price details: is it free? Is there a student/senior discount? Provide a real booking link if possible.
    4. For paid items, include the estimated cost.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: ItinerarySchema,
        systemInstruction: "You are Cicerone, an expert AI travel architect. You prioritize logistics, realistic timing, and hidden gems. You output strictly structured JSON. Provide real booking links and price details."
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const data = JSON.parse(text) as Itinerary;
    // Client-side hydration
    data.logistics = input.logistics;
    data.wishlist = [];
    data.days.forEach(day => {
      day.activities.forEach(act => {
        act.feedback = 'neutral';
        act.isLocked = act.isLocked || false;
        act.userNotes = '';
      });
    });
    
    return data;
  } catch (error) {
    console.error("Error generating itinerary:", error);
    throw error;
  }
};

export const refineItinerary = async (currentItinerary: Itinerary, userRequest: string): Promise<Itinerary> => {
  const model = "gemini-2.5-flash";

  const prompt = `
    Refine this itinerary based on the user's request: "${userRequest}".
    
    Current Itinerary (JSON):
    ${JSON.stringify(currentItinerary)}

    CONSTRAINTS:
    1. KEEP locked activities (isLocked=true) FIXED in time and place.
    2. Respect 'blocked' activities as unavailable time slots.
    3. If reordering is implied, adjust travel times and neighboring activities.
    4. Output the FULL updated itinerary JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: ItinerarySchema,
        systemInstruction: "You are Cicerone. Refine the plan while respecting locked and blocked slots."
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const data = JSON.parse(text) as Itinerary;
    
    // Merge state (feedback, locks, notes)
    const oldActivityMap = new Map<string, any>();
    currentItinerary.days.forEach(d => d.activities.forEach(a => oldActivityMap.set(a.id, a)));

    data.days.forEach(day => {
      day.activities.forEach(act => {
        const old = oldActivityMap.get(act.id);
        if (old) {
          act.feedback = old.feedback;
          act.actualCost = old.actualCost;
          act.userNotes = old.userNotes;
          if (old.isLocked) Object.assign(act, old); // Force keep old if locked
        } else {
          act.feedback = 'neutral';
          act.isLocked = false;
        }
      });
    });
    data.wishlist = currentItinerary.wishlist;
    data.logistics = currentItinerary.logistics;

    return data;
  } catch (error) {
    console.error("Refine error:", error);
    throw error;
  }
};

export const analyzeSocialContent = async (content: string): Promise<WishlistItem> => {
    const model = "gemini-2.5-flash";
    const prompt = `
      Analyze this social media content/link/text and extract travel information:
      "${content}"
      
      Return a JSON with:
      - possibleName: Name of the place/activity
      - summary: Brief description of what makes it cool/viral
      - tags: Array of tags (e.g. "Food", "View", "Hidden Gem")
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            tools: [{ googleSearch: {} }] // Use search to find details about the link/text
        }
    });

    const text = response.text;
    let analysis = { possibleName: "Unknown Spot", summary: "Could not analyze", tags: [] };
    
    try {
        analysis = JSON.parse(text);
    } catch (e) {
        console.warn("Failed to parse analysis json", e);
    }

    return {
        id: Date.now().toString(),
        content,
        type: content.startsWith('http') ? 'url' : 'text',
        analysis
    };
};

export const chatWithAgent = async (history: {role: string, parts: {text: string}[]}[], message: string) => {
   const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      history: history,
      config: {
          systemInstruction: "You are Cicerone. Be helpful, technical, and concise."
      }
   });

   const result = await chat.sendMessage({ message });
   return result.text;
}
