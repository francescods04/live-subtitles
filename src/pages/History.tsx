import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Link } from "react-router-dom";

import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";

interface Meeting {
    id: string;
    title: string;
    date: string;
    transcription: string;
    target_lang: string;
}

export function History() {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [search, setSearch] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        const loadMeetings = async () => {
            try {
                const data: Meeting[] = await invoke("get_meetings");
                // Ordina dal più recente
                data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setMeetings(data);
            } catch (e) {
                console.error("Failed to load meetings", e);
            }
        };
        loadMeetings();
    }, []);

    const handleCopy = (e: React.MouseEvent, m: Meeting) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(m.transcription);
        setCopiedId(m.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filtered = meetings.filter(
        (m) =>
            m.title.toLowerCase().includes(search.toLowerCase()) ||
            m.transcription.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex-1 flex flex-col h-screen bg-black p-4 md:p-12 space-y-12">
            <header className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 md:gap-0">
                <div>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter">Vault.</h2>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mt-4">Local encrypted history.</p>
                </div>
                <div className="relative w-full md:w-[300px]">
                    <Input
                        placeholder="Search Archive..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-auto py-2 bg-transparent border-0 border-b border-zinc-800 focus-visible:ring-0 focus-visible:border-white text-xs rounded-none px-0 tracking-widest placeholder:text-zinc-800 transition-colors"
                    />
                </div>
            </header>

            <div className="flex-1 overflow-hidden flex flex-col">
                {meetings.length === 0 ? (
                    <div className="flex-1 flex flex-col justify-center text-zinc-800">
                        <p className="font-light text-2xl tracking-tight max-w-md">No records found.</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] mt-4 opacity-50">Saved meetings will appear here.</p>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 pr-4">
                        <div className="flex flex-col border-t border-zinc-900">
                            {filtered.map((m) => (
                                <Link
                                    key={m.id}
                                    to={`/history/${m.id}`}
                                    className="flex flex-col md:flex-row md:items-center justify-between py-6 border-b border-zinc-900 hover:bg-zinc-900/20 transition-colors group px-2 gap-4"
                                >
                                    <div className="flex-1">
                                        <h3 className="text-white font-bold text-xl md:text-2xl tracking-tight group-hover:translate-x-2 transition-transform duration-500">{m.title}</h3>
                                        <div className="flex flex-wrap items-center gap-4 text-[9px] uppercase tracking-[0.2em] text-zinc-600 mt-2">
                                            <span>{new Date(m.date).toLocaleDateString()}</span>
                                            <span className="text-white/40">{m.target_lang}</span>
                                            <span>{m.transcription.split(" ").length} w</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <button
                                            onClick={(e) => handleCopy(e, m)}
                                            className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 hover:text-white transition-colors"
                                        >
                                            {copiedId === m.id ? "Copied" : "Copy"}
                                        </button>
                                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:translate-x-1">
                                            <span className="text-[10px] uppercase tracking-[0.2em] text-white">Read</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            {filtered.length === 0 && search && (
                                <p className="text-zinc-600 text-[10px] uppercase tracking-[0.2em] py-10 px-2">No results for "{search}"</p>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    );
}
