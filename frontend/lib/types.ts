export interface ClassifyResponse {
  document_id: string;
  category: string;
  document_type: string;
  confidence: number;
  summary: string;
  extracted_fields: Record<string, unknown>;
  suggested_questions: string[];
  theme_color: string;
  file_url?: string;
}

export interface DocumentListItem {
  document_id: string;
  filename: string;
  category: string;
  document_type: string;
  summary: string;
  theme_color: string;
  created_at: string;
  confidence: number;
  extracted_fields: Record<string, unknown>;
  suggested_questions: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface QueryRequest {
  document_id: string;
  question: string;
  voice_used: boolean;
  context?: Record<string, unknown>;
}

export interface ActionRequest {
  document_id: string;
  action_type: 'approved' | 'flagged' | 'exported' | 'summarized';
  details?: Record<string, unknown>;
}

export interface ActionResponse {
  success: boolean;
  result: Record<string, unknown>;
}

export type AppPhase = 'upload' | 'processing' | 'ready';
