import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Link } from "react-router-dom";
import { Clock, FileText, ChevronRight, Search, Copy, Check } from "lucide-react";
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
        <div className="flex-1 flex flex-col h-screen bg-zinc-950 p-8 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">Meeting History</h2>
                    <p className="text-sm text-zinc-500 mt-1 font-medium">All your live translated sessions stored securely on disk.</p>
                </div>
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <Input
                        placeholder="Search transcripts..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 h-10 bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700 text-sm rounded-xl"
                    />
                </div>
            </header>

            <div className="flex-1 bg-zinc-900/40 rounded-3xl border border-zinc-800/50 p-6 shadow-inner overflow-hidden flex flex-col">
                {meetings.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 space-y-4">
                        <Clock size={48} className="opacity-20" />
                        <p className="font-medium text-xl opacity-40">No past meetings found.</p>
                        <p className="text-sm opacity-30 text-center max-w-sm">When you record a Live Meeting, it will be automatically saved here indefinitely.</p>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 pr-4">
                        <div className="grid grid-cols-1 gap-3">
                            {filtered.map((m) => (
                                <Link
                                    key={m.id}
                                    to={`/history/${m.id}`}
                                    className="flex items-center justify-between p-4 rounded-2xl bg-black border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                            <FileText size={16} className="text-indigo-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-semibold text-base">{m.title}</h3>
                                            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1 font-mono">
                                                <span>{new Date(m.date).toLocaleString()}</span>
                                                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                                                <span className="uppercase text-indigo-400/80">{m.target_lang}</span>
                                                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                                                <span>{m.transcription.split(" ").length} words</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => handleCopy(e, m)}
                                            className="w-8 h-8 rounded-full bg-zinc-800/50 hover:bg-zinc-700 flex items-center justify-center transition-colors text-zinc-400 hover:text-white"
                                            title="Copy transcription"
                                        >
                                            {copiedId === m.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                        </button>
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ChevronRight size={16} className="text-white" />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            {filtered.length === 0 && search && (
                                <p className="text-center text-zinc-500 py-10">No results found for "{search}"</p>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    );
}
