import { HashRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import MerchantDashboard from './pages/MerchantDashboard';
import Storefront from './pages/Storefront';
import CustomerProfile from './pages/CustomerProfile';
import LPDashboard from './pages/LPDashboard';

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-navy-900">
        <Navbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/merchant" element={<MerchantDashboard />} />
          <Route path="/store/:address" element={<Storefront />} />
          <Route path="/profile" element={<CustomerProfile />} />
          <Route path="/lp" element={<LPDashboard />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
