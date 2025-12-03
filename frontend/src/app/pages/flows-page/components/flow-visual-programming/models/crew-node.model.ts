import { Project } from '../../../../../features/projects/models/project.model';

export interface CrewNode {
  id: number;
  node_name: string;
  graph: number;
  crew: Project;
  input_map: Record<string, any>;
  output_variable_path: string | null;
}

export interface CreateCrewNodeRequest {
  node_name: string;
  graph: number;
  crew_id: number;
  input_map: Record<string, any>;
  output_variable_path: string | null;
}
