import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Trash2, Copy, FileText, CheckCircle } from "lucide-react";
import { Button } from "../components/ui/button";
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
        <div className="flex-1 flex flex-col h-screen bg-zinc-950 p-8 space-y-6">

            <header className="flex items-start justify-between">
                <div className="space-y-4">
                    <Link to="/history" className="text-zinc-500 hover:text-white flex items-center gap-1 text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> Back to History
                    </Link>
                    <h2 className="text-4xl font-extrabold text-white tracking-tight">{meeting.title}</h2>
                    <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                        <span>{new Date(meeting.date).toLocaleString()}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                        <span className="uppercase text-indigo-400">{meeting.target_lang}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                        <span>ID: {meeting.id}</span>
                    </div>
                </div>

                <div className="flex gap-4 items-center">
                    <Button
                        onClick={handleCopy}
                        variant="outline"
                        className="border-zinc-800 bg-black text-white hover:bg-zinc-900 rounded-xl px-4"
                    >
                        {copied ? <CheckCircle size={16} className="mr-2 text-green-400" /> : <Copy size={16} className="mr-2" />}
                        {copied ? "Copied" : "Copy All"}
                    </Button>
                    <Button
                        onClick={handleDelete}
                        variant="destructive"
                        className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-xl px-4"
                    >
                        <Trash2 size={16} className="mr-2" /> Delete
                    </Button>
                </div>
            </header>

            <div className="flex-1 bg-white rounded-3xl p-8 shadow-2xl overflow-hidden flex flex-col relative text-black">
                <ScrollArea className="flex-1 pr-6">
                    <div className="max-w-3xl mx-auto py-4">
                        <div className="flex items-center gap-3 mb-8 opacity-40">
                            <FileText size={24} />
                            <span className="font-mono text-sm tracking-widest uppercase font-bold">Encrypted Vault Transcription</span>
                        </div>

                        <div className="prose prose-zinc prose-lg max-w-none">
                            {meeting.transcription.split('\n\n').map((paragraph, index) => (
                                <p key={index} className="text-zinc-800 leading-relaxed font-serif text-lg tracking-wide mb-6">
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                    </div>
                </ScrollArea>
            </div>

        </div>
    );
}
