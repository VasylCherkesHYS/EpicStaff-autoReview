import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { FullAgent, FullAgentService } from '../../services/full-agent.service';
import { FullTask } from '../../shared/models/full-task.model';
import { Project, ProjectDto } from '../../features/projects/models/project.model';
import { ProjectStore } from '../../features/projects/services/project.store';
import { ToastService } from '../../services/notifications/toast.service';

@Injectable()
export class ProjectStateService {
    private projectSubject = new BehaviorSubject<ProjectDto | null>(null);
    private tasksSubject = new BehaviorSubject<FullTask[]>([]);
    private agentsSubject = new BehaviorSubject<FullAgent[]>([]);

    // Computed properties for counts
    public taskCount = signal<number>(0);
    public agentCount = signal<number>(0);

    // Expose the current tasks and agents as observable streams (for compatibility)
    public tasks$ = this.tasksSubject.asObservable();
    public agents$ = this.agentsSubject.asObservable();
    public project$ = this.projectSubject.asObservable();

    constructor(
        private projectStore: ProjectStore,
        private toastService: ToastService,
        private fullAgentService: FullAgentService
    ) {
        // Subscribe to update signal counts
        this.tasksSubject.subscribe((tasks) => {
            this.taskCount.set(tasks.length);
        });
        this.agentsSubject.subscribe((agents) => {
            this.agentCount.set(agents.length);
        });
    }

    setProject(project: ProjectDto | null): void {
        this.projectSubject.next(project);
    }

    // Update tasks state
    updateTasks(tasks: FullTask[]): void {
        this.tasksSubject.next(tasks);
    }

    // Update agents state
    updateAgents(agents: FullAgent[]): void {
        this.agentsSubject.next(agents);
    }

    updateProjectField<K extends keyof ProjectDto>(
        projectId: number,
        fieldName: K,
        fieldValue: ProjectDto[K]
    ): Observable<ProjectDto> {
        const updateData: Partial<ProjectDto> = {
            [fieldName]: fieldValue,
        };

        return this.projectStore.patch(projectId, updateData).pipe(
            tap((updatedProject: Project) => {
                this.projectSubject.next(updatedProject.toDto());
            }),
            map((project: Project) => project.toDto())
            );
    }

    public addAgent(newAgent: FullAgent): void {
        const currentAgents = this.agentsSubject.getValue();
        const updatedAgents = [...currentAgents, newAgent];
        this.agentsSubject.next(updatedAgents);

        // Extract the IDs of all agents
        const agentIds = updatedAgents.map((agent) => agent.id);

        const currentProject = this.projectSubject.getValue();
        if (currentProject) {
            this.projectStore
                .patch(currentProject.id, { agents: agentIds })
                .subscribe({
                    next: (updatedProject: Project) => {
                        this.projectSubject.next(updatedProject.toDto());
                    },
                    error: (error: any) => {
                        console.error('Error updating project agents:', error);
                        this.agentsSubject.next(currentAgents);
                    },
                });
        }
    }

    public removeAgent(agentToRemove: FullAgent): void {
        const currentAgents = this.agentsSubject.getValue();
        const updatedAgents = currentAgents.filter(
            (agent) => agent.id !== agentToRemove.id
        );
        this.agentsSubject.next(updatedAgents);

        // Update tasks that were assigned to the removed agent
        const currentTasks = this.tasksSubject.getValue();
        const updatedTasks = currentTasks.map((task) => {
            if (task.agent === agentToRemove.id) {
                return {
                    ...task,
                    agent: null,
                    agentData: null,
                };
            }
            return task;
        });
        this.tasksSubject.next(updatedTasks);

        // Extract the IDs of remaining agents
        const agentIds = updatedAgents.map((agent) => agent.id);

        const currentProject = this.projectSubject.getValue();
        if (currentProject) {
            this.projectStore
                .patch(currentProject.id, { agents: agentIds })
                .subscribe({
                    next: (updatedProject: Project) => {
                        this.projectSubject.next(updatedProject.toDto());
                        this.toastService.success('Agent removed successfully');
                    },
                    error: (error: any) => {
                        console.error('Error updating project agents:', error);
                        this.agentsSubject.next(currentAgents);
                        this.tasksSubject.next(currentTasks);
                        this.toastService.error('Error removing agent');
                    },
                });
        }
    }

    // Refresh a single agent with full details
    public refreshAgent(agentId: number): void {
        this.fullAgentService.getFullAgentById(agentId).subscribe({
            next: (refreshedAgent: FullAgent | null) => {
                if (refreshedAgent) {
                    const currentAgents = this.agentsSubject.getValue();
                    const updatedAgents = [...currentAgents];
                    const index = updatedAgents.findIndex(
                        (a) => a.id === agentId
                    );

                    if (index !== -1) {
                        // Replace the agent with the refreshed one
                        updatedAgents[index] = refreshedAgent;
                        this.agentsSubject.next(updatedAgents);
                        this.toastService.success('Agent updated successfully');
                    }
                }
            },
            error: (error: any) => {
                console.error('Error refreshing agent:', error);
                this.toastService.error('Error updating agent');
            },
        });
    }

    // Add a new task
    addTask(newTask: FullTask): void {
        const currentTasks = this.tasksSubject.getValue();
        this.tasksSubject.next([...currentTasks, newTask]);
    }

    // Update an existing task by its ID
    updateTask(updatedTask: FullTask): void {
        const currentTasks = this.tasksSubject.getValue();
        const taskIndex = currentTasks.findIndex(
            (task) => task.id === updatedTask.id
        );
        if (taskIndex !== -1) {
            currentTasks[taskIndex] = updatedTask;
            this.tasksSubject.next([...currentTasks]);
        }
    }

    // Delete a task by its ID
    deleteTask(taskId: number): void {
        const currentTasks = this.tasksSubject.getValue();
        const updatedTasks = currentTasks.filter((task) => task.id !== taskId);
        this.tasksSubject.next(updatedTasks);
    }
}
