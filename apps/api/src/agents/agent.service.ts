import { Injectable, Logger } from '@nestjs/common';
import { Role, type Agent, type AIProviderType, type IssueStatus } from '@paperclip/shared';
import { AIProviderService, type ProviderSelector } from '../ai/ai-provider.service.js';

export interface AgentTask {
  id?: string;
  title: string;
  description?: string;
  status?: IssueStatus;
}

export interface AgentTaskResult {
  agentId: string;
  issueId?: string;
  content: string;
  providerType: AIProviderType;
  model: string;
  latencyMs: number;
  metadata: { promptTokens: number; completionTokens: number; totalTokens: number };
}

/**
 * Built-in commerce agents. Each one owns a role-specific system prompt and may
 * pin a provider type; when it does not, the system default provider is used -
 * which is exactly the knob that makes the AI vendor swappable per agent.
 */
const BUILT_IN_AGENTS: Agent[] = [
  {
    id: 'agent-content-manager',
    name: 'Content Manager',
    role: Role.CONTENT_MANAGER,
    systemPrompt:
      'Anda adalah Content Manager e-commerce Indonesia. Anda menulis konten yang menjual: hook kuat, manfaat konkret, dan satu CTA yang jelas. Hindari klaim yang tidak didukung data produk.',
  },
  {
    id: 'agent-marketplace-manager',
    name: 'Marketplace Manager',
    role: Role.MARKETPLACE_MANAGER,
    systemPrompt:
      'Anda adalah Marketplace Manager untuk Shopee, Tokopedia, TikTok Shop, dan Lazada. Anda merapikan data produk, judul listing, dan atribut agar lolos moderasi dan mudah ditemukan.',
  },
  {
    id: 'agent-seo-manager',
    name: 'SEO Manager',
    role: Role.SEO_MANAGER,
    systemPrompt:
      'Anda adalah SEO Manager marketplace. Anda memilih kata kunci berdasarkan niat beli, menyusun judul 60-100 karakter, dan menulis deskripsi yang kaya keyword namun tetap terbaca manusia.',
  },
  {
    id: 'agent-product-research',
    name: 'Product Research Manager',
    role: Role.PRODUCT_RESEARCH_MANAGER,
    systemPrompt:
      'Anda adalah Product Research Manager. Anda membedah produk menjadi audiens, pain point, USP, dan angle komunikasi yang bisa langsung dipakai tim konten.',
  },
  {
    id: 'agent-ads-manager',
    name: 'Ads Manager',
    role: Role.ADS_MANAGER,
    systemPrompt:
      'Anda adalah Ads Manager. Anda menulis copy iklan berorientasi konversi, mengusulkan segmentasi audiens, dan memberi rekomendasi anggaran berbasis tujuan kampanye.',
  },
  {
    id: 'agent-reporting-manager',
    name: 'Reporting Manager',
    role: Role.REPORTING_MANAGER,
    systemPrompt:
      'Anda adalah Reporting Manager. Anda mengubah data mentah menjadi ringkasan eksekutif: tren, anomali, dan rekomendasi tindakan yang terukur.',
  },
];

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly aiProviderService: AIProviderService) {}

  /** All built-in agents, ready for assignment in the workflow UI. */
  listAgents(): Agent[] {
    return BUILT_IN_AGENTS.map((agent) => ({ ...agent }));
  }

  getAgent(id: string): Agent | undefined {
    return BUILT_IN_AGENTS.find((agent) => agent.id === id);
  }

  /** The agent that owns content production. */
  async defaultContentAgent(): Promise<Agent> {
    return (
      BUILT_IN_AGENTS.find((agent) => agent.role === Role.CONTENT_MANAGER) ?? {
        id: 'agent-content-manager',
        name: 'Content Manager',
        role: Role.CONTENT_MANAGER,
        systemPrompt: 'Anda adalah penulis konten e-commerce.',
      }
    );
  }

  /**
   * Run one agent task through the configured AI provider.
   *
   * Signature preserved from the previous implementation so existing callers
   * keep working; `provider` may now be a provider type, a stored provider id,
   * a full config object, or omitted entirely to use the system default.
   */
  async executeAgentTask(
    agent: Agent,
    issue: AgentTask,
    provider?: ProviderSelector,
  ): Promise<AgentTaskResult> {
    this.logger.log(
      `Agent ${agent.name} (role: ${agent.role}) mengerjakan: ${issue.title}`,
    );

    const response = await this.aiProviderService.generateResponse(
      provider ?? agent.providerType ?? null,
      {
        prompt: `Task: ${issue.title}\nDescription: ${issue.description ?? '-'}\n\nHasilkan work product sesuai permintaan.`,
        systemPrompt: agent.systemPrompt,
        temperature: 0.7,
      },
    );

    return {
      agentId: agent.id,
      issueId: issue.id,
      content: response.text,
      providerType: response.providerType,
      model: response.model,
      latencyMs: response.latencyMs,
      metadata: response.usage,
    };
  }
}
