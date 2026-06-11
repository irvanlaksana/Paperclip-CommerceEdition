export enum Role {
  CEO = 'CEO',
  COO = 'COO',
  CTO = 'CTO',
  CMO = 'CMO',
  MARKETPLACE_MANAGER = 'MARKETPLACE_MANAGER',
  PRODUCT_RESEARCH_MANAGER = 'PRODUCT_RESEARCH_MANAGER',
  CONTENT_MANAGER = 'CONTENT_MANAGER',
  SEO_MANAGER = 'SEO_MANAGER',
  ADS_MANAGER = 'ADS_MANAGER',
  REPORTING_MANAGER = 'REPORTING_MANAGER',
  USER = 'USER',
}

export enum IssueStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
}

export interface AIProvider {
  id: string;
  name: string;
  model: string;
  endpoint?: string;
  apiKey?: string;
  enabled: boolean;
}

export interface Agent {
  id: string;
  name: string;
  role: Role;
  systemPrompt: string;
  providerId: string;
}

export interface CompanyGoal {
  id: string;
  title: string;
  description?: string;
  status: string;
}
