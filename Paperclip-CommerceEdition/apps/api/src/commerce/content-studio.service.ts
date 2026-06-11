// apps/api/src/commerce/content-studio.service.ts
import { Injectable } from '@nestjs/common';
import { AgentService } from '../agents/agent.service';

@Injectable()
export class ContentStudioService {
  constructor(private agentService: AgentService) {}

  async generateSocialContent(productId: string, platform: 'INSTAGRAM' | 'TIKTOK' | 'FACEBOOK', provider: any) {
    // 1. Fetch product data (mock)
    const product = { name: 'Premium Earbuds', description: 'Noise cancelling, 40h battery' };

    // 2. Select Agent based on platform
    const agent = {
      id: 'agent-creative-1',
      name: 'Creative Content Agent',
      role: 'CONTENT_MANAGER',
      systemPrompt: `You are a world-class e-commerce copywriter. Create viral captions for ${platform}. Use emojis, strong hooks, and clear CTAs.`,
    };

    // 3. Generate content
    const result = await this.agentService.executeAgentTask(
      agent,
      { 
        title: `Generate ${platform} caption`, 
        description: `Product: ${product.name}. Specs: ${product.description}. Target: Gen Z and Millennials.` 
      },
      provider
    );

    return {
      platform,
      content: result.content,
      hashtags: ['#tech', '#gadgets', '#ecommerce'],
    };
  }
}
