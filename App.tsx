
import React, { useState, useRef, useEffect } from 'react';
import {
  ContentType, Language, AnimationStyle, Tone, Platform,
  CreatorConcept, ContentIdea, ScriptData, AppState, AIModel, VoiceName, KeyHealthInfo, ToastNotification
} from './types';
import { geminiService } from './services/geminiService';

// --- Audio Utils ---
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) { channelData[i] = dataInt16[i * numChannels + channel] / 32768.0; }
  }
  return buffer;
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels, length = buffer.length * numOfChan * 2 + 44, bufferArr = new ArrayBuffer(length), view = new DataView(bufferArr), channels = [], sampleRate = buffer.sampleRate;
  let i, sample, offset = 0, pos = 0;
  const setUint16 = (d: number) => { view.setUint16(pos, d, true); pos += 2; };
  const setUint32 = (d: number) => { view.setUint32(pos, d, true); pos += 4; };
  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan); setUint32(sampleRate); setUint32(sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
  for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
      view.setInt16(pos, sample, true); pos += 2;
    }
    offset++;
  }
  return new Blob([bufferArr], { type: "audio/wav" });
}

// --- UI Components ---

const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => (
  <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-xl">
    <div className="relative mb-8">
      <div className="w-24 h-24 border-8 border-indigo-500/10 rounded-full scale-110"></div>
      <div className="absolute inset-0 w-24 h-24 border-t-8 border-indigo-500 rounded-full animate-spin"></div>
    </div>
    <p className="text-2xl font-black text-white uppercase tracking-tighter text-center px-10 animate-pulse">{message}</p>
  </div>
);

