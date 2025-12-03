import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/components/buttons/button/button.component';
import { TabButtonComponent } from '../../../../shared/components/tab-button/tab-button.component';
import { AppIconComponent } from '../../../../shared/components/app-icon/app-icon.component';
import { CreateProjectComponent } from '../../components/create-project-form-dialog/create-project.component';
import { Project } from '../../models/project.model';
import { SearchService } from '../../../../shared/services/search.service';

@Component({
    selector: 'app-projects-list-page',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './projects-list-page.component.html',
    styleUrls: ['./projects-list-page.component.scss'],
    imports: [
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
        ButtonComponent,
        TabButtonComponent,
        FormsModule,
        AppIconComponent,
    ],
})
export class ProjectsListPageComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly searchService = inject(SearchService);

  readonly tabs = [{ label: 'My templates', link: 'my' }];
  readonly searchTerm = signal('');

  ngOnDestroy(): void {
    this.searchService.clear();
    }

  onSearchTermChange(term: string): void {
    this.searchTerm.set(term);
    this.searchService.search(term);
    }

  clearSearch(): void {
    this.searchTerm.set('');
    this.searchService.clear();
  }

  openCreateProjectDialog(): void {
    const dialogRef = this.dialog.open<Project | undefined>(CreateProjectComponent, {
                maxWidth: '95vw',
                maxHeight: '90vh',
                autoFocus: true,
    });

    dialogRef.closed.subscribe((result) => {
            if (result) {
                this.router.navigate(['/projects', result.id]);
            }
        });
    }
}
