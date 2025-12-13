/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Activity } from '../types';
import L from 'leaflet';

// Fix for default marker icon issues in React-Leaflet
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
  activities: Activity[];
  selectedActivityId?: string | null;
  onMarkerClick: (id: string) => void;
}

// Component to handle map center updates
const MapUpdater: React.FC<{ center: [number, number], zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
};

const MapComponent: React.FC<MapComponentProps> = ({ activities, selectedActivityId, onMarkerClick }) => {
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite' | 'transit'>('streets');

  // Filter activities with valid coordinates
  const markers = activities.filter(a => a.coordinates && a.coordinates.lat && a.coordinates.lng);
  
  const selectedMarker = markers.find(m => m.id === selectedActivityId);
  const center: [number, number] = selectedMarker && selectedMarker.coordinates
    ? [selectedMarker.coordinates.lat, selectedMarker.coordinates.lng]
    : markers.length > 0 && markers[0].coordinates
      ? [markers[0].coordinates.lat, markers[0].coordinates.lng]
      : [48.8566, 2.3522]; // Default Paris

  const zoom = selectedActivityId ? 15 : 12;

  const layers = {
    streets: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    transit: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
  };

  return (
    <div className="h-full w-full relative group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={layers[mapLayer]}
        />
        <MapUpdater center={center} zoom={zoom} />
        
        {markers.map(act => (
           <Marker 
             key={act.id} 
             position={[act.coordinates!.lat, act.coordinates!.lng]}
             eventHandlers={{
               click: () => onMarkerClick(act.id)
             }}
           >
             <Popup>
                <div className="font-sans">
                  <h3 className="font-bold text-sm">{act.title}</h3>
                  <p className="text-xs">{act.time}</p>
                </div>
             </Popup>
           </Marker>
        ))}
      </MapContainer>

      {/* Layer Control */}
      <div className="absolute top-4 right-4 z-[1000] bg-white dark:bg-zinc-900 p-1.5 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
         {(Object.keys(layers) as Array<keyof typeof layers>).map(layer => (
           <button
             key={layer}
             onClick={() => setMapLayer(layer)}
             className={`px-3 py-1 text-xs font-bold uppercase rounded-md transition-colors ${
               mapLayer === layer 
               ? 'bg-primary text-white' 
               : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
             }`}
           >
             {layer}
           </button>
         ))}
      </div>
    </div>
  );
};

export default MapComponent;
