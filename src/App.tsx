import { Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { LiveMeeting } from "./pages/LiveMeeting";
import { History } from "./pages/History";
import { MeetingDetail } from "./pages/MeetingDetail";
import "./App.css";

function App() {
  return (
    <div className="app-root flex h-screen w-full overflow-hidden bg-black text-white font-sans antialiased">
      <Sidebar />
      <main className="flex-1 relative bg-black">
        <div className="relative z-10 h-full w-full">
          <Routes>
            <Route path="/" element={<LiveMeeting />} />
            <Route path="history" element={<History />} />
            <Route path="history/:id" element={<MeetingDetail />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
