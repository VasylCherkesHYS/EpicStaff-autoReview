export enum ProjectProcess {
  SEQUENTIAL = 'sequential',
  HIERARCHICAL = 'hierarchical',
}

// TODO: Replace with actual Agent interface when available
export interface AgentDto {
  id: number;
  [key: string]: unknown;
}

// TODO: Replace with actual Task interface when available
export interface TaskDto {
  id: number;
  [key: string]: unknown;
}

export interface ProjectDto {
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

export interface ProjectDetailDto extends ProjectDto {
  agents_data: AgentDto[];
  tasks_data: TaskDto[];
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

  static fromDto(dto: ProjectDto): Project {
    return new Project(
      dto.id,
      dto.name,
      dto.description,
      dto.process,
      dto.tasks,
      dto.agents,
      dto.tags,
      dto.memory,
      dto.config,
      dto.max_rpm,
      dto.cache,
      dto.full_output,
      dto.default_temperature,
      dto.planning,
      dto.similarity_threshold ?? null,
      dto.search_limit ?? null,
      dto.planning_llm_config,
      dto.manager_llm_config,
      dto.embedding_config,
      dto.memory_llm_config,
      dto.metadata ?? null,
      dto.is_template
    );
  }

  toDto(): ProjectDto {
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

export class ProjectDetail extends Project {
  constructor(
    base: Project,
    public agentsData: AgentDto[],
    public tasksData: TaskDto[]
  ) {
    super(
      base.id,
      base.name,
      base.description,
      base.process,
      base.tasks,
      base.agents,
      base.tags,
      base.memory,
      base.config,
      base.maxRpm,
      base.cache,
      base.fullOutput,
      base.defaultTemperature,
      base.planning,
      base.similarityThreshold,
      base.searchLimit,
      base.planningLlmConfig,
      base.managerLlmConfig,
      base.embeddingConfig,
      base.memoryLlmConfig,
      base.metadata,
      base.isTemplate
    );
  }

  static override fromDto(dto: ProjectDetailDto): ProjectDetail {
    const base = Project.fromDto(dto);
    return new ProjectDetail(base, dto.agents_data, dto.tasks_data);
  }
}
