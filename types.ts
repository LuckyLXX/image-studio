// types.ts

export enum ImageStyle {
  ILLUSTRATION = 'ILLUSTRATION',
  CLAY = 'CLAY',
  DOODLE = 'DOODLE',
  CARTOON = 'CARTOON',
  INK_WASH = 'INK_WASH',
  AMERICAN_COMIC = 'AMERICAN_COMIC',
  WATERCOLOR = 'WATERCOLOR',
  PHOTOREALISTIC = 'PHOTOREALISTIC',
  JAPANESE_MANGA = 'JAPANESE_MANGA',
  THREE_D_ANIMATION = 'THREE_D_ANIMATION',
}

export enum ImageModel {
  IMAGEN = 'imagen-4.0-generate-001',
  NANO_BANANA = 'gemini-2.5-flash-image-preview',
  DOUBAO_4_0 = 'doubao-4.0-generate-001',
}

export enum ApiProvider {
  GEMINI = 'gemini',
  VOLCENGINE = 'volcengine',
}

export interface GeneratedImage {
  id: string;
  src: string;
  isFavorite?: boolean;
}

export type AppMode = 'wiki' | 'textToImage' | 'imageToImage' | 'video' | 'infiniteCanvas' | 'comicStrip';
export type CameraMovement = 'subtle' | 'zoomIn' | 'zoomOut';
export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type InspirationStrength = 'low' | 'medium' | 'high' | 'veryHigh';
export type ComicStripGenerationPhase = 'idle' | 'editing' | 'generating_panels' | 'generating_transitions' | 'completed';
export type ComicStripPanelStatus = 'queued' | 'generating' | 'completed';
export type ComicStripTransitionStatus = 'queued' | 'generating' | 'completed';
export type ComicStripTransitionOption = 'none' | 'ai_smart';


export interface HistoryRecord {
  id:string;
  mode: AppMode;
  prompt: string;
  style?: ImageStyle; // For wiki mode & comicStrip mode
  model?: ImageModel; // For wiki mode
  apiProvider?: ApiProvider; // API provider
  thumbnail: string; // Base64 thumbnail
  images?: GeneratedImage[]; // For image modes
  videoUrl?: string; // For video mode
  sourceImage?: string; // For imageToImage and video modes
  timestamp: number;
  cameraMovement?: CameraMovement; // For video mode
  numberOfImages?: number; // For textToImage mode
  aspectRatio?: AspectRatio; // For textToImage mode
  comicStripNumImages?: number;
  comicStripPanelPrompts?: string[];
  comicStripType?: 'images' | 'video';
  tags?: string[];
  selectedKeywords?: string[]; // For textToImage mode
  negativePrompt?: string; // For textToImage mode
  i2iMode?: 'edit' | 'inspiration'; // For imageToImage mode
  inspirationNumImages?: number; // For imageToImage inspiration mode
  inspirationAspectRatio?: AspectRatio; // For imageToImage inspiration mode
  inspirationStrength?: InspirationStrength;
  parentId?: string | null; // ID of the parent record for grouping
  videoScripts?: string[]; // For comic strip video mode
  videoUrls?: (string | null)[]; // For comic strip video mode
  transitionUrls?: (string | null)[]; // For AI smart transitions
  transitionOption?: ComicStripTransitionOption; // User choice for transitions
}