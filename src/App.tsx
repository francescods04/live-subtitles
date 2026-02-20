import { Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { LiveMeeting } from "./pages/LiveMeeting";
import { History } from "./pages/History";
import { MeetingDetail } from "./pages/MeetingDetail";
import "./App.css";

function App() {
  return (
    <div className="app-root flex h-screen w-full overflow-hidden bg-black text-white selection:bg-indigo-500/30 font-sans antialiased">
      <Sidebar />
      <main className="flex-1 relative">
        {/* Ambient background glows for the entire dashboard */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-600/10 rounded-full blur-[100px] pointer-events-none z-0" />

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
