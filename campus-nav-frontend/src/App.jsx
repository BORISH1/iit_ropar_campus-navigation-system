import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import { Map, ShieldAlert } from 'lucide-react';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col font-sans bg-slate-50">
        
        {/* Global Navigation Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
            <Map className="w-6 h-6" />
            <span>CampusNav</span>
          </Link>
          
          <Link to="/admin" className="text-sm font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition-colors">
            <ShieldAlert className="w-4 h-4" /> 
            <span>Admin</span>
          </Link>
        </header>
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative w-full">
          <Routes>
            {/* Public Navigation Interface */}
            <Route path="/" element={<Home />} />
            
            {/* Secure Admin Dashboard */}
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  );
}

export default App;