const Toast: React.FC<{ message: string; type: 'info' | 'success' | 'warning' | 'error' }> = ({ message, type }) => {
  const bgColors = {
    info: 'bg-blue-600',
    success: 'bg-emerald-600',
    warning: 'bg-amber-600',
    error: 'bg-red-600'
  };

  return (
    <div className="fixed top-24 right-8 z-[90] animate-in slide-in-from-right duration-300">
      <div className={`${bgColors[type]} text-white px-6 py-4 rounded-2xl shadow-2xl border-2 border-white/20 backdrop-blur-xl min-w-[300px]`}>
        <p className="text-sm font-bold">{message}</p>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const savedKeys = localStorage.getItem('animato_keys');
    const savedHealth = localStorage.getItem('animato_key_health');
    return {
      step: 0,
      concept: { type: ContentType.FUN_FACTS, language: Language.INDONESIAN, style: AnimationStyle.FLAT_2D, tone: Tone.NEUTRAL, platform: Platform.TIKTOK, customHook: "", customCTA: "" },
      ideas: [], selectedIdea: null, script: null, audioUrl: null, audioBase64: null, isGenerating: false, settings: { model: AIModel.FLASH_3, voice: VoiceName.KORE, volume: 1.0, playbackSpeed: 1.0 }, voicePreviewUrl: null, hasApiKey: false,
      customKeys: savedKeys ? JSON.parse(savedKeys) : [],
      currentKeyIndex: 0,
      keyHealthStatus: savedHealth ? JSON.parse(savedHealth) : {},
      toast: null
    };
  });

  const [loadingMsg, setLoadingMsg] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    localStorage.setItem('animato_keys', JSON.stringify(state.customKeys));
    localStorage.setItem('animato_key_health', JSON.stringify(state.keyHealthStatus));
  }, [state.customKeys, state.keyHealthStatus]);

  useEffect(() => {
    if (state.toast?.show) {
      const timer = setTimeout(() => {
        setState(p => ({ ...p, toast: null }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [state.toast]);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setState(p => ({ ...p, hasApiKey: hasKey }));
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.settings.volume;
      audioRef.current.playbackRate = state.settings.playbackSpeed;
    }
  }, [state.settings.volume, state.settings.playbackSpeed, state.audioUrl]);

  const handleSelectKey = async () => {
    // @ts-ignore
    await window.aistudio.openSelectKey();
    setState(p => ({ ...p, hasApiKey: true }));
  };

  const showToast = (message: string, type: ToastNotification['type'] = 'info') => {
    setState(p => ({ ...p, toast: { show: true, message, type } }));
  };

  const validateApiKey = (key: string): { valid: boolean; error?: string } => {
    if (!key || key.trim().length === 0) {
      return { valid: false, error: "API Key tidak boleh kosong" };
    }
    if (!key.startsWith('AIza')) {
      return { valid: false, error: "Format API Key tidak valid (harus dimulai dengan 'AIza')" };
    }
    if (key.length !== 39) {
      return { valid: false, error: "Panjang API Key harus 39 karakter" };
    }
    if (state.customKeys.includes(key)) {
      return { valid: false, error: "API Key sudah ditambahkan sebelumnya" };
    }
    return { valid: true };
  };

  const updateKeyHealth = (key: string, success: boolean, error?: string) => {
    setState(p => {
      const current = p.keyHealthStatus[key] || { failures: 0, lastUsed: null, totalCalls: 0 };
      return {
        ...p,
        keyHealthStatus: {
          ...p.keyHealthStatus,
          [key]: {
            failures: success ? 0 : current.failures + 1,
            lastUsed: new Date(),
            totalCalls: current.totalCalls + 1,
            lastError: error
          }
        }
      };
    });
  };

  const wrapApiCall = async (fn: (key: string) => Promise<void>, msg: string) => {
    setState(p => ({ ...p, isGenerating: true }));
    setLoadingMsg(msg);

    // 100% manual - no environment variable fallback
    if (state.customKeys.length === 0) {
      setState(p => ({ ...p, isGenerating: false }));
      alert("⚠️ Tidak ada API Key! Silakan tambahkan minimal 1 API Key di Settings.");
      setIsSettingsOpen(true);
      return;
    }

    const keysToTry = state.customKeys;
    let attempts = 0;
    let lastError: any = null;

    const findNextHealthyKey = (currentIdx: number): number => {
      for (let i = 1; i <= keysToTry.length; i++) {
        const idx = (currentIdx + i) % keysToTry.length;
        const key = keysToTry[idx];
        const health = state.keyHealthStatus[key];
        // Skip keys with 3+ consecutive failures
        if (!health || health.failures < 3) {
          return idx;
        }
      }
      return (currentIdx + 1) % keysToTry.length; // fallback to next if all unhealthy
    };

    const tryCall = async (idx: number) => {
      const activeKey = keysToTry[idx];

      try {
        await fn(activeKey);
        updateKeyHealth(activeKey, true);
      } catch (e: any) {
        lastError = e;
        const errMsg = e.message.toLowerCase();
        const isQuotaError = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("resource has been exhausted");
        const isAuthError = errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("api key") || errMsg.includes("invalid");

        updateKeyHealth(activeKey, false, e.message);

        if ((isQuotaError || isAuthError) && attempts < keysToTry.length - 1) {
          attempts++;
          const nextIdx = findNextHealthyKey(idx);
          setState(prev => ({ ...prev, currentKeyIndex: nextIdx }));

          const errorType = isQuotaError ? "Quota habis" : "Key tidak valid";
          showToast(`🔄 ${errorType}. Rotating to Key #${nextIdx + 1}...`, 'warning');
          console.warn(`Key rotation: Index ${idx} failed (${errorType}), rotating to ${nextIdx}. Attempts: ${attempts}`);

          await new Promise(resolve => setTimeout(resolve, 500)); // brief delay before retry
          await tryCall(nextIdx);
        } else {
          throw e;
        }
      }
    };

    try {
      await tryCall(state.currentKeyIndex);
      showToast('✅ Berhasil!', 'success');
    } catch (e: any) {
      const keyWord = keysToTry.length > 1 ? 'semua key' : 'key';
      if (e.message.toLowerCase().includes("quota") || e.message.toLowerCase().includes("429")) {
        alert(`❌ Kuota habis di ${keyWord}. Silakan tambahkan API Key baru atau coba lagi nanti.`);
      } else if (e.message.toLowerCase().includes("api key") || e.message.toLowerCase().includes("401") || e.message.toLowerCase().includes("403")) {
        alert(`❌ API Key tidak valid di ${keyWord}. Silakan periksa key Anda di Settings.`);
      } else {
        alert(`❌ Error: ${e.message}`);
      }
    } finally {
      setState(p => ({ ...p, isGenerating: false }));
    }
  };

  const handleBack = () => setState(prev => ({ ...prev, step: Math.max(0, prev.step - 1) }));

  const handleNextStep = async () => {
    if (state.customKeys.length === 0) {
      alert("⚠️ Silakan tambahkan API Key terlebih dahulu di Settings.");
      setIsSettingsOpen(true);
      return;
    }

    await wrapApiCall(async (key) => {
      if (state.step === 0) {
        const ideas = await geminiService.generateIdeas(key, state.concept, state.settings.model);
        setState(prev => ({ ...prev, step: 1, ideas }));
      } else if (state.step === 1 && state.selectedIdea) {
        const script = await geminiService.generateScript(key, state.concept, state.selectedIdea, state.settings.model);
        setState(prev => ({ ...prev, step: 2, script }));
      } else if (state.step === 2) {
        if (!state.audioUrl || !state.audioBase64) throw new Error("Voice Over diperlukan!");
        const synced = await geminiService.syncVisualPromptsWithAudio(key, state.audioBase64, state.script!.text, state.concept);
        setState(prev => ({ ...prev, step: 3, script: synced }));
      } else if (state.step === 3) {
        setState(prev => ({ ...prev, step: 4 }));
      }
    }, "Processing via Gemini...");
  };

  const generateVO = async () => {
    if (!state.script) return;
    await wrapApiCall(async (key) => {
      const base64 = await geminiService.generateVoiceOver(key, state.script!.text, state.settings.voice);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const pcm = decodeBase64(base64);
      const buffer = await decodeAudioData(pcm, ctx, 24000, 1);
      const url = URL.createObjectURL(audioBufferToWav(buffer));
      setState(prev => ({ ...prev, audioUrl: url, audioBase64: base64 }));
    }, "Generating Voice Over...");
  };

  const previewVoice = async () => {
    await wrapApiCall(async (key) => {
      const base64 = await geminiService.generateVoicePreview(key, state.settings.voice, state.concept.language);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(decodeBase64(base64), ctx, 24000, 1);
      setState(prev => ({ ...prev, voicePreviewUrl: URL.createObjectURL(audioBufferToWav(buffer)) }));
    }, "Sampling Voice...");
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Prompt disalin!");
  };

  // --- Suggested Content ---
  const suggestedHooks = [
    "Tahukah kamu fakta unik tentang...",
    "Jangan scroll! Alasan kenapa ini terjadi...",
    "Ini adalah misteri terbesar di...",
    "Pernahkah kamu berpikir bagaimana...",
    "Fakta gila yang baru saya temukan adalah..."
  ];

  const suggestedCTAs = [
    "Follow untuk fakta menarik lainnya!",
    "Klik like kalau kamu baru tahu ini!",
    "Share ke temanmu yang suka...",
    "Komen pendapatmu di bawah ya!",
    "Sampai jumpa di video fakta berikutnya!"
  ];

  // --- Step Rendering ---

  const renderStep0 = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
      <div className="space-y-6">
        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">1. Pilih Topik Animasi</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.values(ContentType).map(t => (
            <button key={t} onClick={() => setState(p => ({ ...p, concept: { ...p.concept, type: t } }))} className={`p-4 rounded-2xl border-2 text-xs font-black text-left transition-all ${state.concept.type === t ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-500'}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="p-6 bg-slate-800/40 rounded-[24px] border border-white/5 backdrop-blur-xl space-y-6 shadow-2xl">
        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Konfigurasi Produksi</label>
          <select className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-sm font-bold" value={state.concept.language} onChange={e => setState(p => ({ ...p, concept: { ...p.concept, language: e.target.value as Language } }))}>
            {Object.values(Language).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-sm font-bold" value={state.concept.style} onChange={e => setState(p => ({ ...p, concept: { ...p.concept, style: e.target.value as AnimationStyle } }))}>
            {Object.values(AnimationStyle).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-sm font-bold" value={state.concept.tone} onChange={e => setState(p => ({ ...p, concept: { ...p.concept, tone: e.target.value as Tone } }))}>
            {Object.values(Tone).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      <div className="lg:col-span-2 space-y-6">
        <div className="p-6 bg-slate-800/40 border-2 border-slate-700 rounded-[24px] shadow-2xl">
          <textarea className="w-full h-[400px] bg-transparent border-none text-slate-200 text-xl font-medium leading-relaxed focus:outline-none resize-none custom-scrollbar" value={state.script?.text} onChange={e => setState(p => ({ ...p, script: p.script ? { ...p.script, text: e.target.value } : null }))} />
        </div>
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-[24px] space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Saran Hook & Penutup (Klik untuk Tambah)</label>
            <div className="flex flex-wrap gap-2">
              {suggestedHooks.map(h => <button key={h} onClick={() => setState(p => ({ ...p, script: p.script ? { ...p.script, text: h + " " + p.script.text } : null }))} className="px-4 py-2 bg-slate-800 hover:bg-indigo-600/30 border border-slate-700 rounded-full text-[10px] font-bold text-slate-300 transition-all">{h}</button>)}
              {suggestedCTAs.map(c => <button key={c} onClick={() => setState(p => ({ ...p, script: p.script ? { ...p.script, text: p.script.text + " " + c } : null }))} className="px-4 py-2 bg-slate-800 hover:bg-purple-600/30 border border-slate-700 rounded-full text-[10px] font-bold text-slate-300 transition-all">{c}</button>)}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-6">
        <div className="p-6 bg-indigo-600 rounded-[24px] shadow-2xl space-y-6">
          <h3 className="text-white font-black uppercase tracking-tighter text-xl">Voice Generator</h3>
          <div className="space-y-4">
            <div className="flex gap-2">
              <select className="flex-1 bg-white/10 border-2 border-white/20 rounded-2xl p-4 text-white text-sm font-bold" value={state.settings.voice} onChange={e => setState(p => ({ ...p, settings: { ...p.settings, voice: e.target.value as VoiceName } }))}>
                {Object.values(VoiceName).map(v => <option key={v} value={v} className="bg-slate-900">{v}</option>)}
              </select>
              <button onClick={previewVoice} className="p-4 bg-white/10 border-2 border-white/20 rounded-2xl text-white hover:bg-white/20 transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" /></svg>
              </button>
            </div>
            <button onClick={generateVO} className="w-full py-5 bg-white text-indigo-600 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Generate Full Audio</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-6">
        {state.script?.segments.map((seg, i) => (
          <div key={i} className="flex flex-col lg:flex-row gap-6 p-6 bg-slate-800/20 border-2 border-slate-800/50 rounded-[32px] group transition-all">
            <div className="w-full lg:w-[320px] shrink-0">
              <div className="aspect-video bg-slate-900 rounded-[32px] overflow-hidden relative border-2 border-slate-800">
                {seg.previewUrl ? <img src={seg.previewUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-700">Empty visual</div>}
                <button onClick={async () => wrapApiCall(async (key) => {
                  const url = await geminiService.generateFootagePreview(key, seg.prompt, state.concept.style);
                  const segments = [...state.script!.segments];
                  segments[i].previewUrl = url;
                  setState(p => ({ ...p, script: { ...p.script!, segments } }));
                }, `Generating visual segment ${i + 1}...`)} className="absolute inset-0 bg-indigo-600/80 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-xs font-black text-white uppercase tracking-widest">Generate Visual</button>
              </div>
              <div className="mt-4 flex justify-between px-2 text-[10px] font-black text-indigo-400">
                <span>Segmen {i + 1}</span>
                <span className="text-slate-500">{seg.startTime.toFixed(1)}s - {seg.endTime.toFixed(1)}s</span>
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Narasi</label>
                <p className="text-lg text-slate-200 font-bold italic leading-relaxed">"{seg.narrativeLine}"</p>
              </div>
              <div className="space-y-2 pt-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Visual Prompt</label>
                  <button onClick={() => copyToClipboard(seg.prompt)} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:underline">Copy Prompt</button>
                </div>
                <div className="bg-slate-900/60 p-6 rounded-[24px] border border-slate-700/50 text-sm text-slate-400">{seg.prompt}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const getBGM = (tone: Tone) => {
    switch (tone) {
      case Tone.ENERGETIC: return ["Phonk High Energy", "Electronic Trap Beats"];
      case Tone.MYSTERIOUS: return ["Cinematic Suspense Drone", "Dark Ambient Pads"];
      case Tone.DRAMATIC: return ["Epic Orchestral Hybrid", "Powerful Piano Solo"];
      case Tone.RELAXED: return ["Lo-fi Hip Hop", "Acoustic Folk Vibes"];
      default: return ["Modern Ambient", "Soft Instrumental"];
    }
  };

  const renderStep4 = () => {
    const music = getBGM(state.concept.tone);
    return (
      <div className="max-w-4xl mx-auto py-12 text-center animate-in zoom-in-95 duration-700">
        <div className="w-32 h-32 bg-indigo-600 rounded-[40px] flex items-center justify-center mx-auto mb-12 shadow-2xl rotate-6">
          <svg className="w-16 h-16 text-white -rotate-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-5xl font-black text-white mb-6 uppercase tracking-tighter">Ready for Production!</h2>
        <p className="text-xl text-slate-400 mb-12">Unduh aset Anda dan mulailah mengedit konten viral Anda hari ini.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <button onClick={async () => {
            if (state.audioUrl) {
              const res = await fetch(state.audioUrl);
              const blob = await res.blob();
              downloadFile(blob, `Narasi_${state.selectedIdea?.title || 'Animato'}.wav`);
            }
          }} className="p-6 bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 rounded-[24px] font-black text-xs uppercase tracking-[0.3em] flex flex-col items-center gap-4 group">
            <svg className="w-8 h-8 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
            Download Audio Narasi
          </button>
          <button onClick={() => {
            const txt = state.script?.segments.map((s, i) => `Segmen ${i + 1} (${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s):\nNarasi: ${s.narrativeLine}\nPrompt: ${s.prompt}\n\n`).join("");
            downloadFile(new Blob([txt], { type: 'text/plain' }), `Prompts_${state.selectedIdea?.title || 'Animato'}.txt`);
          }} className="p-6 bg-indigo-600 hover:bg-indigo-500 rounded-[24px] font-black text-xs uppercase tracking-[0.3em] text-white flex flex-col items-center gap-4 group">
            <svg className="w-8 h-8 group-hover:translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download Visual Prompts
          </button>
        </div>

        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-[32px]">
          <h4 className="text-slate-500 font-black uppercase text-[10px] tracking-[0.4em] mb-8">Rekomendasi Musik Latar</h4>
          <div className="flex flex-wrap justify-center gap-4">
            {music.map(m => <div key={m} className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-[10px] font-black text-indigo-400 uppercase tracking-widest">♫ {m}</div>)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050914] text-slate-200 selection:bg-indigo-500 selection:text-white pb-32">
      <nav className="sticky top-0 z-50 bg-[#050914]/80 backdrop-blur-2xl border-b border-white/5 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl"><svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M15 10L19.5528 7.72361C20.2177 7.39116 21 7.87465 21 8.61803V15.382C21 16.1253 20.2177 16.6088 19.5528 16.2764L15 14M7 18H11C12.1046 18 13 17.1046 13 16V8C13 6.89543 12.1046 6 11 6H7C5.89543 6 5 6.89543 5 8V16C5 17.1046 5.89543 18 7 18Z" /></svg></div>
          <h1 className="text-xl font-black uppercase tracking-tighter">Animato <span className="text-indigo-500">Studio</span></h1>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setIsSettingsOpen(true)} className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${state.customKeys.length > 0 ? 'bg-slate-900 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse'}`}>
            {state.customKeys.length > 0 ? `${state.customKeys.length} Keys (Using #${state.currentKeyIndex + 1})` : '⚠️ Tambah API Key'}
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-slate-900 border border-white/5 rounded-2xl text-slate-400 hover:text-white"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-.2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth="2" /><circle cx="12" cy="12" r="3" strokeWidth="2" /></svg></button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-6">
        <div className="max-w-4xl mx-auto mb-10 flex justify-between relative">
          <div className="absolute left-0 top-1/2 w-full h-0.5 bg-slate-800 -translate-y-1/2 rounded-full"></div>
          <div className="absolute left-0 top-1/2 h-0.5 bg-indigo-500 -translate-y-1/2 rounded-full transition-all duration-700" style={{ width: `${(state.step / 4) * 100}%` }}></div>
          {[0, 1, 2, 3, 4].map(s => <div key={s} className={`relative z-10 w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black transition-all ${state.step >= s ? 'bg-indigo-600 text-white shadow-xl rotate-12' : 'bg-slate-800 text-slate-600'}`}>{s + 1}</div>)}
        </div>

        <div className="min-h-[60vh] py-6">
          {state.step === 0 && renderStep0()}
          {state.step === 1 && (
            <div className="space-y-10 animate-in fade-in duration-500">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Hasil Brainstorming</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {state.ideas.map((idea, i) => (
                  <div key={i} onClick={() => setState(p => ({ ...p, selectedIdea: idea }))} className={`p-5 rounded-[24px] border-2 cursor-pointer transition-all ${state.selectedIdea?.title === idea.title ? 'bg-indigo-600 border-indigo-400 shadow-2xl scale-[1.02]' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'}`}>
                    <div className="flex justify-between mb-4"><span className="text-[10px] font-black uppercase text-indigo-400">{idea.viralScore} Viral Potential</span></div>
                    <h3 className="text-xl font-black mb-2 text-white">{idea.title}</h3>
                    <p className="text-xs italic text-slate-400">"{idea.hook}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {state.step === 2 && renderStep2()}
          {state.step === 3 && renderStep3()}
          {state.step === 4 && renderStep4()}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 w-full bg-[#050914]/90 backdrop-blur-3xl border-t border-white/5 px-8 py-5 flex justify-between items-center z-[60]">
        <button onClick={handleBack} disabled={state.step === 0 || state.isGenerating} className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${state.step === 0 ? 'opacity-0' : 'text-slate-400 hover:text-white'}`}>Kembali</button>
        <button onClick={handleNextStep} disabled={(state.step === 1 && !state.selectedIdea) || state.step === 4 || state.isGenerating} className="px-14 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] font-black text-xs uppercase tracking-widest transition-all shadow-2xl disabled:opacity-30">
          {state.step === 2 ? 'Proses Visual Storyboard' : 'Langkah Selanjutnya'}
        </button>
      </footer>

      {state.isGenerating && <LoadingOverlay message={loadingMsg} />}
      {state.toast?.show && <Toast message={state.toast.message} type={state.toast.type} />}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={state.settings}
        setSettings={(s: any) => setState(p => ({ ...p, settings: s }))}
        customKeys={state.customKeys}
        setCustomKeys={(keys: string[]) => setState(p => ({ ...p, customKeys: keys }))}
        currentKeyIndex={state.currentKeyIndex}
        keyHealthStatus={state.keyHealthStatus}
        validateApiKey={validateApiKey}
        onResetHealth={(key: string) => setState(p => ({
          ...p,
          keyHealthStatus: { ...p.keyHealthStatus, [key]: { failures: 0, lastUsed: null, totalCalls: 0 } }
        }))}
      />
    </div>
  );
};

const SettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: any;
  setSettings: any;
  customKeys: string[];
  setCustomKeys: (keys: string[]) => void;
  currentKeyIndex: number;
  keyHealthStatus: Record<string, KeyHealthInfo>;
  validateApiKey: (key: string) => { valid: boolean; error?: string };
  onResetHealth: (key: string) => void;
}> = ({ isOpen, onClose, settings, setSettings, customKeys, setCustomKeys, currentKeyIndex, keyHealthStatus, validateApiKey, onResetHealth }) => {
  const [newKey, setNewKey] = useState("");
  const [validationError, setValidationError] = useState("");

  if (!isOpen) return null;

  const handleAddKey = () => {
    setValidationError("");
    const validation = validateApiKey(newKey);

    if (!validation.valid) {
      setValidationError(validation.error || "Invalid API Key");
      return;
    }

    if (customKeys.length >= 10) {
      setValidationError("Maximum 10 API keys allowed");
      return;
    }

    setCustomKeys([...customKeys, newKey.trim()]);
    setNewKey("");
  };

  const handleRemoveKey = (idx: number) => {
    setCustomKeys(customKeys.filter((_, i) => i !== idx));
  };

  const getHealthBadge = (key: string, idx: number) => {
    const health = keyHealthStatus[key];
    if (!health || health.totalCalls === 0) {
      return <span className="text-[8px] font-black uppercase text-slate-600 bg-slate-800/50 px-2 py-0.5 rounded">Unused</span>;
    }

    if (health.failures === 0) {
      return <span className="text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">✓ Healthy</span>;
    }

    if (health.failures >= 3) {
      return <span className="text-[8px] font-black uppercase text-red-500 bg-red-500/10 px-2 py-0.5 rounded">✗ Failed</span>;
    }

    return <span className="text-[8px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">⚠ Warning</span>;
  };

  const formatLastUsed = (date: Date | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-[24px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-white font-black uppercase text-lg tracking-widest">Settings & API Management</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl">✕</button>
        </div>

        <div className="space-y-8">
          {/* AI Model Settings */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">AI Model</label>
            <select className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl p-3 text-slate-100 font-bold" value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })}>
              <option value={AIModel.FLASH_3}>Gemini 3 Flash (Fast & Efficient)</option>
              <option value={AIModel.PRO_3}>Gemini 3 Pro (Advanced & Powerful)</option>
              <option value={AIModel.FLASH_2_5}>Gemini 2.5 Flash (Experimental)</option>
            </select>
          </div>

          {/* Manual API Key Rotation Section */}
          <div className="space-y-4 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Manual API Keys</label>
              {customKeys.length > 0 && <span className="text-[9px] font-bold text-slate-500">{customKeys.length}/10 Keys</span>}
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="AIza... (39 characters)"
                  className="flex-1 bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none font-mono"
                  value={newKey}
                  onChange={e => { setNewKey(e.target.value); setValidationError(""); }}
                  onKeyPress={e => e.key === 'Enter' && handleAddKey()}
                />
                <button onClick={handleAddKey} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-indigo-500 transition-all">
                  Add
                </button>
              </div>
              {validationError && (
                <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">⚠ {validationError}</p>
              )}
            </div>

            <div className="space-y-2 mt-4">
              {customKeys.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-slate-800 rounded-xl">
                  <p className="text-sm text-slate-600 font-bold mb-2">⚠️ No API Keys Added</p>
                  <p className="text-[10px] text-slate-700">Add at least one API key to start generating content</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {customKeys.map((key, idx) => {
                    const health = keyHealthStatus[key] || { failures: 0, lastUsed: null, totalCalls: 0 };
                    return (
                      <div key={idx} className={`flex items-start justify-between p-4 rounded-xl border-2 transition-all ${idx === currentKeyIndex ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800 bg-slate-800/30'}`}>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${idx === currentKeyIndex ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
                            <span className="text-xs font-mono text-slate-400 truncate tracking-tight">
                              {key.substring(0, 12)}...{key.substring(key.length - 6)}
                            </span>
                            {idx === currentKeyIndex && <span className="text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Active Now</span>}
                            {getHealthBadge(key, idx)}
                          </div>

                          <div className="flex gap-4 text-[9px] text-slate-600">
                            <span>Calls: {health.totalCalls}</span>
                            <span>Failures: {health.failures}</span>
                            <span>Last used: {formatLastUsed(health.lastUsed)}</span>
                          </div>

                          {health.lastError && (
                            <p className="text-[9px] text-red-400 italic truncate">Error: {health.lastError}</p>
                          )}
                        </div>

                        <div className="flex gap-1 ml-3">
                          {health.failures > 0 && (
                            <button
                              onClick={() => onResetHealth(key)}
                              className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                              title="Reset health"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeWidth="2" /></svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveKey(idx)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800">
              <p className="text-[9px] text-slate-500 leading-relaxed">
                <strong className="text-indigo-400">💡 Smart Rotation:</strong> Sistem akan otomatis merotasi ke key berikutnya jika terkena quota limit (429) atau key tidak valid. Keys dengan 3+ failures akan di-skip secara otomatis.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl uppercase tracking-widest transition-all hover:bg-slate-700 active:scale-95">
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
