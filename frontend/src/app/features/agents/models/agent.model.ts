export interface AgentResponse {
  id: number;
  role: string;
  goal: string;
  backstory: string;
  configured_tools: number[];
  python_code_tools: number[];
  mcp_tools: number[];
  llm_config: number | null;
  fcm_llm_config: number | null;
  allow_delegation: boolean;
  memory: boolean;
  max_iter: number;
  max_rpm: number | null;
  max_execution_time: number | null;
  cache: boolean | null;
  allow_code_execution: boolean | null;
  max_retry_limit: number | null;
  respect_context_window: boolean | null;
  default_temperature: number | null;
  knowledge_collection: number | null;
  search_limit: number | null;
  similarity_threshold: string | null;
  is_template: boolean;
}

export class Agent {
  constructor(
    public id: number,
    public role: string,
    public goal: string,
    public backstory: string,
    public configuredTools: number[],
    public pythonCodeTools: number[],
    public mcpTools: number[],
    public llmConfig: number | null,
    public fcmLlmConfig: number | null,
    public allowDelegation: boolean,
    public memory: boolean,
    public maxIter: number,
    public maxRpm: number | null,
    public maxExecutionTime: number | null,
    public cache: boolean | null,
    public allowCodeExecution: boolean | null,
    public maxRetryLimit: number | null,
    public respectContextWindow: boolean | null,
    public defaultTemperature: number | null,
    public knowledgeCollection: number | null,
    public searchLimit: number | null,
    public similarityThreshold: string | null,
    public isTemplate: boolean
  ) {}

  static fromResponse(data: AgentResponse): Agent {
    return new Agent(
      data.id,
      data.role,
      data.goal,
      data.backstory,
      data.configured_tools,
      data.python_code_tools,
      data.mcp_tools,
      data.llm_config,
      data.fcm_llm_config,
      data.allow_delegation,
      data.memory,
      data.max_iter,
      data.max_rpm,
      data.max_execution_time,
      data.cache,
      data.allow_code_execution,
      data.max_retry_limit,
      data.respect_context_window,
      data.default_temperature,
      data.knowledge_collection,
      data.search_limit,
      data.similarity_threshold,
      data.is_template
    );
  }

  toPayload() {
    return {
      role: this.role,
      goal: this.goal,
      backstory: this.backstory,
      configured_tools: this.configuredTools,
      python_code_tools: this.pythonCodeTools,
      mcp_tools: this.mcpTools,
      llm_config: this.llmConfig,
      fcm_llm_config: this.fcmLlmConfig,
      allow_delegation: this.allowDelegation,
      memory: this.memory,
      max_iter: this.maxIter,
      max_rpm: this.maxRpm,
      max_execution_time: this.maxExecutionTime,
      cache: this.cache,
      allow_code_execution: this.allowCodeExecution,
      max_retry_limit: this.maxRetryLimit,
      respect_context_window: this.respectContextWindow,
      default_temperature: this.defaultTemperature,
      knowledge_collection: this.knowledgeCollection,
      search_limit: this.searchLimit,
      similarity_threshold: this.similarityThreshold,
      is_template: this.isTemplate,
    };
  }
}

