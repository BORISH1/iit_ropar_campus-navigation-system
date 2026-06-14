import { useState, useEffect } from 'react';
import { api } from '../api';
import { Lock, Route, MapPin, X, Trash2, CheckCircle2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Icon for generic road waypoints (small dot)
const waypointIcon = L.divIcon({
  html: `<div class="bg-slate-400 w-3 h-3 rounded-full border border-white shadow-sm"></div>`,
  className: 'custom-marker',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

// Icon for named locations (bigger, colored pin)
const locationIcon = L.divIcon({
  html: `<div class="bg-indigo-600 w-4 h-4 rounded-full border-2 border-white shadow-md"></div>`,
  className: 'custom-marker',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('adminAuth'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [locations, setLocations] = useState([]);
  const [edges, setEdges] = useState([]);

  // UX Modes: 'draw' | 'edit'
  const [mode, setMode] = useState('draw'); 
  
  // Drawing State
  const [activeNode, setActiveNode] = useState(null); // The last clicked/created node to connect from
  
  // Editing State
  const [selectedNode, setSelectedNode] = useState(null); // Node selected to be renamed

  const mapCenter = [30.968569, 76.473239];

  const fetchData = async () => {
    try {
      const [l, e] = await Promise.all([api.getLocations(), api.getEdges()]);
      setLocations(l);
      setEdges(e);
    } catch (err) {
      if (err.message.includes('401')) handleLogout();
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await api.login(username, password);
      setIsAuthenticated(true);
    } catch (err) {
      alert('Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    setIsAuthenticated(false);
  };

  // -- MAP INTERACTION LOGIC --

  const MapInteractionHandler = () => {
    useMapEvents({
      click: async (e) => {
        if (mode !== 'draw') return;

        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        // 1. Create a generic waypoint node at the click location
        const newNode = await api.createLocation({
          name: `Waypoint_${Math.floor(Math.random() * 10000)}`, // Hidden temporary name
          type: 'path',
          x: lng,
          y: lat
        });

        // 2. If we are continuing a path, create an edge to the previous node
        if (activeNode) {
          const distance = Math.round(L.latLng(lat, lng).distanceTo(L.latLng(activeNode.y, activeNode.x)));
          await api.createEdge({
            from_id: activeNode.id,
            to_id: newNode.id,
            distance: distance,
            bidirectional: 1,
            label: 'Road'
          });
        }

        // 3. Set this new node as the active node for the next click
        setActiveNode(newNode);
        fetchData();
      }
    });
    return null;
  };

  const handleMarkerClick = async (node) => {
    if (mode === 'draw') {
      // Branching: Connect the active path to an existing node
      if (activeNode && activeNode.id !== node.id) {
        const distance = Math.round(L.latLng(node.y, node.x).distanceTo(L.latLng(activeNode.y, activeNode.x)));
        await api.createEdge({
          from_id: activeNode.id,
          to_id: node.id,
          distance: distance,
          bidirectional: 1,
          label: 'Road'
        });
        fetchData();
      }
      // Set the clicked node as the new starting point for drawing
      setActiveNode(node);
    } else if (mode === 'edit') {
      // Select the node to edit its name/type in the sidebar
      setSelectedNode(node);
    }
  };

  // -- FORM HANDLERS --

  const handleUpdateLocation = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Keep coordinates the same
    data.x = selectedNode.x;
    data.y = selectedNode.y;

    await api.updateLocation(selectedNode.id, data);
    setSelectedNode(null);
    fetchData();
  };

  const delLocation = async (id) => {
    if (!confirm('Delete this location and all connected paths?')) return;
    await api.deleteLocation(id);
    if (selectedNode?.id === id) setSelectedNode(null);
    if (activeNode?.id === id) setActiveNode(null);
    fetchData();
  };

  // -- RENDER HELPERS --

  const locationTypes = ['building', 'block', 'hostel', 'cafeteria', 'department', 'landmark', 'road', 'path'];

  const mapWays = edges.map(edge => {
    const fromLoc = locations.find(l => l.id === edge.from_id);
    const toLoc = locations.find(l => l.id === edge.to_id);
    if (fromLoc?.y && fromLoc?.x && toLoc?.y && toLoc?.x) {
      return { id: edge.id, positions: [[fromLoc.y, fromLoc.x], [toLoc.y, toLoc.x]] };
    }
    return null;
  }).filter(Boolean);

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full max-w-sm">
          <div className="flex justify-center mb-6"><Lock className="w-10 h-10 text-slate-400" /></div>
          <h2 className="text-xl font-bold text-center mb-6">Admin Login</h2>
          <div className="space-y-4">
            <input type="text" placeholder="Username" required value={username} onChange={e => setUsername(e.target.value)} className="w-full p-2 border rounded-lg" />
            <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded-lg" />
            <button type="submit" className="w-full bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 transition">Login</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] w-full">
      
      {/* Left Sidebar Control Panel */}
      <div className="w-full lg:w-96 bg-white border-r border-slate-200 p-6 flex flex-col shadow-lg z-10 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold">Map Builder</h1>
          <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-800">Logout</button>
        </div>

        {/* Mode Toggle Switch */}
        <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
          <button 
            onClick={() => { setMode('draw'); setSelectedNode(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md flex justify-center items-center gap-2 transition-all ${mode === 'draw' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Route className="w-4 h-4"/> 1. Draw Roads
          </button>
          <button 
            onClick={() => { setMode('edit'); setActiveNode(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md flex justify-center items-center gap-2 transition-all ${mode === 'edit' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <MapPin className="w-4 h-4"/> 2. Name Places
          </button>
        </div>

        {/* --- DRAW MODE CONTROLS --- */}
        {mode === 'draw' && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg text-sm text-indigo-800 space-y-2">
              <p><strong>Instructions:</strong></p>
              <ul className="list-disc pl-4 space-y-1 text-indigo-700">
                <li>Click anywhere on the map to draw a road.</li>
                <li>Keep clicking to draw a continuous path.</li>
                <li>Click an existing dot to connect to it.</li>
              </ul>
            </div>

            {activeNode ? (
              <div className="bg-white border border-slate-200 p-4 rounded-lg">
                <p className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Drawing active path...
                </p>
                <button 
                  onClick={() => setActiveNode(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-2 rounded-lg text-sm font-medium flex justify-center items-center gap-2"
                >
                  <X className="w-4 h-4"/> End Current Road
                </button>
              </div>
            ) : (
              <div className="text-center p-4 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg text-sm">
                Waiting for map click...
              </div>
            )}
          </div>
        )}

        {/* --- EDIT MODE CONTROLS --- */}
        {mode === 'edit' && (
          <div className="space-y-4">
            {!selectedNode ? (
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg text-sm text-emerald-800">
                <strong>Instructions:</strong> Click any point on the map to convert it into a named location (Block, Mess, etc.).
              </div>
            ) : (
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800">Edit Location</h3>
                  <button onClick={() => delLocation(selectedNode.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition" title="Delete Location">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
                
                <form onSubmit={handleUpdateLocation} className="space-y-3">
                  <input 
                    name="name" 
                    defaultValue={selectedNode.name.includes('Waypoint') ? '' : selectedNode.name} 
                    placeholder="E.g., Block A, Main Cafeteria" 
                    required 
                    className="w-full p-2.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                  
                  <select 
                    name="type" 
                    defaultValue={selectedNode.type}
                    required 
                    className="w-full p-2.5 text-sm border rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500 capitalize"
                  >
                    {locationTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  
                  <input 
                    name="indoor_link" 
                    defaultValue={selectedNode.indoor_link || ''}
                    placeholder="Indoor Map Link (Optional)" 
                    className="w-full p-2.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                  
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-lg text-sm font-medium flex justify-center items-center gap-2 transition-colors">
                    <CheckCircle2 className="w-4 h-4"/> Update Location
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Right Map Area */}
      <div className="flex-1 relative z-0">
        <MapContainer 
          center={mapCenter} 
          zoom={16} 
          doubleClickZoom={false} // Prevent accidental zooming while drawing rapidly
          className={`w-full h-full ${mode === 'draw' ? 'cursor-crosshair' : 'cursor-pointer'}`}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapInteractionHandler />

          {/* Render All Edges */}
          {mapWays.map(way => (
            <Polyline 
              key={way.id} 
              positions={way.positions} 
              pathOptions={{ color: '#6366f1', weight: 4, opacity: 0.8 }} // Indigo-500
            />
          ))}

          {/* Render All Nodes */}
          {locations.map(loc => {
            if (!loc.y || !loc.x) return null;
            // Distinguish between pure waypoints and actual named locations
            const isNamed = loc.type !== 'path' && !loc.name.startsWith('Waypoint');
            const isActive = activeNode?.id === loc.id;
            const isSelected = selectedNode?.id === loc.id;

            return (
              <Marker 
                key={loc.id} 
                position={[loc.y, loc.x]} 
                icon={isNamed ? locationIcon : waypointIcon}
                eventHandlers={{ click: () => handleMarkerClick(loc) }}
                opacity={isActive || isSelected ? 0.5 : 1} // Visual feedback when selected
                zIndexOffset={isNamed ? 100 : 0} // Keep named pins above paths
              >
                {/* Only show popups on hover, don't interfere with clicking logic */}
                {isNamed && mode === 'draw' && (
                  <Popup><strong>{loc.name}</strong><br/>{loc.type}</Popup>
                )}
              </Marker>
            );
          })}
        </MapContainer>
      </div>

    </div>
  );
}