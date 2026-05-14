import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AppSvgIconComponent } from '../../../../shared/components/app-svg-icon/app-svg-icon.component';
import { ButtonComponent } from '../../../../shared/components/buttons/button/button.component';
import { HideInlineSubtitleOnOverflowDirective } from '../../../../shared/directives/hide-inline-subtitle-on-overflow.directive';
import { CreateProjectComponent } from '../../components/create-project-form-dialog/create-project.component';
import { GetProjectRequest } from '../../models/project.model';
import { ProjectsStorageService } from '../../services/projects-storage.service';
import { TemplatesListComponent } from './components/templates-list/templates-list.component';

@Component({
    selector: 'app-projects-list-page',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './projects-list-page.component.html',
    styleUrls: ['./projects-list-page.component.scss'],
    imports: [
        ButtonComponent,
        FormsModule,
        AppSvgIconComponent,
        HideInlineSubtitleOnOverflowDirective,
        TemplatesListComponent,
    ],
})
export class ProjectsListPageComponent implements OnDestroy {
    public searchTerm: string = '';

    private searchTerms = new Subject<string>();
    private subscription: Subscription;

    constructor(
        public router: Router,
        private dialog: Dialog,
        private projectsService: ProjectsStorageService
    ) {
        this.subscription = this.searchTerms.pipe(debounceTime(300), distinctUntilChanged()).subscribe((term) => {
            this.updateFilter(term);
        });
    }

    ngOnDestroy(): void {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }

        this.searchTerm = '';
        this.projectsService.setFilter(null);
    }

    public onSearchTermChange(term: string): void {
        this.searchTerms.next(term);
    }

    public clearSearch(): void {
        this.searchTerm = '';
        this.updateFilter('');
    }

    private updateFilter(searchTerm: string): void {
        const filter = {
            searchTerm,
            selectedTagIds: this.projectsService.getCurrentFilter()?.selectedTagIds || [],
        };
        this.projectsService.setFilter(filter);
    }

    public openCreateTemplateDialog(): void {
        const dialogRef = this.dialog.open<GetProjectRequest | undefined>(CreateProjectComponent, {
            maxWidth: '95vw',
            maxHeight: '90vh',
            autoFocus: true,
            data: { isTemplate: true },
        });
        dialogRef.closed.subscribe((result: GetProjectRequest | undefined) => {
            if (result) {
                this.router.navigate(['/templates', result.id]);
            }
        });
    }
}
