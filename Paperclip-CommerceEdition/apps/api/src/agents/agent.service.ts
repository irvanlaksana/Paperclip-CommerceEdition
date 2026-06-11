// apps/api/src/agents/agent.service.ts
import { Injectable } from '@nestjs/common';
import { AIProviderService, AIRequest } from '../ai/ai-provider.service';

@Injectable()
export class AgentService {
  constructor(private aiProviderService: AIProviderService) {}

  async executeAgentTask(agent: any, issue: any, provider: any) {
    console.log(`Agent ${agent.name} (Role: ${agent.role}) is working on issue: ${issue.title}`);
    
    const request: AIRequest = {
      prompt: `Task: ${issue.title}\nDescription: ${issue.description}\n\nPlease provide the work product as requested.`,
      systemPrompt: agent.systemPrompt,
      temperature: 0.7,
    };

    const response = await this.aiProviderService.generateResponse(provider, request);
    
    return {
      agentId: agent.id,
      issueId: issue.id,
      content: response.text,
      metadata: response.usage,
    };
  }
}
