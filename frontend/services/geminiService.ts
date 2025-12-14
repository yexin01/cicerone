/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from "@google/genai";
import { Itinerary, TripInput, WishlistItem, Activity } from '../../shared/types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  const model = "gemini-2.5-flash";
  
  const prompt = `
    Create a detailed travel itinerary for ${input.destination}.
    Duration: ${input.durationDays} days starting ${input.startDate}.
    Budget: ${input.budget}.
    Travelers: ${input.travelers}.
    Interests: ${input.interests.join(', ')}.
    Must-Visit Places: ${input.mustVisit || 'None'}.
    
    Logistics:
    - Arrival: ${input.logistics.arrival.type} at ${input.logistics.arrival.location} (${input.logistics.arrival.time}). Address: ${input.logistics.arrival.address || 'N/A'}.
    - Departure: ${input.logistics.departure.type} from ${input.logistics.departure.location} (${input.logistics.departure.time}). Address: ${input.logistics.departure.address || 'N/A'}.
    - Stay: ${input.logistics.accommodation.name} at ${input.logistics.accommodation.address}.

    Requirements:
    1. You have access to Google Maps. Use it to verify locations and addresses.
    2. Provide coordinates (approx lat/lng) for each location for map visualization.
    3. Include price details: is it free? Is there a student/senior discount? Provide a real booking link if possible.
    4. For 'transportToNext', provide 2-3 viable options to reach the NEXT activity in this specific format: "Mode: Duration (Cost) | Mode: Duration (Cost)". 
       Example: "Walk: 15m (Free) | Uber: 5m ($12) | Metro: 10m ($2)".
    5. For paid items, include the estimated cost.
    
    Output STRICTLY valid JSON (no markdown, no extra text) matching this structure:
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
              "coordinates": { "lat": number, "lng": number },
              "type": "food" | "culture" | "nature" | "transport" | "leisure" | "logistics" | "blocked" | "custom",
              "durationMinutes": number,
              "estimatedCost": number,
              "priceDetail": { "category": "free"|"paid", "amount": number, "currency": "string", "bookingLink": "string" },
              "isLocked": boolean,
              "transportToNext": "string",
              "googleMapsUrl": "string"
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
        // Using tools is incompatible with responseMimeType: 'application/json'
        // We rely on the prompt to enforce JSON
        tools: [{ googleMaps: {}, googleSearch: {} }],
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text from AI");
    
    // Attempt to parse
    let data: Itinerary;
    try {
        const jsonStr = cleanJson(text);
        data = JSON.parse(jsonStr) as Itinerary;
    } catch (parseError) {
        console.error("JSON Parse Error. Raw Text:", text);
        throw new Error("Failed to parse AI response");
    }
    
    // Client-side hydration - Persist Context
    data.logistics = input.logistics;
    data.wishlist = [];
    data.startDate = input.startDate;
    data.durationDays = input.durationDays;
    data.travelers = input.travelers;
    data.interests = input.interests;

    if (data.days) {
        data.days.forEach(day => {
        day.activities.forEach(act => {
            act.feedback = 'neutral';
            act.isLocked = act.isLocked || false;
            act.userNotes = '';
            if(!act.id) act.id = Math.random().toString(36).substr(2, 9);
        });
        });
    }
    
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
    4. Recalculate 'transportToNext' for changed segments using format: "Mode: Duration (Cost) | Mode: Duration (Cost)".
    5. Output the FULL updated itinerary JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleMaps: {}, googleSearch: {} }],
        // Rely on prompt for JSON
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const jsonStr = cleanJson(text);
    const data = JSON.parse(jsonStr) as Itinerary;
    
    // Merge state (feedback, locks, notes)
    const oldActivityMap = new Map<string, any>();
    currentItinerary.days.forEach(d => d.activities.forEach(a => oldActivityMap.set(a.id, a)));

    if(data.days) {
        data.days.forEach(day => {
        day.activities.forEach(act => {
            const old = oldActivityMap.get(act.id);
            if (old) {
            act.feedback = old.feedback;
            act.actualCost = old.actualCost;
            act.userNotes = old.userNotes;
            act.selectedTransport = old.selectedTransport;
            if (old.isLocked) Object.assign(act, old); 
            } else {
            act.feedback = 'neutral';
            act.isLocked = false;
            }
        });
        });
    }
    data.wishlist = currentItinerary.wishlist;
    data.logistics = currentItinerary.logistics;
    // Persist trip settings
    data.startDate = currentItinerary.startDate;
    data.durationDays = currentItinerary.durationDays;
    data.travelers = currentItinerary.travelers;
    data.interests = currentItinerary.interests;

    return data;
  } catch (error) {
    console.error("Refine error:", error);
    throw error;
  }
};

export const recalculateDaySchedule = async (activities: Activity[], previousLocation?: string): Promise<Activity[]> => {
  const model = "gemini-2.5-flash";

  const prompt = `
    Recalculate the schedule for this list of activities for a single day.
    The user has reordered them manually.
    
    Start Location for the day: ${previousLocation || 'City Center'}
    Start Time: Usually 09:00 or 10:00 unless an activity is locked earlier.

    Activities (in desired order):
    ${JSON.stringify(activities.map(a => ({
        id: a.id,
        title: a.title,
        location: a.location,
        durationMinutes: a.durationMinutes,
        isLocked: a.isLocked,
        time: a.time
    })))}

    Tasks:
    1. Calculate realistic start times ('time') for each activity sequentially.
    2. Account for travel time between the previous location (or start location) and the current activity.
    3. Respect 'isLocked' activities.
    4. Generate a 'transportToNext' string for each activity detailing how to get to the *next* activity.
       Format: "Mode: Duration (Cost) | Mode: Duration (Cost)". 
       Example: "Walk: 15m (Free) | Uber: 5m ($12) | Metro: 10m ($2)".
       Use "End of Day" for the last activity.

    Output strictly valid JSON array of activities.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const jsonStr = cleanJson(text);
    const updatedActivities = JSON.parse(jsonStr) as Activity[];

    return activities.map(original => {
        const updated = updatedActivities.find(u => u.id === original.id);
        if (updated) {
            return {
                ...original,
                time: updated.time,
                transportToNext: updated.transportToNext
            };
        }
        return original;
    });

  } catch (error) {
    console.error("Recalculate error:", error);
    return activities;
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
            tools: [{ googleSearch: {} }] 
        }
    });

    const text = response.text;
    let analysis = { possibleName: "Unknown Spot", summary: "Could not analyze", tags: [] };
    
    try {
        analysis = JSON.parse(cleanJson(text));
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
          systemInstruction: "You are Cicerone. Be helpful, technical, and concise.",
          tools: [{ googleMaps: {} }, { googleSearch: {} }]
      }
   });

   const result = await chat.sendMessage({ message });
   return result.text;
}