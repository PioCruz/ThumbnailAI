
export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  imageUrl?: string;
  timestamp: Date;
}

export interface HistoryItem {
  id: string;
  imageUrl: string;
  prompt: string;
  timestamp: number;
}

export interface GenerationConfig {
  prompt: string;
  baseImage?: string;
}

export interface Folder {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  imageUrl: string;
  timestamp: number;
  folderId?: string | null;
}
