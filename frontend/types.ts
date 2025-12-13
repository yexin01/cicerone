/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface TripLogistics {
  arrival: {
    type: 'flight' | 'train' | 'car' | 'bus';
    location: string; // Airport/Station code or City
    time: string;
    address?: string; // For car/bus
  };
  departure: {
    type: 'flight' | 'train' | 'car' | 'bus';
    location: string;
    time: string;
    address?: string;
  };
  accommodation: {
    name: string;
    address: string;
    coordinates?: { lat: number; lng: number };
  };
}

export interface PriceDetail {
  category: 'free' | 'paid' | 'partial_free';
  amount?: number;
  currency?: string;
  bookingLink?: string;
  description?: string; // e.g. "Free on Sundays", "Students 50% off"
}

export interface Activity {
  id: string;
  time: string;
  title: string;
  description: string;
  location: string;
  type: 'food' | 'culture' | 'nature' | 'transport' | 'leisure' | 'logistics' | 'blocked' | 'custom';
  durationMinutes: number;
  estimatedCost: number;
  priceDetail?: PriceDetail;
  actualCost?: number; 
  isLocked: boolean;
  isMandatory?: boolean;
  feedback: 'neutral' | 'like' | 'dislike';
  coordinates?: { lat: number; lng: number };
  transportToNext?: string;
  selectedTransport?: string;
  userNotes?: string;
  googleMapsUrl?: string;
  imageUrl?: string;
}

export interface DayPlan {
  date: string;
  dayNumber: number;
  activities: Activity[];
}

export interface WishlistItem {
  id: string;
  content: string; // URL or Text
  type: 'url' | 'text';
  analysis?: {
    possibleName: string;
    summary: string;
    tags: string[];
  };
}

export interface Itinerary {
  id: string;
  destination: string;
  title: string;
  totalBudget: number;
  currency: string;
  days: DayPlan[];
  logistics: TripLogistics;
  wishlist: WishlistItem[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isSystem?: boolean;
}

export interface TripInput {
  destination: string;
  startDate: string;
  durationDays: number;
  budget: string;
  travelers: number;
  interests: string[];
  mustVisit?: string;
  logistics: TripLogistics;
}

export interface Artist {
  name: string;
  image: string;
  day: string;
  genre: string;
}