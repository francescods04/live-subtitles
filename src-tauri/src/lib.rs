use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound;
use reqwest::multipart;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use std::fs;
use std::path::PathBuf;

const SILENCE_THRESHOLD_RMS: f32 = 0.0001; // Lowered to catch quiet speakers

#[derive(Deserialize, Serialize, Clone)]
pub struct Meeting {
    pub id: String,
    pub title: String,
    pub date: String,
    pub transcription: String,
    pub target_lang: String,
}

// ----------------------
// Safe Temp File (RAII)
// ----------------------
struct SafeTempFile {
    pub path: PathBuf,
}

impl Drop for SafeTempFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

// ----------------------
// Backend Storage (JSON)
// ----------------------

fn get_meetings_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Impossibile trovare la cartella AppData: {}", e))?;
    
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Impossibile creare la cartella AppData: {}", e))?;
    }
    
    Ok(app_data_dir.join("meetings.json"))
}

#[tauri::command]
async fn get_meetings(app: AppHandle) -> Result<Vec<Meeting>, String> {
    let file_path = get_meetings_file_path(&app)?;
    
    if !file_path.exists() {
        return Ok(Vec::new());
    }

    let contents = fs::read_to_string(&file_path)
        .map_err(|e| format!("Errore di lettura meetings.json: {}", e))?;
        
    if contents.trim().is_empty() {
        return Ok(Vec::new());
    }

    let meetings: Vec<Meeting> = serde_json::from_str(&contents)
        .map_err(|e| format!("Errore di parsing meetings.json: {}", e))?;
        
    Ok(meetings)
}

#[tauri::command]
async fn save_meeting(meeting: Meeting, app: AppHandle) -> Result<(), String> {
    let file_path = get_meetings_file_path(&app)?;
    let mut meetings = get_meetings(app.clone()).await.unwrap_or_else(|_| Vec::new());
    
    // Se il meeting esiste già (stesso ID), aggiornalo. Altrimenti aggiungilo.
    if let Some(pos) = meetings.iter().position(|m| m.id == meeting.id) {
        meetings[pos] = meeting;
    } else {
        meetings.push(meeting);
    }
    
    let json_data = serde_json::to_string_pretty(&meetings)
        .map_err(|e| format!("Errore di serializzazione meeting: {}", e))?;
        
    fs::write(&file_path, json_data)
        .map_err(|e| format!("Errore di scrittura meetings.json: {}", e))?;
        
    Ok(())
}

#[tauri::command]
async fn delete_meeting(id: String, app: AppHandle) -> Result<(), String> {
    let file_path = get_meetings_file_path(&app)?;
    let mut meetings = get_meetings(app.clone()).await.unwrap_or_else(|_| Vec::new());
    
    meetings.retain(|m| m.id != id);
    
    let json_data = serde_json::to_string_pretty(&meetings)
        .map_err(|e| format!("Errore di serializzazione meeting: {}", e))?;
        
    fs::write(&file_path, json_data)
        .map_err(|e| format!("Errore di scrittura meetings.json: {}", e))?;
        
    Ok(())
}

// ----------------------
// Audio API Pipeline
// ----------------------

#[derive(Deserialize)]
struct OpenAIResponse {
    text: String,
}

#[derive(Clone, Serialize)]
struct SubtitlePayload {
    text: String,
}

#[derive(Clone, Serialize)]
struct AudioLevelPayload {
    rms: f32,
}

struct BufferState {
    samples: Vec<f32>,
    file_counter: u32,
}

pub struct AppState {
    pub is_listening: Arc<AtomicBool>,
}

