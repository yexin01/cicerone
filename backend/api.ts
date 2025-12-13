/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Itinerary, TripInput, WishlistItem } from '../shared/types';

const API_KEY = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper to clean JSON from markdown code blocks
const cleanJson = (text: string) => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

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
    isMandatory: { type: Type.BOOLEAN },
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
  // Use Pro model for complex planning and reasoning
  const model = "gemini-3-pro-preview";
  
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

    IMPORTANT Requirements:
    1. You have access to Google Maps and Google Search.
    2. Use Google Maps to verify the existence, location, and address of every place. Provide the 'googleMapsUrl'.
    3. Use Google Search to find a representative image URL ('imageUrl') for the activities if possible.
    4. Provide coordinates (approx lat/lng) for each location for map visualization.
    5. Include price details: is it free? Is there a student/senior discount? Provide a real booking link if possible.
    
    Output strictly valid JSON (no markdown formatting, no code blocks, just the raw JSON string) matching the following structure:
    {
      "id": "string",
      "destination": "string",
      "title": "string",
      "totalBudget": number,
      "currency": "string",
      "days": [
        {
          "date": "YYYY-MM-DD",
          "dayNumber": number,
          "activities": [
             {
               "id": "string",
               "time": "HH:MM",
               "title": "string",
               "description": "string",
               "location": "string",
               "googleMapsUrl": "string",
               "imageUrl": "string",
               "coordinates": { "lat": number, "lng": number },
               "type": "food" | "culture" | "nature" | "transport" | "leisure" | "logistics" | "blocked" | "custom",
               "durationMinutes": number,
               "estimatedCost": number,
               "priceDetail": { "category": "free"|"paid", "amount": number, "currency": "string", "bookingLink": "string" },
               "isLocked": boolean,
               "isMandatory": boolean,
               "transportToNext": "string"
             }
          ]
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        // responseMimeType: "application/json" is NOT allowed with googleMaps tool
        // We must rely on the prompt to enforce JSON structure
        tools: [{ googleMaps: {}, googleSearch: {} }], 
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const jsonStr = cleanJson(text);
    const data = JSON.parse(jsonStr) as Itinerary;

    // Client-side hydration
    data.logistics = input.logistics;
    data.wishlist = [];
    data.days.forEach(day => {
      day.activities.forEach(act => {
        act.feedback = 'neutral';
        act.isLocked = act.isLocked || false;
        act.isMandatory = false; // Default
        act.userNotes = '';
        if(!act.id) act.id = Math.random().toString(36).substr(2, 9);
      });
    });
    
    return data;
  } catch (error) {
    console.error("Error generating itinerary:", error);
    throw error;
  }
};

export const refineItinerary = async (currentItinerary: Itinerary, userRequest: string): Promise<Itinerary> => {
  // Use Pro model for complex refinement and constraint management
  const model = "gemini-3-pro-preview";

  const prompt = `
    Refine this itinerary based on the user's request: "${userRequest}".
    
    Current Itinerary (JSON):
    ${JSON.stringify(currentItinerary)}

    CONSTRAINTS:
    1. KEEP locked activities (isLocked=true) FIXED in time and place.
    2. Respect 'blocked' activities as unavailable time slots.
    3. Ensure activities marked as 'isMandatory=true' are included in the itinerary, though their time can change (unless locked).
    4. Use Google Maps to verify any new locations added.
    5. Output the FULL updated itinerary as strict JSON (no markdown).
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const jsonStr = cleanJson(text);
    const data = JSON.parse(jsonStr) as Itinerary;
    
    // Merge state (feedback, locks, mandatory, notes)
    const oldActivityMap = new Map<string, any>();
    currentItinerary.days.forEach(d => d.activities.forEach(a => oldActivityMap.set(a.id, a)));

    data.days.forEach(day => {
      day.activities.forEach(act => {
        const old = oldActivityMap.get(act.id);
        if (old) {
          act.feedback = old.feedback;
          act.actualCost = old.actualCost;
          act.userNotes = old.userNotes;
          act.isMandatory = old.isMandatory;
          if (old.isLocked) Object.assign(act, old); // Force keep old if locked
        } else {
          act.feedback = 'neutral';
          act.isLocked = false;
          act.isMandatory = false;
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
    // Use Flash for faster text extraction
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
   // Use Pro for high quality, knowledgeable conversational responses
   const chat = ai.chats.create({
      model: "gemini-3-pro-preview",
      history: history,
      config: {
          systemInstruction: "You are Cicerone, an intelligent travel assistant. You provide specific, actionable advice using Google Maps data when relevant. Keep responses concise.",
          tools: [{ googleMaps: {} }, { googleSearch: {} }]
      }
   });

   const result = await chat.sendMessage({ message });
   return result.text;
}