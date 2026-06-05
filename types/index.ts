/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Persona {
  id: string;
  name: string;
  loraAdapter: string;
  icon: string;
  description: string;
  recommendedTasks: string[];
  defaultConfig: {
    temperature: number;
    topP: number;
    presencePenalty: number;
  };
}

export type ManuscriptStatus = 'completed' | 'draft' | 'editing';

export interface Manuscript {
  id: string;
  title: string;
  content: string;
  prompt: string;
  personaId: string;
  loraAdapter: string;
  createdAt: string;
  status: ManuscriptStatus;
  wordCount: number;
}

