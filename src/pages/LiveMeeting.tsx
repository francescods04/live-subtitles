import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";
import { Play, Square, Settings, Maximize2, X, AlertCircle } from "lucide-react";

interface AudioLevelPayload {
    rms: number;
}
interface SubtitlePayload {
    text: String;
}

export function LiveMeeting() {
    const [apiKey, setApiKey] = useState("");
    const [spokenLang, setSpokenLang] = useState("Italian");
    const [targetLang, setTargetLang] = useState("English");
    const [transModel, setTransModel] = useState("llama-3.1-8b-instant");
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
        setSpokenLang(localStorage.getItem("spoken_lang") || "Italian");
        setTargetLang(localStorage.getItem("target_lang") || "English");
        setTransModel(localStorage.getItem("trans_model") || "llama-3.1-8b-instant");
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
            localStorage.setItem("spoken_lang", spokenLang);
            localStorage.setItem("target_lang", targetLang);
            localStorage.setItem("trans_model", transModel);
            localStorage.setItem("audio_source", audioSource);
            await invoke("start_listening", { apiKey, spokenLang, targetLang, transModel, source: audioSource });
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

            {/* JotMe Style Pill Header */}
            <div className="flex justify-center w-full z-50 mt-4 md:mt-8">
                <div className="bg-[#1C1C1E] border border-zinc-800 rounded-full flex items-center p-2 shadow-2xl relative">
                    {/* Record/Stop Button (Left aligned just as JotMe) */}
                    {!isListening ? (
                        <button
                            onClick={handleStart}
                            disabled={loading || !apiKey}
                            className="bg-blue-600 hover:bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
                        >
                            <Play className="w-5 h-5 ml-1" fill="currentColor" />
                        </button>
                    ) : (
                        <button
                            onClick={handleStopAndSave}
                            className="bg-zinc-800/80 hover:bg-zinc-700 text-red-500 w-10 h-10 rounded-full flex items-center justify-center transition-all border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)] group"
                        >
                            <Square className="w-4 h-4 group-hover:scale-95 transition-transform" fill="currentColor" />
                        </button>
                    )}

                    <div className="flex items-center gap-4 px-6 border-l border-zinc-800 ml-4">
                        {/* Spoken Language */}
                        <div className="flex flex-col items-center min-w-[120px]">
                            <span className="text-[10px] text-zinc-400 font-medium mb-1">Spoken Language</span>
                            <Select value={spokenLang} onValueChange={setSpokenLang} disabled={isListening || loading}>
                                <SelectTrigger className="h-7 w-[120px] bg-zinc-800/50 border border-zinc-700/50 rounded-full text-xs text-white focus:ring-0">
                                    <SelectValue placeholder="Spoken Lang" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1C1C1E] border-zinc-800 text-white rounded-xl shadow-2xl">
                                    <SelectItem value="Italian">Italian</SelectItem>
                                    <SelectItem value="English">English</SelectItem>
                                    <SelectItem value="Spanish">Spanish</SelectItem>
                                    <SelectItem value="French">French</SelectItem>
                                    <SelectItem value="German">German</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Arrows icon */}
                        <div className="flex items-center justify-center text-zinc-500 mx-2">
                            <span className="text-xl leading-none">»</span>
                        </div>

                        {/* Translation */}
                        <div className="flex flex-col items-center min-w-[140px]">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] text-zinc-400 font-medium">Translation</span>
                            </div>
                            <Select value={targetLang} onValueChange={setTargetLang} disabled={isListening || loading}>
                                <SelectTrigger className="h-7 w-[140px] bg-zinc-800/50 border border-zinc-700/50 rounded-full text-xs text-white focus:ring-0">
                                    <SelectValue placeholder="Target Lang" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1C1C1E] border-zinc-800 text-white rounded-xl shadow-2xl">
                                    <SelectItem value="English">English (UK)</SelectItem>
                                    <SelectItem value="Italian">Italian</SelectItem>
                                    <SelectItem value="Spanish">Spanish</SelectItem>
                                    <SelectItem value="French">French</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-4 border-l border-zinc-800 ml-2">
                        {/* Settings / Model / API Key */}
                        <div className="group relative">
                            <button className="w-8 h-8 rounded-full bg-zinc-800/50 border border-zinc-700 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                                <Settings className="w-4 h-4" />
                            </button>

                            {/* Basic Dropdown Simulation for Settings */}
                            <div className="absolute right-0 top-12 w-64 p-4 bg-[#1C1C1E] border border-zinc-800 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <Label className="uppercase tracking-[0.2em] text-[9px] text-zinc-500 flex items-center gap-1">
                                            API KEY
                                            {!apiKey && <AlertCircle className="w-3 h-3 text-red-500" />}
                                        </Label>
                                    </div>
                                    <Input
                                        type="password"
                                        placeholder="sk-..."
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        disabled={isListening || loading}
                                        className="h-8 text-xs bg-black/50 border border-zinc-800 rounded-lg text-white"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label className="uppercase tracking-[0.2em] text-[9px] text-zinc-500">Audio Source</Label>
                                    <Select value={audioSource} onValueChange={setAudioSource} disabled={isListening || loading}>
                                        <SelectTrigger className="h-8 text-xs bg-black/50 border border-zinc-800 rounded-lg text-white">
                                            <SelectValue placeholder="Source" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-black border-zinc-800 text-white rounded-lg">
                                            <SelectItem value="mic">Microphone</SelectItem>
                                            <SelectItem value="output">System Audio</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label className="uppercase tracking-[0.2em] text-[9px] text-zinc-500">Accuracy Model</Label>
                                    <Select value={transModel} onValueChange={setTransModel} disabled={isListening || loading}>
                                        <SelectTrigger className="h-8 text-xs bg-black/50 border border-zinc-800 rounded-lg text-white">
                                            <SelectValue placeholder="Model" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-black border-zinc-800 text-white rounded-lg">
                                            <SelectItem value="llama-3.1-8b-instant">Fast (8B)</SelectItem>
                                            <SelectItem value="llama-3.3-70b-versatile">Contextual (70B)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full flex justify-center">
                <Input
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="Untitled Session."
                    className="text-4xl md:text-5xl font-black bg-transparent border-none outline-none shadow-none text-center text-zinc-200 p-0 h-auto placeholder:text-zinc-800 focus-visible:ring-0 tracking-tighter"
                />
            </div>

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
