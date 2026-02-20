import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";
import { Mic, Activity, Settings, Save, Volume2, Copy, CheckCircle } from "lucide-react";

interface AudioLevelPayload {
    rms: number;
}
interface SubtitlePayload {
    text: String;
}

export function LiveMeeting() {
    const [apiKey, setApiKey] = useState("");
    const [targetLang, setTargetLang] = useState("English");
    const [meetingTitle, setMeetingTitle] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [audioLevel, setAudioLevel] = useState(0);
    const [transcripts, setTranscripts] = useState<string[]>([]);
    const [audioSource, setAudioSource] = useState("mic");
    const [copied, setCopied] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Carica dal localStorage al primo avvio
    useEffect(() => {
        setApiKey(localStorage.getItem("openai_api_key") || "");
        setTargetLang(localStorage.getItem("target_lang") || "English");
        setAudioSource(localStorage.getItem("audio_source") || "mic");
    }, []);

    // Ascolta gli eventi audio _e_ testo da Rust
    useEffect(() => {
        let unlistenAudio: (() => void) | undefined;
        let unlistenText: (() => void) | undefined;

        if (isListening) {
            const setupListeners = async () => {
                unlistenAudio = await listen<AudioLevelPayload>("audio_level", (event) => {
                    setAudioLevel(Math.min(100, event.payload.rms * 15000));
                });

                unlistenText = await listen<SubtitlePayload>("new_subtitle", (event) => {
                    setTranscripts(prev => [...prev, event.payload.text as string]);
                    // Auto-scroll in giù
                    setTimeout(() => {
                        if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                });
            };
            setupListeners();
        } else {
            setAudioLevel(0);
        }

        return () => {
            if (unlistenAudio) unlistenAudio();
            if (unlistenText) unlistenText();
        };
    }, [isListening]);

    const handleStart = async () => {
        if (!apiKey || apiKey.length < 20) {
            setErrorMsg("Please enter a valid OpenAI API Key.");
            return;
        }

        setErrorMsg("");
        setLoading(true);

        try {
            localStorage.setItem("openai_api_key", apiKey);
            localStorage.setItem("target_lang", targetLang);
            localStorage.setItem("audio_source", audioSource);
            await invoke("start_listening", { apiKey, targetLang, source: audioSource });
            setIsListening(true);
        } catch (err: any) {
            setErrorMsg(err.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleCopyAll = () => {
        if (transcripts.length > 0) {
            navigator.clipboard.writeText(transcripts.join("\n\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleStopAndSave = async () => {
        try {
            await invoke("stop_listening");
            setIsListening(false);

            if (transcripts.length > 0) {
                const finalTitle = meetingTitle.trim() === "" ? "Untitled Meeting" : meetingTitle;
                const newMeeting = {
                    id: Date.now().toString(),
                    title: finalTitle,
                    date: new Date().toISOString(),
                    transcription: transcripts.join("\n\n"),
                    target_lang: targetLang
                };

                await invoke("save_meeting", { meeting: newMeeting });
                // Ripulisci il foglio
                setTranscripts([]);
                setMeetingTitle("");
                setErrorMsg("Meeting Successfully Saved to Local Vault.");
            }
        } catch (err: any) {
            console.error(err);
            setErrorMsg(err.toString());
        }
    };

    return (
        <div className="flex-1 flex flex-col h-screen bg-zinc-950 p-8 space-y-6">

            {/* Header & Configuration */}
            <header className="flex items-start justify-between">
                <div className="space-y-1">
                    <Input
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        placeholder="Meeting Title..."
                        className="text-4xl font-extrabold bg-transparent border-none outline-none shadow-none text-white p-0 h-auto placeholder:text-zinc-700/50 focus-visible:ring-0"
                    />
                    <p className="text-zinc-500 font-mono text-xs">Waiting for audio stream...</p>
                </div>

                <div className="flex gap-4 items-center bg-black border border-zinc-800 p-2 pl-4 rounded-2xl shadow-xl">
                    <div className="flex flex-col gap-1 w-[180px]">
                        <Label className="text-[10px] uppercase text-zinc-500 flex items-center gap-1"><Settings size={10} /> API Key</Label>
                        <Input
                            type="password"
                            placeholder="sk-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            disabled={isListening || loading}
                            className="h-8 text-xs bg-zinc-900 border-zinc-800"
                        />
                    </div>
                    <div className="flex flex-col gap-1 w-[120px]">
                        <Label className="text-[10px] uppercase text-zinc-500">Target Lang</Label>
                        <Select value={targetLang} onValueChange={setTargetLang} disabled={isListening || loading}>
                            <SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-800">
                                <SelectValue placeholder="Lang" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                                <SelectItem value="English">English</SelectItem>
                                <SelectItem value="Italiano">Italiano</SelectItem>
                                <SelectItem value="Español">Español</SelectItem>
                                <SelectItem value="Français">Français</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1 w-[130px]">
                        <Label className="text-[10px] uppercase text-zinc-500">Audio Source</Label>
                        <Select value={audioSource} onValueChange={setAudioSource} disabled={isListening || loading}>
                            <SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-800">
                                <SelectValue placeholder="Source" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                                <SelectItem value="mic">
                                    <div className="flex items-center gap-2"><Mic size={12} /> Microphone</div>
                                </SelectItem>
                                <SelectItem value="output">
                                    <div className="flex items-center gap-2"><Volume2 size={12} /> System Audio</div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="mx-2 w-[1px] h-8 bg-zinc-800"></div>
                    {!isListening ? (
                        <Button
                            onClick={handleStart}
                            disabled={loading || !apiKey}
                            className="bg-white text-black hover:bg-zinc-300 font-bold rounded-xl h-10 px-6 transition-all"
                        >
                            <Mic size={16} className="mr-2" /> Start Live
                        </Button>
                    ) : (
                        <Button
                            onClick={handleStopAndSave}
                            className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold rounded-xl h-10 px-6 transition-all border border-red-500/20"
                        >
                            <Save size={16} className="mr-2" /> End & Save
                        </Button>
                    )}
                </div>
            </header>

            {errorMsg && <div className="text-sm font-medium text-amber-500">{errorMsg}</div>}

            {/* Notion-style Notetaker Sheet */}
            <div className="flex-1 bg-zinc-900/40 rounded-3xl border border-zinc-800/50 p-8 shadow-inner overflow-hidden flex flex-col relative">

                {isListening && (
                    <div className="absolute top-6 right-8 flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyAll}
                            className="h-7 text-[10px] uppercase tracking-wider text-zinc-400 hover:text-white bg-white/5 border border-white/10"
                        >
                            {copied ? <CheckCircle size={12} className="mr-1 text-green-400" /> : <Copy size={12} className="mr-1" />}
                            {copied ? "Copied" : "Copy Live"}
                        </Button>
                        <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest animate-pulse">Recording</span>
                        <div
                            className="p-1.5 rounded-full bg-red-500/20 text-red-400 transition-transform duration-75"
                            style={{ transform: `scale(${1 + audioLevel / 100})`, boxShadow: `0 0 ${audioLevel / 2}px rgba(239, 68, 68, 0.4)` }}
                        >
                            <Activity size={14} />
                        </div>
                    </div>
                )}

                {transcripts.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 space-y-4">
                        <Mic size={48} className="opacity-20" />
                        <p className="font-medium text-xl opacity-40">Press 'Start Live' to begin transcribing.</p>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 pr-6">
                        <div className="space-y-6 pb-20 max-w-4xl mx-auto">
                            {transcripts.map((text, idx) => (
                                <div key={idx} className="group animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div className="flex gap-4">
                                        <div className="w-12 text-right pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] font-mono text-zinc-600">Block {idx + 1}</span>
                                        </div>
                                        <p className="flex-1 text-lg text-zinc-300 leading-relaxed font-medium">
                                            {text}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={scrollRef} />
                        </div>
                    </ScrollArea>
                )}
            </div>

        </div>
    );
}
