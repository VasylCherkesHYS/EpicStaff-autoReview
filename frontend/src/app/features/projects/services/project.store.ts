import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { ProjectApi } from './project.api';
import { Project, ProjectDto } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectStore {
  private readonly api = inject(ProjectApi);

  private readonly _projects = signal<Project[]>([]);
  private readonly _loaded = signal(false);

  readonly projects = this._projects.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly templatesSig = computed(() => this._projects().filter((p) => p.isTemplate));
  readonly myProjectsSig = computed(() => this._projects().filter((p) => !p.isTemplate));

  getProjects(fresh = false): Observable<Project[]> {
    if (this._loaded() && !fresh) {
      return of(this._projects());
    }
    return this.api.getProjects().pipe(
      tap((projects) => {
        this._projects.set(projects);
        this._loaded.set(true);
      })
    );
  }

  getProjectById(id: number): Observable<Project> {
    return this.api.getProjectById(id).pipe(
      tap((project) => {
        this._projects.update((p) => {
          const exists = p.some(x => x.id === id);
          if (!exists) {
            return [...p, project];
          }
          return p.map(x => x.id === id ? project : x);
        });
      })
    );
  }

  create(data: Partial<ProjectDto>): Observable<Project> {
    return this.api.create(data).pipe(
      tap((created) => {
        this._projects.update((p) => [...p, created]);
      })
    );
  }

  update(project: Project): Observable<Project> {
    return this.api.update(project).pipe(
      tap((updated) => {
        this._projects.update((p) =>
          p.map((x) => (x.id === updated.id ? updated : x))
        );
      })
    );
  }

  patch(id: number, updates: Partial<ProjectDto>): Observable<Project> {
    return this.api.patch(id, updates).pipe(
      tap((updated) => {
        this._projects.update((p) =>
          p.map((x) => (x.id === updated.id ? updated : x))
        );
      })
    );
  }

  delete(id: number): Observable<void> {
    return this.api.delete(id).pipe(
      tap(() => {
        this._projects.update((p) => p.filter((x) => x.id !== id));
      })
    );
  }

  copy(id: number): Observable<Project> {
    return this.api.copy(id).pipe(
      tap((copied) => {
        this._projects.update((p) => [...p, copied]);
      })
    );
  }

  saveAsProject(id: number): Observable<Project> {
    return this.api.saveAsProject(id).pipe(
      tap((saved) => {
        this._projects.update((p) => [...p, saved]);
      })
    );
  }
}
