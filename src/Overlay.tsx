import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface SubtitleEvent {
    text: string;
}

export default function Overlay() {
    const [subtitles, setSubtitles] = useState<string[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Forza clickthrough completo del SO su questa finestra
    useEffect(() => {
        const unlisten = async () => {
            await getCurrentWindow().setIgnoreCursorEvents(true);
        };
        unlisten();

        // Ascolta gli eventi dal backend
        const setupListener = async () => {
            const release = await listen<SubtitleEvent>("new_subtitle", (event) => {
                setSubtitles((prev) => {
                    const updated = [...prev, event.payload.text];
                    // Manteniamo solo le ultime 3 frasi per evitare affollamento visivo (minimalismo)
                    return updated.slice(-3);
                });
            });
            return release;
        };

        let listenerPromise = setupListener();

        return () => {
            listenerPromise.then((release) => release());
        };
    }, []);

    // Auto-scroll all'ultima frase aggiunta (in UI Minimal non sempre serve scrolare violentemente se limitiamo a 3 righe, ma lo teniamo come safety constraint)
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [subtitles]);

    return (
        <div className="w-screen h-screen bg-transparent flex flex-col justify-end items-center pb-12 overflow-hidden selection:bg-transparent">
            <div
                ref={scrollRef}
                className="flex flex-col items-center gap-4 max-h-full overflow-y-hidden px-16 w-full max-w-5xl"
            >
                {subtitles.map((text, i) => {
                    // Calculate opacity and scale based on recency (last is newest)
                    const isLatest = i === subtitles.length - 1;
                    const isOlder = i === 0 && subtitles.length > 2;

                    return (
                        <div
                            key={i}
                            className={`transform transition-all duration-700 ease-out flex w-full justify-center
                ${isLatest ? "translate-y-0 opacity-100 scale-100 blur-none" : ""}
                ${!isLatest && !isOlder ? "translate-y-0 opacity-60 scale-95 blur-[0.5px]" : ""}
                ${isOlder ? "-translate-y-4 opacity-0 scale-90 blur-sm absolute" : ""}
              `}
                        >
                            <p
                                className="text-[44px] sm:text-[52px] font-black text-white text-center leading-[1.1] tracking-tight font-sans"
                                // Cinematic text shadow: multiple layers of black glow for perfect legibility on any background
                                style={{
                                    textShadow: '0px 4px 20px rgba(0,0,0,0.9), 0px 1px 3px rgba(0,0,0,1), 0px 0px 40px rgba(0,0,0,0.6)',
                                }}
                            >
                                {text}
                            </p>
                        </div>
                    );
                })}
                {subtitles.length === 0 && (
                    <div className="flex items-center gap-3 opacity-30 animate-pulse transition-opacity duration-1000 mt-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-white animation-delay-200"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-white animation-delay-400"></div>
                    </div>
                )}
            </div>
        </div>
    );
}
