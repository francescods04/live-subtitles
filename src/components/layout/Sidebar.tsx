import { NavLink } from "react-router-dom";
import { Mic, Clock, HardDrive } from "lucide-react";

export function Sidebar() {
    return (
        <aside className="w-64 border-r border-zinc-800 bg-black flex flex-col h-screen">
            <div className="p-6">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                        <Mic size={16} className="text-white" />
                    </div>
                    LiveNotes <span className="text-indigo-400 font-light text-sm ml-1">AI</span>
                </h1>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm ${isActive
                            ? "bg-zinc-900 text-white shadow-inner"
                            : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                        }`
                    }
                >
                    <Mic size={18} />
                    New Meeting
                </NavLink>

                <NavLink
                    to="/history"
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm ${isActive
                            ? "bg-zinc-900 text-white shadow-inner"
                            : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                        }`
                    }
                >
                    <Clock size={18} />
                    History
                </NavLink>
            </nav>

            <div className="p-4 border-t border-zinc-800">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-zinc-500 bg-zinc-900/50 rounded-lg">
                    <HardDrive size={14} />
                    <span>Local Vault Encrypted</span>
                </div>
            </div>
        </aside>
    );
}
