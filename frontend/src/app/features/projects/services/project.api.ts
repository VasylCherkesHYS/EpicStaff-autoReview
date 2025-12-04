import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ConfigService } from '../../../services/config/config.service';
import { ApiGetRequest } from '../../../shared/models/api-request.model';
import { Project, ProjectDto } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get url(): string {
    return this.config.apiUrl + 'crews/';
  }

  getProjects(): Observable<Project[]> {
    return this.http
      .get<ApiGetRequest<ProjectDto>>(this.url)
      .pipe(map((res) => res.results.map(Project.fromDto)));
  }

  //will return PROJECT DETAIL in future
  getProjectById(id: number): Observable<Project> {
    return this.http
      .get<ProjectDto>(`${this.url}${id}/`)
      .pipe(map(Project.fromDto));
  }

  create(data: Partial<ProjectDto>): Observable<Project> {
    return this.http
      .post<ProjectDto>(this.url, data)
      .pipe(map(Project.fromDto));
  }

  update(project: Project): Observable<Project> {
    const { id, ...payload } = project.toDto();
    return this.http
      .patch<ProjectDto>(`${this.url}${project.id}/`, payload)
      .pipe(map(Project.fromDto));
  }

  patch(id: number, updates: Partial<ProjectDto>): Observable<Project> {
    return this.http
      .patch<ProjectDto>(`${this.url}${id}/`, updates)
      .pipe(map(Project.fromDto));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}${id}/`);
  }

  copy(id: number): Observable<Project> {
    return this.http
      .post<ProjectDto>(`${this.url}${id}/copy/`, {})
      .pipe(map(Project.fromDto));
  }

  saveAsProject(id: number): Observable<Project> {
    return this.http
      .post<ProjectDto>(`${this.url}${id}/save_as_project/`, {})
      .pipe(map(Project.fromDto));
  }
}
