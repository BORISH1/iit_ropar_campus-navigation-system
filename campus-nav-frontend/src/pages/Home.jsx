import { useState, useEffect } from 'react';
import { api } from '../api';
import { MapPin, Navigation, ArrowRight, Clock, Map as MapIcon, ExternalLink } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

// Clean, minimal map marker
const markerIcon = L.divIcon({
  html: `<div class="bg-indigo-600 w-4 h-4 rounded-full border-2 border-white shadow-md"></div>`,
  className: 'custom-marker',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

export default function Home() {
  const [locations, setLocations] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [routeData, setRouteData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Default center point
  const mapCenter = [30.968569, 76.473239];
  useEffect(() => {
    api.getLocations().then(setLocations).catch(console.error);
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!from || !to) return;
    setLoading(true);
    setError('');
    setRouteData(null);
    try {
      const data = await api.getRoute(from, to);
      setRouteData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Extract coordinates for the polyline path
  const pathPositions = routeData?.routes[0]?.steps
    .filter(s => s.location.y && s.location.x)
    .map(s => [s.location.y, s.location.x]) || [];

  return (
    <div className="max-w-6xl w-full mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Column: Search & Results */}
      <div className="space-y-6 lg:col-span-1 flex flex-col h-[calc(100vh-8rem)]">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex-shrink-0">
          <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <MapIcon className="w-6 h-6 text-indigo-500" /> Find Your Way
          </h1>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-emerald-500" /> Starting Point
              </label>
              <select 
                value={from} 
                onChange={(e) => setFrom(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Select location...</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-rose-500" /> Destination
              </label>
              <select 
                value={to} 
                onChange={(e) => setTo(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Select location...</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
              </select>
            </div>

            <button 
              type="submit" 
              disabled={loading || !from || !to}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? 'Calculating...' : <><Navigation className="w-5 h-5" /> Get Directions</>}
            </button>
          </form>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 flex-shrink-0">{error}</div>}

        {/* Route Details Panel */}
        {routeData && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-y-auto">
            <div className="p-4 bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-800">Shortest Route</h3>
                {routeData.to.indoor_link && (
                  <a href={routeData.to.indoor_link} target="_blank" rel="noreferrer" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors">
                    <ExternalLink className="w-3 h-3" /> Indoor Nav
                  </a>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600 font-medium">
                <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-indigo-500"/> {routeData.routes[0].walkingMinutes} min walking</span>
                <span>{routeData.routes[0].totalDist} meters</span>
              </div>
            </div>
            
            <div className="p-6">
              <div className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                {routeData.routes[0].steps.map((step, i, arr) => (
                  <div key={i} className="relative pl-6">
                    <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                      i === 0 ? 'bg-emerald-500' : i === arr.length - 1 ? 'bg-rose-500' : 'bg-slate-300'
                    }`}></span>
                    <div className="font-medium text-slate-800">{step.location.name}</div>
                    {step.via && <div className="text-sm text-slate-500 mt-1">Via: {step.via}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: OpenStreetMap */}
      <div className="lg:col-span-2 h-[500px] lg:h-[calc(100vh-8rem)] rounded-xl overflow-hidden border border-slate-200 shadow-sm z-0">
        <MapContainer center={mapCenter} zoom={16} className="w-full h-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Render all campus nodes */}
          {locations.map(loc => loc.y && loc.x && (
            <Marker key={loc.id} position={[loc.y, loc.x]} icon={markerIcon}>
              <Popup>
                <strong>{loc.name}</strong><br/>
                <span className="text-xs text-slate-500 uppercase">{loc.type}</span>
              </Popup>
            </Marker>
          ))}

          {/* Draw the shortest path */}
          {pathPositions.length > 0 && (
            <Polyline 
              positions={pathPositions} 
              pathOptions={{ color: '#4f46e5', weight: 5, opacity: 0.8 }} 
            />
          )}
        </MapContainer>
      </div>

    </div>
  );
}