import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/shared/Header";
import InvestorDashboard from "./components/investor/InvestorDashboard";
import CreditorDashboard from "./components/creditor/CreditorDashboard";
import AdminDashboard from "./components/admin/AdminDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
        <Header />
        <Routes>
          <Route path="/" element={<Navigate to="/investor" replace />} />
          <Route path="/investor/*" element={<InvestorDashboard />} />
          <Route path="/creditor" element={<CreditorDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/investor" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
