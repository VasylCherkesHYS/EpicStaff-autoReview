import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ConfigService } from '../../../services/config/config.service';
import { ApiGetRequest } from '../../../shared/models/api-request.model';
import { Project, ProjectResponse } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get url(): string {
    return this.config.apiUrl + 'crews/';
  }

  getProjects(): Observable<Project[]> {
    return this.http
      .get<ApiGetRequest<ProjectResponse>>(this.url)
      .pipe(map((res) => res.results.map(Project.fromResponse)));
  }

  getProjectById(id: number): Observable<Project> {
    return this.http
      .get<ProjectResponse>(`${this.url}${id}/`)
      .pipe(map(Project.fromResponse));
  }

  create(project: Project): Observable<Project> {
    return this.http
      .post<ProjectResponse>(this.url, project.toPayload())
      .pipe(map(Project.fromResponse));
  }

  update(project: Project): Observable<Project> {
    return this.http
      .patch<ProjectResponse>(`${this.url}${project.id}/`, project.toPayload())
      .pipe(map(Project.fromResponse));
  }

  patch(id: number, updates: Partial<ProjectResponse>): Observable<Project> {
    return this.http
      .patch<ProjectResponse>(`${this.url}${id}/`, updates)
      .pipe(map(Project.fromResponse));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}${id}/`);
  }

  copy(id: number): Observable<Project> {
    return this.http
      .post<ProjectResponse>(`${this.url}${id}/copy/`, {})
      .pipe(map(Project.fromResponse));
  }

  saveAsProject(id: number): Observable<Project> {
    return this.http
      .post<ProjectResponse>(`${this.url}${id}/save_as_project/`, {})
      .pipe(map(Project.fromResponse));
  }
}

