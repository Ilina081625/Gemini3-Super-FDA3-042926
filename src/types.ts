export interface ProcessedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  data?: string; // base64
  status: 'pending' | 'processing' | 'done' | 'error';
}

export type Language = 'Traditional Chinese' | 'English';

export interface TelemetryLog {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}
