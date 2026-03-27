export type ViewType = 'dashboard' | 'research' | 'script' | 'studio' | 'publish' | 'library' | 'music' | 'keys' | 'clones' | 'youtube-connect' | 'schedule' | 'templates' | 'backgrounds';

export interface VideoProject {
  id: string;
  title: string;
  status: 'draft' | 'generating' | 'ready' | 'published';
  createdAt: string;
  thumbnail?: string;
}

export interface VideoClone {
  id: string;
  url: string;
  userId: string;
  createdAt: any;
  status: 'pending' | 'processing' | 'completed' | 'error';
  type: 'direct' | 'short' | 'post' | 'channel' | 'playlist';
  title: string;
  thumbnail: string;
  metadata?: {
    duration: string;
    dimensions: string;
    isShort: boolean;
    sceneCount: number;
  };
  scenes?: {
    timestamp: number;
    imageRef: string;
    text: string;
    templateInfo: any;
  }[];
  audioAnalysis?: {
    musicStyle: string;
    rhythm: string;
    voiceOver: boolean;
    soundEffects: boolean;
  };
  fullTranscript?: string;
  visualTemplate?: {
    position: string;
    fontSize: number;
    alignment: string;
    colors: any;
    transitions: string[];
  };
  confidenceScore?: number;
  ocrErrors?: string[];
  executionTime?: number;
  isReference?: boolean;
}
