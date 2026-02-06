
export enum ContentType {
  FUN_FACTS = 'Animasi Fakta Menarik',
  WEIRD_EVENTS = 'Animasi Kejadian Aneh',
  HISTORY = 'Animasi Sejarah',
  SCIENCE = 'Animasi Sains',
  BIOLOGY = 'Animasi Biologi',
  NATURE = 'Animasi Alam',
  TECHNOLOGY = 'Animasi Teknologi',
  HEALTH = 'Animasi Kesehatan',
  EDUCATION = 'Animasi Edukasi Ringan',
  SHORT_STORY = 'Animasi Cerita Pendek',
  CUSTOM = 'Custom / Bebas'
}

export enum Language {
  INDONESIAN = 'Indonesia',
  ENGLISH = 'English'
}

export enum AnimationStyle {
  FLAT_2D = 'Kartun 2D flat',
  OUTLINE_2D = 'Kartun 2D outline',
  SEMI_REALISTIC = 'Semi-realistik',
  MINIMALIST = 'Minimalis / Infographic',
  CLAY = 'Clay / Paper cut',
  PIXEL_ART = 'Pixel Art',
  CRAYON = 'Crayon / Sketch style'
}

export enum Tone {
  NEUTRAL = 'Netral',
  SERIOUS = 'Serius',
  RELAXED = 'Santai',
  DRAMATIC = 'Dramatis',
  MYSTERIOUS = 'Misterius',
  ENERGETIC = 'Energetik'
}

export enum Platform {
  TIKTOK = 'TikTok / Shorts / Reels',
  YOUTUBE = 'YouTube (Landscape)'
}

export enum AIModel {
  FLASH_3 = 'gemini-3-flash-preview',
  PRO_3 = 'gemini-3-pro-preview',
  FLASH_2_5 = 'gemini-2.5-flash-lite',
  IMAGE_2_5 = 'gemini-2.5-flash',
  IMAGE_PRO_3 = 'gemini-3-pro-image-preview'
}

export enum VoiceName {
  KORE = 'Kore',
  PUCK = 'Puck',
  CHARON = 'Charon',
  FENRIR = 'Fenrir',
  ZEPHYR = 'Zephyr'
}

export interface CreatorConcept {
  type: ContentType;
  language: Language;
  style: AnimationStyle;
  tone: Tone;
  platform: Platform;
  customTopic?: string;
  customHook?: string;
  customCTA?: string;
}

export interface ContentIdea {
  title: string;
  hook: string;
  duration: string;
  viralScore: 'Low' | 'Medium' | 'High';
  monetizationSafe: boolean;
}

export interface ScriptData {
  text: string;
  estimatedDuration: number;
  segments: FootagePrompt[];
}

export interface FootagePrompt {
  startTime: number;
  endTime: number;
  prompt: string;
  narrativeLine: string;
  previewUrl?: string;
}

export interface AppSettings {
  model: string;
  voice: VoiceName;
  volume: number;
  playbackSpeed: number;
}

export interface KeyHealthInfo {
  failures: number;
  lastUsed: Date | null;
  totalCalls: number;
  lastError?: string;
}

export interface ToastNotification {
  show: boolean;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface AppState {
  step: number;
  concept: CreatorConcept;
  ideas: ContentIdea[];
  selectedIdea: ContentIdea | null;
  script: ScriptData | null;
  audioUrl: string | null;
  audioBase64: string | null;
  isGenerating: boolean;
  settings: AppSettings;
  voicePreviewUrl: string | null;
  hasApiKey: boolean;
  customKeys: string[];
  currentKeyIndex: number;
  keyHealthStatus: Record<string, KeyHealthInfo>;
  toast: ToastNotification | null;
}
