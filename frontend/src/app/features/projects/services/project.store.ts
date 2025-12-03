import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { ProjectApi } from './project.api';
import { Project } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectStore {
  private readonly api = inject(ProjectApi);

  private readonly _projectsSig = signal<Project[] | null>(null);

  readonly projectsSig = computed(() => this._projectsSig() ?? []);
  readonly loadedSig = computed(() => this._projectsSig() !== null);
  readonly templatesSig = computed(() => this.projectsSig().filter((p) => p.isTemplate));
  readonly myProjectsSig = computed(() => this.projectsSig().filter((p) => !p.isTemplate));

  getProjects(fresh = false): Observable<Project[]> {
    if (this._projectsSig() && !fresh) {
      return of(this.projectsSig());
    }
    return this.api.getProjects().pipe(tap((projects) => this._projectsSig.set(projects)));
  }

  getProjectById(id: number): Observable<Project> {
    const cached = this._projectsSig()?.find(p => p.id === id);
    if (cached) {
      return of(cached);
    }
    return this.api.getProjectById(id).pipe(
      tap((project) => {
        this._projectsSig.update((p) => {
          const exists = (p ?? []).some(x => x.id === id);
          if (!exists) {
            return [...(p ?? []), project];
          }
          return (p ?? []).map(x => x.id === id ? project : x);
        });
      })
    );
  }

  create(project: Project): Observable<Project> {
    return this.api.create(project).pipe(
      tap((created) => {
        this._projectsSig.update((p) => [...(p ?? []), created]);
      })
    );
  }

  update(project: Project): Observable<Project> {
    return this.api.update(project).pipe(
      tap((updated) => {
        this._projectsSig.update((p) =>
          (p ?? []).map((x) => (x.id === updated.id ? updated : x))
        );
      })
    );
  }

  patch(id: number, updates: Partial<import('../models/project.model').ProjectResponse>): Observable<Project> {
    return this.api.patch(id, updates).pipe(
      tap((updated) => {
        this._projectsSig.update((p) =>
          (p ?? []).map((x) => (x.id === updated.id ? updated : x))
        );
      })
    );
  }

  delete(id: number): Observable<void> {
    return this.api.delete(id).pipe(
      tap(() => {
        this._projectsSig.update((p) => (p ?? []).filter((x) => x.id !== id));
      })
    );
  }

  copy(id: number): Observable<Project> {
    return this.api.copy(id).pipe(
      tap((copied) => {
        this._projectsSig.update((p) => [...(p ?? []), copied]);
      })
    );
  }

  saveAsProject(id: number): Observable<Project> {
    return this.api.saveAsProject(id).pipe(
      tap((saved) => {
        this._projectsSig.update((p) => [...(p ?? []), saved]);
      })
    );
  }
}
