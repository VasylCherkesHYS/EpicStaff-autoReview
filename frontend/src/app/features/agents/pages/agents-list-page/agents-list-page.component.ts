import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TabButtonComponent } from '../../../../shared/components/tab-button/tab-button.component';
import { AppIconComponent } from '../../../../shared/components/app-icon/app-icon.component';
import { SearchService } from '../../../../shared/services/search.service';

@Component({
  selector: 'app-agents-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agents-list-page.component.html',
  styleUrls: ['./agents-list-page.component.scss'],
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TabButtonComponent,
    FormsModule,
    AppIconComponent,
  ],
})
export class AgentsListPageComponent implements OnDestroy {
  private readonly searchService = inject(SearchService);

  readonly tabs = [
    { label: 'My Agents', link: 'my' },
    { label: 'Templates', link: 'templates' },
  ];
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
}

