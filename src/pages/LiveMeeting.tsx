import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";

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
        let isMounted = true;
        let unlistenAudio: (() => void) | undefined;
        let unlistenText: (() => void) | undefined;

        if (isListening) {
            const setupListeners = async () => {
                const ua = await listen<AudioLevelPayload>("audio_level", (event) => {
                    if (isMounted) setAudioLevel(Math.min(100, event.payload.rms * 15000));
                });

                const ut = await listen<SubtitlePayload>("new_subtitle", (event) => {
                    if (isMounted) {
                        setTranscripts(prev => [...prev, event.payload.text as string]);
                        // Auto-scroll in giù
                        setTimeout(() => {
                            if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                    }
                });

                // Se il componente è stato smontato mentre aspettavamo la promise, distruggi i listener appena creati.
                if (!isMounted) {
                    ua();
                    ut();
                } else {
                    unlistenAudio = ua;
                    unlistenText = ut;
                }
            };
            setupListeners();
        } else {
            setAudioLevel(0);
        }

        return () => {
            isMounted = false;
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
        <div className="flex-1 flex flex-col h-screen bg-black p-4 md:p-12 space-y-12">

            {/* Header & Configuration */}
            <header className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 md:gap-0">
                <div className="space-y-2 w-full md:w-auto">
                    <Input
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        placeholder="Untitled Session."
                        className="text-4xl md:text-6xl font-black bg-transparent border-none outline-none shadow-none text-white p-0 h-auto placeholder:text-zinc-800 focus-visible:ring-0 tracking-tighter"
                    />
                    <div className="h-[1px] w-12 bg-zinc-800 my-4" />
                    <p className="text-zinc-600 font-mono text-[10px] uppercase tracking-[0.2em]">{isListening ? "Listening..." : "Idle."}</p>
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-6 items-end">
                    <div className="flex flex-col gap-2 w-[160px] group">
                        <Label className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 transition-colors flex items-center gap-2">API Key</Label>
                        <Input
                            type="password"
                            placeholder="sk-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            disabled={isListening || loading}
                            className="h-auto py-2 text-xs bg-transparent border-b border-zinc-800 rounded-none px-0 text-white placeholder:text-zinc-800 focus-visible:ring-0 focus-visible:border-white transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-2 w-[100px] group">
                        <Label className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 transition-colors">Language</Label>
                        <Select value={targetLang} onValueChange={setTargetLang} disabled={isListening || loading}>
                            <SelectTrigger className="h-auto py-2 text-xs bg-transparent border-b border-zinc-800 rounded-none px-0 text-white focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:border-white transition-colors">
                                <SelectValue placeholder="Lang" />
                            </SelectTrigger>
                            <SelectContent className="bg-black border-zinc-800 text-white rounded-none">
                                <SelectItem value="English" className="focus:bg-zinc-900">English</SelectItem>
                                <SelectItem value="Italiano" className="focus:bg-zinc-900">Italiano</SelectItem>
                                <SelectItem value="Español" className="focus:bg-zinc-900">Español</SelectItem>
                                <SelectItem value="Français" className="focus:bg-zinc-900">Français</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-2 w-[110px] group">
                        <Label className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 transition-colors">Source</Label>
                        <Select value={audioSource} onValueChange={setAudioSource} disabled={isListening || loading}>
                            <SelectTrigger className="h-auto py-2 text-xs bg-transparent border-b border-zinc-800 rounded-none px-0 text-white focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:border-white transition-colors">
                                <SelectValue placeholder="Source" />
                            </SelectTrigger>
                            <SelectContent className="bg-black border-zinc-800 text-white rounded-none">
                                <SelectItem value="mic" className="focus:bg-zinc-900">
                                    <div className="flex items-center gap-2 tracking-widest uppercase text-[10px]">Mic</div>
                                </SelectItem>
                                <SelectItem value="output" className="focus:bg-zinc-900">
                                    <div className="flex items-center gap-2 tracking-widest uppercase text-[10px]">System</div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="ml-4">
                        {!isListening ? (
                            <Button
                                onClick={handleStart}
                                disabled={loading || !apiKey}
                                className="bg-white text-black hover:bg-zinc-200 font-bold rounded-none h-10 px-8 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 uppercase tracking-widest text-[10px]"
                            >
                                Record
                            </Button>
                        ) : (
                            <Button
                                onClick={handleStopAndSave}
                                className="bg-red-600 text-white hover:bg-red-500 font-bold rounded-none h-10 px-8 transition-transform hover:scale-105 active:scale-95 uppercase tracking-widest text-[10px]"
                            >
                                Save
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            {errorMsg && <div className="text-xs uppercase tracking-widest text-red-500 font-medium">{errorMsg}</div>}

            {/* Notion-style Notetaker Sheet -> Minimalist Canvas */}
            <div className="flex-1 overflow-hidden flex flex-col relative">

                {isListening && (
                    <div className="absolute top-0 right-0 z-50 flex items-center gap-6">
                        <button
                            onClick={handleCopyAll}
                            className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors flex items-center gap-2"
                        >
                            {copied ? <span className="text-white">Copied</span> : <span>Copy Live</span>}
                        </button>
                        <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest animate-pulse">Recording</span>
                        <div
                            className="w-2 h-2 rounded-full bg-red-500 transition-transform duration-75 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                            style={{ transform: `scale(${1 + audioLevel / 50})` }}
                        />
                    </div>
                )}

                {transcripts.length === 0 ? (
                    <div className="flex-1 flex flex-col justify-center text-zinc-800">
                        <p className="font-light text-2xl tracking-tight max-w-md">Hit Record to begin transcribing.</p>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 pr-6">
                        <div className="space-y-8 pb-20 max-w-3xl">
                            {transcripts.map((text, idx) => (
                                <div key={idx} className="group animate-in fade-in slide-in-from-bottom-2 duration-700">
                                    <div className="flex gap-6 items-start">
                                        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                            <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-700">{String(idx + 1).padStart(2, '0')}</span>
                                        </div>
                                        <p className="flex-1 text-2xl md:text-3xl text-zinc-300 leading-[1.4] font-medium tracking-tight">
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
