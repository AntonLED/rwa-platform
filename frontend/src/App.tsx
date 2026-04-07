import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/shared/Header";
import Landing from "./components/Landing";
import InvestorDashboard from "./components/investor/InvestorDashboard";
import CreditorDashboard from "./components/creditor/CreditorDashboard";
import AdminDashboard from "./components/admin/AdminDashboard";

function AppLayout() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/investor/*" element={<InvestorDashboard />} />
        <Route path="/creditor/*" element={<CreditorDashboard />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
