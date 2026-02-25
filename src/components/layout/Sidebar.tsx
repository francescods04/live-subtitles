import { NavLink } from "react-router-dom";
import { Mic, Clock, HardDrive } from "lucide-react";

export function Sidebar() {
    return (
        <aside className="w-16 md:w-48 flex flex-col h-screen bg-black justify-between py-12 px-4 md:px-8 shrink-0">
            <div className="space-y-16">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter w-full text-center md:text-left select-none">
                    LN<span className="text-zinc-700">.</span>
                </h1>

                <nav className="flex flex-col gap-8 w-full items-center md:items-start">
                    <NavLink
                        to="/"
                        className={({ isActive }) =>
                            `flex items-center gap-4 transition-all duration-500 font-bold group ${isActive
                                ? "text-white opacity-100 translate-x-1"
                                : "text-zinc-600 hover:text-white hover:opacity-100 hover:translate-x-1"
                            }`
                        }
                    >
                        <Mic size={18} className="transition-transform duration-500 group-hover:scale-110" />
                        <span className="hidden md:inline text-xs uppercase tracking-[0.2em]">Record</span>
                    </NavLink>

                    <NavLink
                        to="/history"
                        className={({ isActive }) =>
                            `flex items-center gap-4 transition-all duration-500 font-bold group ${isActive
                                ? "text-white opacity-100 translate-x-1"
                                : "text-zinc-600 hover:text-white hover:opacity-100 hover:translate-x-1"
                            }`
                        }
                    >
                        <Clock size={18} className="transition-transform duration-500 group-hover:scale-110" />
                        <span className="hidden md:inline text-xs uppercase tracking-[0.2em]">Vault</span>
                    </NavLink>
                </nav>
            </div>

            <div className="flex justify-center md:justify-start">
                <div className="opacity-20 hover:opacity-100 transition-opacity duration-500">
                    <HardDrive size={16} className="text-white" />
                </div>
            </div>
        </aside>
    );
}