#[tauri::command]
async fn start_listening(api_key: String, target_lang: String, source: String, app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    
    if state.is_listening.load(Ordering::Relaxed) {
        return Ok(());
    }
    state.is_listening.store(true, Ordering::Relaxed);

    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.show();
    }

    let is_listening_clone = state.is_listening.clone();
    let app_clone = app.clone();
    let api_key_clone = api_key.clone();
    let target_lang_clone = target_lang.clone();

    // Canale per comunicare i file audio pronti dal microfono al traduttore
    let (tx, rx) = mpsc::channel::<PathBuf>();

    // 1. THREAD TRADUTTORE
    let api_key_worker = api_key_clone.clone();
    let target_lang_worker = target_lang_clone.clone();
    let app_worker = app_clone.clone();
    let is_listening_worker = is_listening_clone.clone();
    
    std::thread::spawn(move || {
        while is_listening_worker.load(Ordering::Relaxed) {
            if let Ok(filepath) = rx.recv_timeout(Duration::from_millis(500)) {
                // Avvolgi il path in un RAII guard. Appena questo scope finisce, il file si cancella
                // Questo impedisce leak di file temporanei su disco se la chiamata di rete panica.
                let temp_guard = SafeTempFile { path: filepath };
                
                let result = tauri::async_runtime::block_on(
                    translate_audio_with_openai(&temp_guard.path, &api_key_worker, &target_lang_worker)
                );
                
                match result {
                    Ok(translated) => {
                        let trimmed = translated.trim().to_string();
                        if !trimmed.is_empty() {
                            let _ = app_worker.emit("new_subtitle", SubtitlePayload { text: trimmed });
                        }
                    }
                    Err(e) => {
                        let _ = app_worker.emit("new_subtitle", SubtitlePayload { 
                            text: format!("[API Error: {}]", e) 
                        });
                    }
                }
            }
        }
    });

    // 2. THREAD DI CATTURA
    let is_listening_capture = is_listening_clone.clone();
    let app_capture = app_clone.clone();
    
    std::thread::spawn(move || {
        let host = cpal::default_host();
        
        // Logica di selezione device: Mic vs Output (Loopback su Win)
        let device = if source == "output" {
            host.default_output_device()
        } else {
            host.default_input_device()
        };

        let device = match device {
            Some(d) => d,
            None => {
                let _ = app_capture.emit("new_subtitle", SubtitlePayload { 
                    text: "[Error: No audio device found.]".to_string()
                });
                return;
            }
        };

        let config = match if source == "output" { device.default_output_config() } else { device.default_input_config() } {
            Ok(c) => c,
            Err(e) => {
                let _ = app_capture.emit("new_subtitle", SubtitlePayload { 
                    text: format!("[Error: Audio config failed: {}]", e)
                });
                return;
            }
        };

        let channels = config.channels() as u16;
        let sample_rate = config.sample_rate().0 as u32;
        let target_samples = (sample_rate * channels as u32 * 5) as usize;

        let buffer_state = Arc::new(Mutex::new(BufferState {
            samples: Vec::with_capacity(target_samples),
            file_counter: 0,
        }));

        let err_fn = |err| eprintln!("Audio Stream error: {}", err);

        let stream_result = match config.sample_format() {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config.clone().into(),
                {
                    let state_mux = buffer_state.clone();
                    let tx_chan = tx.clone();
                    let app_emit = app_clone.clone();
                    move |data: &[f32], _| {
                        process_audio_data(data, &state_mux, &tx_chan, &app_emit, channels, sample_rate, target_samples)
                    }
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &config.clone().into(),
                {
                    let state_mux = buffer_state.clone();
                    let tx_chan = tx.clone();
                    let app_emit = app_clone.clone();
                    move |data: &[i16], _| {
                        let f32_data: Vec<f32> = data.iter().map(|&s| s as f32 / 32768.0).collect();
                        process_audio_data(&f32_data, &state_mux, &tx_chan, &app_emit, channels, sample_rate, target_samples)
                    }
                },
                err_fn,
                None,
            ),
            _ => return,
        };

        let stream = match stream_result {
            Ok(s) => s,
            Err(_) => return,
        };

        let _ = stream.play();

        while is_listening_capture.load(Ordering::Relaxed) {
            std::thread::sleep(Duration::from_millis(200));
        }
        drop(stream);
    });

    Ok(())
}

