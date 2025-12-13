/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Itinerary, TripInput, WishlistItem, Activity } from '../types';

// Support various environment variable formats for Vercel/Next.js/Vite compatibility
const API_KEY = process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY || process.env.VITE_API_KEY || '';

if (!API_KEY) {
  console.warn("API_KEY is missing. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper to clean JSON from markdown code blocks
const cleanJson = (text: string) => {
  // Handle markdown code blocks
  const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  if (match) return match[1].trim();

  // Try to find the JSON array or object directly if no code blocks
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return text.substring(firstBracket, lastBracket + 1);
  }
  
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return text.substring(firstBrace, lastBrace + 1);
  }

  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

export const generateItinerary = async (input: TripInput): Promise<Itinerary> => {
  // Use gemini-2.5-flash which supports Google Maps tool. 
  // gemini-3-pro-preview currently throws "Google Maps tool is not enabled for this model".
  const model = "gemini-2.5-flash";
  
  const prompt = `
    Create a detailed travel itinerary for ${input.destination}.
    Duration: ${input.durationDays} days starting ${input.startDate}.
    Budget: ${input.budget}.
    Travelers: ${input.travelers}.
    Interests: ${input.interests.join(', ')}.
    Must-Visit Places (Prioritize these): ${input.mustVisit || 'None specified'}.
    
    Logistics:
    - Arrival: ${input.logistics.arrival.type} at ${input.logistics.arrival.location} (${input.logistics.arrival.time}). Address: ${input.logistics.arrival.address || 'N/A'}.
    - Departure: ${input.logistics.departure.type} from ${input.logistics.departure.location} (${input.logistics.departure.time}). Address: ${input.logistics.departure.address || 'N/A'}.
    - Stay: ${input.logistics.accommodation.name} at ${input.logistics.accommodation.address}.

    IMPORTANT Requirements:
    1. You have access to Google Maps. Use it to verify the existence, location, and address of every place.
    2. Provide the 'googleMapsUrl' for every activity.
    3. Use Google Search to find a representative image URL ('imageUrl') for the activities if possible.
    4. Provide coordinates (approx lat/lng) for each location for map visualization.
    5. Include price details: is it free? Is there a student/senior discount? Provide a real booking link if possible.
    6. For 'transportToNext', use Google Maps to calculate routes to the NEXT activity.
       - If the activities are at the same location or within 50m, leave empty.
       - Otherwise, PROVIDE 3 OPTIONS separated by " | ":
         1. Walking (if under 2km)
         2. Public Transit (Metro/Bus)
         3. Taxi/Rideshare
       - Format: "Mode: Time (Cost)" 
       - Example: "Walk: 15m (Free) | Transit: 10m ($2.50) | Taxi: 5m ($12)"
    
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
  const model = "gemini-2.5-flash";

  const prompt = `
    Refine this itinerary based on the user's request: "${userRequest}".
    
    Current Itinerary (JSON):
    ${JSON.stringify(currentItinerary)}

    CONSTRAINTS:
    1. KEEP locked activities (isLocked=true) FIXED in time and place.
    2. Respect 'blocked' activities as unavailable time slots.
    3. Ensure activities marked as 'isMandatory=true' are included in the itinerary, though their time can change (unless locked).
    4. Use Google Maps to verify any new locations added and calculate travel times.
    5. Recalculate 'transportToNext' for any changed activities using the format "Mode: Time (Cost) | ...".
    6. Output the FULL updated itinerary as strict JSON (no markdown).
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
          act.selectedTransport = old.selectedTransport;
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

export const recalculateDaySchedule = async (activities: Activity[], previousLocation?: string): Promise<Activity[]> => {
  const model = "gemini-2.5-flash";
  
  const simplifiedActivities = activities.map(a => ({ 
    id: a.id, 
    title: a.title, 
    location: a.location, 
    durationMinutes: a.durationMinutes, 
    time: a.time,
    isLocked: a.isLocked,
    selectedTransport: a.selectedTransport
  }));

  const prompt = `
    The user has manually reordered the following activities for a day trip.
    
    Current Activities (in new order):
    ${JSON.stringify(simplifiedActivities)}

    Previous Location (Start of day): ${previousLocation || "Hotel/City Center"}

    TASK:
    1. Keep the sequence EXACTLY as provided.
    2. Use the Google Maps tool to calculate the REAL travel time and distance between each consecutive activity. 
    3. Recalculate the 'time' (HH:MM) for each activity sequentially.
       - If an activity is locked, build around it.
       - If 'selectedTransport' is present (e.g. "Walk: 20m"), use that duration.
    4. Update 'transportToNext' with 3 distinct options if applicable:
       - Format: "Walk: 15m (Free) | Transit: 10m ($2) | Taxi: 5m ($15)"
       - If same location, leave empty.
    
    Output a strictly valid JSON array of objects containing ONLY: { "id": "string", "time": "HH:MM", "transportToNext": "string" }.
    DO NOT output any conversational text.
  `;
  
  try {
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            tools: [{ googleMaps: {} }],
            systemInstruction: "You are a JSON-only API. You must strictly output valid JSON. Do not output any conversational text or explanations. If you cannot find a specific route, estimate it."
        }
    });
    
    const text = response.text;
    if (!text) return activities; // Fallback
    
    const jsonStr = cleanJson(text);
    const updates = JSON.parse(jsonStr) as { id: string, time: string, transportToNext: string }[];
    
    // Merge updates back into original activities
    return activities.map(act => {
        const update = updates.find(u => u.id === act.id);
        if (update) {
            return {
                ...act,
                time: update.time,
                transportToNext: update.transportToNext
            };
        }
        return act;
    });
  } catch (e) {
      console.error("Recalculation failed", e);
      return activities;
  }
}

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
   // Use gemini-2.5-flash which supports tools
   const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      history: history,
      config: {
          systemInstruction: "You are Cicerone, an intelligent travel assistant. You provide specific, actionable advice using Google Maps data when relevant. Keep responses concise and helpful.",
          tools: [{ googleMaps: {} }, { googleSearch: {} }]
      }
   });

   const result = await chat.sendMessage({ message });
   return result.text;
}