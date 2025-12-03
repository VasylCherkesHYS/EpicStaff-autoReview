export enum ProjectProcess {
  SEQUENTIAL = 'sequential',
  HIERARCHICAL = 'hierarchical',
}

export interface ProjectResponse {
  id: number;
  name: string;
  description: string | null;
  process: ProjectProcess;
  tasks: number[];
  agents: number[];
  tags: number[];
  memory: boolean | null;
  config: unknown | null;
  max_rpm: number | null;
  cache: boolean | null;
  full_output: boolean;
  default_temperature: number | null;
  planning: boolean;
  similarity_threshold?: string | null;
  search_limit?: number | null;
  planning_llm_config: number | null;
  manager_llm_config: number | null;
  embedding_config: number | null;
  memory_llm_config: number | null;
  metadata?: unknown | null;
  is_template: boolean;
}

export class Project {
  constructor(
    public id: number,
    public name: string,
    public description: string | null,
    public process: ProjectProcess,
    public tasks: number[],
    public agents: number[],
    public tags: number[],
    public memory: boolean | null,
    public config: unknown | null,
    public maxRpm: number | null,
    public cache: boolean | null,
    public fullOutput: boolean,
    public defaultTemperature: number | null,
    public planning: boolean,
    public similarityThreshold: string | null,
    public searchLimit: number | null,
    public planningLlmConfig: number | null,
    public managerLlmConfig: number | null,
    public embeddingConfig: number | null,
    public memoryLlmConfig: number | null,
    public metadata: unknown | null,
    public isTemplate: boolean
  ) {}

  static fromResponse(data: ProjectResponse): Project {
    return new Project(
      data.id,
      data.name,
      data.description,
      data.process,
      data.tasks,
      data.agents,
      data.tags,
      data.memory,
      data.config,
      data.max_rpm,
      data.cache,
      data.full_output,
      data.default_temperature,
      data.planning,
      data.similarity_threshold ?? null,
      data.search_limit ?? null,
      data.planning_llm_config,
      data.manager_llm_config,
      data.embedding_config,
      data.memory_llm_config,
      data.metadata ?? null,
      data.is_template
    );
  }

  toPayload() {
    return {
      name: this.name,
      description: this.description,
      process: this.process,
      tasks: this.tasks,
      agents: this.agents,
      tags: this.tags,
      memory: this.memory,
      config: this.config,
      max_rpm: this.maxRpm,
      cache: this.cache,
      full_output: this.fullOutput,
      default_temperature: this.defaultTemperature,
      planning: this.planning,
      planning_llm_config: this.planningLlmConfig,
      manager_llm_config: this.managerLlmConfig,
      embedding_config: this.embeddingConfig,
      memory_llm_config: this.memoryLlmConfig,
      metadata: this.metadata,
      similarity_threshold: this.similarityThreshold,
      search_limit: this.searchLimit,
      is_template: this.isTemplate,
    };
  }

  /** Converts to API format (snake_case). Used for backwards compatibility with open-project-page components. */
  toResponse(): ProjectResponse {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      process: this.process,
      tasks: this.tasks,
      agents: this.agents,
      tags: this.tags,
      memory: this.memory,
      config: this.config,
      max_rpm: this.maxRpm,
      cache: this.cache,
      full_output: this.fullOutput,
      default_temperature: this.defaultTemperature,
      planning: this.planning,
      similarity_threshold: this.similarityThreshold,
      search_limit: this.searchLimit,
      planning_llm_config: this.planningLlmConfig,
      manager_llm_config: this.managerLlmConfig,
      embedding_config: this.embeddingConfig,
      memory_llm_config: this.memoryLlmConfig,
      metadata: this.metadata,
      is_template: this.isTemplate,
    };
  }
}