fn process_audio_data(
    data: &[f32],
    state_mux: &Arc<Mutex<BufferState>>,
    tx: &mpsc::Sender<PathBuf>,
    app: &AppHandle,
    channels: u16,
    sample_rate: u32,
    target_samples: usize
) {
    // 1. Calcola RMS live ed emettilo verso la UI React per le animazioni
    let mut sq_sum = 0.0;
    for &sample in data {
        sq_sum += sample * sample;
    }
    let rms = (sq_sum / data.len() as f32).sqrt();
    let _ = app.emit("audio_level", AudioLevelPayload { rms });

    // 2. Accumula per i 5 secondi necessari a OpenAI
    let mut state = state_mux.lock().unwrap();
    state.samples.extend_from_slice(data);

    if state.samples.len() >= target_samples {
        let mut chunk_sq_sum = 0.0;
        for &s in state.samples.iter() {
            chunk_sq_sum += s * s;
        }
        let chunk_rms = (chunk_sq_sum / state.samples.len() as f32).sqrt();

        if chunk_rms > SILENCE_THRESHOLD_RMS {
            // Usa PathBuf::join() invece della manipolazione stringhe per evitare 
            // incroci brutali tra slash (\ su Windows, / su Mac)
            let filename = std::env::temp_dir().join(format!("temp_capture_{}.wav", state.file_counter));
            state.file_counter += 1;

            let spec = hound::WavSpec {
                channels,
                sample_rate,
                bits_per_sample: 32,
                sample_format: hound::SampleFormat::Float,
            };
            
            if let Ok(mut writer) = hound::WavWriter::create(&filename, spec) {
                for &s in state.samples.iter() {
                    writer.write_sample(s).unwrap();
                }
                writer.finalize().unwrap();
                // Notifichiamo il thread traduttore
                let _ = tx.send(filename);
            }
        }
        // Ripuliamo il buffer per i prossimi 5 secondi (sia che abbiamo salvato sia che fosse silenzio)
        state.samples.clear();
    }
}

#[tauri::command]
async fn stop_listening(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.is_listening.store(false, Ordering::Relaxed);
    
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }
    
    Ok(())
}

async fn translate_audio_with_openai(filepath: &std::path::Path, api_key: &str, target_lang: &str) -> anyhow::Result<String> {
    let client = reqwest::Client::new();
    let audio_file = tokio::fs::read(filepath).await?;
    
    // Whisper's translation API only outputs English.
    if target_lang.eq_ignore_ascii_case("English") {
        let file_part = multipart::Part::bytes(audio_file)
            .file_name("audio.wav")
            .mime_str("audio/wav")?;

        let form = multipart::Form::new()
            .text("model", "whisper-1")
            .part("file", file_part);

        let res = client
            .post("https://api.openai.com/v1/audio/translations")
            .bearer_auth(api_key)
            .multipart(form)
            .send()
            .await?;

        if res.status().is_success() {
            let json_resp: OpenAIResponse = res.json().await?;
            Ok(json_resp.text)
        } else {
            let err_text = res.text().await?;
            Err(anyhow::anyhow!("API Error: {}", err_text))
        }
    } else {
        // HYBRID PIPELINE: Translate to other foreign languages via GPT-4o-mini
        let file_part = multipart::Part::bytes(audio_file)
            .file_name("audio.wav")
            .mime_str("audio/wav")?;

        let form = multipart::Form::new()
            .text("model", "whisper-1")
            .part("file", file_part);

        // 1. First extract transcription from original audio
        let trans_res = client
            .post("https://api.openai.com/v1/audio/transcriptions")
            .bearer_auth(api_key)
            .multipart(form)
            .send()
            .await?;

        if trans_res.status().is_success() {
            let json_resp: OpenAIResponse = trans_res.json().await?;
            let transcribed_text = json_resp.text.trim();
            
            if transcribed_text.is_empty() {
                return Ok(String::new());
            }

            // 2. Perform raw text-to-text translation 
            let chat_req = serde_json::json!({
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": format!("You are a fast, cinematic subtitle translator. Translate the following text into {}. ONLY output the raw translation, without quotes, notes, or descriptions.", target_lang)
                    },
                    {
                        "role": "user",
                        "content": transcribed_text
                    }
                ],
                "max_tokens": 100
            });

            let chat_res = client
                .post("https://api.openai.com/v1/chat/completions")
                .bearer_auth(api_key)
                .json(&chat_req)
                .send()
                .await?;

            if chat_res.status().is_success() {
                let chat_json: serde_json::Value = chat_res.json().await?;
                if let Some(content) = chat_json["choices"][0]["message"]["content"].as_str() {
                    Ok(content.to_string())
                } else {
                    Err(anyhow::anyhow!("Invalid response from completion API"))
                }
            } else {
                let err_text = chat_res.text().await?;
                Err(anyhow::anyhow!("Chat API Error: {}", err_text))
            }
        } else {
            let err_text = trans_res.text().await?;
            Err(anyhow::anyhow!("Transcription API Error: {}", err_text))
        }
    }
}

// ----------------------
// Application Entry Point
// ----------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(AppState {
                is_listening: Arc::new(AtomicBool::new(false)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_listening,
            stop_listening,
            get_meetings,
            save_meeting,
            delete_meeting
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
