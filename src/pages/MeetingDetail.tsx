import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ScrollArea } from "../components/ui/scroll-area";

interface Meeting {
    id: string;
    title: string;
    date: string;
    transcription: string;
    target_lang: string;
}

export function MeetingDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const loadMeeting = async () => {
            try {
                const data: Meeting[] = await invoke("get_meetings");
                const found = data.find(m => m.id === id);
                if (found) {
                    setMeeting(found);
                } else {
                    navigate("/history");
                }
            } catch (e) {
                console.error("Error loading meeting:", e);
            }
        };
        loadMeeting();
    }, [id, navigate]);

    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to delete this meeting permanently?")) {
            try {
                await invoke("delete_meeting", { id });
                navigate("/history");
            } catch (e) {
                console.error("Deletion failed:", e);
            }
        }
    };

    const handleCopy = () => {
        if (meeting) {
            navigator.clipboard.writeText(meeting.title + "\n\n" + meeting.transcription);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!meeting) return <div className="p-10 text-white font-mono">Loading decrypted vault...</div>;

    return (
        <div className="flex-1 flex flex-col h-screen bg-black p-4 md:p-12 space-y-12">

            <header className="flex items-start justify-between border-b border-zinc-900 pb-8">
                <div className="space-y-6">
                    <Link to="/history" className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 hover:text-white flex items-center gap-2 transition-colors">
                        <ArrowLeft size={12} /> BACK TO VAULT
                    </Link>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter">{meeting.title}</h2>
                    <div className="flex items-center gap-4 text-[9px] uppercase tracking-[0.2em] text-zinc-600">
                        <span>{new Date(meeting.date).toLocaleString()}</span>
                        <span className="text-white/40">{meeting.target_lang}</span>
                        <span>{meeting.id}</span>
                    </div>
                </div>

                <div className="flex gap-8 items-center pt-8">
                    <button
                        onClick={handleCopy}
                        className="text-[10px] uppercase tracking-[0.2em] text-white hover:text-zinc-400 transition-colors"
                    >
                        {copied ? "COPIED" : "COPY ALL"}
                    </button>
                    <button
                        onClick={handleDelete}
                        className="text-[10px] uppercase tracking-[0.2em] text-red-600 hover:text-red-400 transition-colors"
                    >
                        DELETE
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden flex flex-col relative pb-12">
                <ScrollArea className="flex-1 pr-6">
                    <div className="max-w-4xl py-4 space-y-8">
                        {meeting.transcription.split('\n\n').map((paragraph, index) => (
                            <p key={index} className="text-2xl md:text-3xl text-zinc-300 leading-[1.4] font-medium tracking-tight">
                                {paragraph}
                            </p>
                        ))}
                    </div>
                </ScrollArea>
            </div>

        </div>
    );
}
