import { ChangeDetectionStrategy, Component, ChangeDetectorRef, inject, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { TabButtonComponent } from '../../../../shared/components/tab-button/tab-button.component';
import { ButtonComponent } from '../../../../shared/components/buttons/button/button.component';
import { CustomToolDialogComponent } from '../../../../user-settings-page/tools/custom-tool-editor/custom-tool-dialog.component';
import { CustomToolsService } from '../../services/custom-tools/custom-tools.service';
import { GetPythonCodeToolRequest } from '../../models/python-code-tool.model';
import { FormsModule } from '@angular/forms';
import { AppIconComponent } from '../../../../shared/components/app-icon/app-icon.component';
import { McpToolDialogComponent } from '../../components/mcp-tool-dialog/mcp-tool-dialog.component';
import { GetMcpToolRequest } from '../../models/mcp-tool.model';
import { ToolsEventsService } from '../../services/tools-events.service';
import { SearchService } from '../../../../shared/services/search.service';

@Component({
  selector: 'app-tools-list-page',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TabButtonComponent,
    ButtonComponent,
    FormsModule,
    AppIconComponent,
  ],
  templateUrl: './tools-list-page.component.html',
  styleUrls: ['./tools-list-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolsListPageComponent implements OnDestroy {
  private readonly cdkDialog = inject(Dialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly customToolsService = inject(CustomToolsService);
  private readonly toolsEventsService = inject(ToolsEventsService);
  private readonly searchService = inject(SearchService);

  readonly tabs = [
    { label: 'Built-in', link: 'built-in' },
    { label: 'Custom', link: 'custom' },
    { label: 'MCP', link: 'mcp' },
  ];

  readonly searchTerm = this.searchService.rawTerm;

  get isCustomTabActive(): boolean {
    return this.router.url.includes('/custom');
  }

  get isMcpTabActive(): boolean {
    return this.router.url.includes('/mcp');
  }

  get createButtonLabel(): string {
    if (this.isMcpTabActive) {
      return 'Add MCP tool';
    }
    return 'Create custom tool';
  }

  get createButtonIcon(): string {
    return 'ui/plus';
  }

  ngOnDestroy(): void {
    this.searchService.clear();
  }

  onSearchTermChange(term: string): void {
    this.searchService.search(term);
  }

  clearSearch(): void {
    this.searchService.clear();
  }

  onCreateToolClick(): void {
    if (this.isMcpTabActive) {
      this.openMcpToolDialog();
    } else {
      this.openCustomToolDialog();
    }
  }

  openCustomToolDialog(): void {
    this.customToolsService.getPythonCodeTools().subscribe((tools) => {
      const dialogRef = this.cdkDialog.open<GetPythonCodeToolRequest>(CustomToolDialogComponent, {
        data: { pythonTools: tools },
      });

      dialogRef.closed.subscribe((result) => {
        if (result) {
          this.toolsEventsService.emitCustomToolCreated(result);
          this.router.navigate(['/tools/custom']);
          this.cdr.markForCheck();
        }
      });
    });
  }

  openMcpToolDialog(): void {
    const dialogRef = this.cdkDialog.open<GetMcpToolRequest>(McpToolDialogComponent, {
      data: {},
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: true,
    });

    dialogRef.closed.subscribe((result) => {
      if (result) {
        this.toolsEventsService.emitMcpToolCreated(result);
        this.router.navigate(['/tools/mcp']);
        this.cdr.markForCheck();
      }
    });
  }
}
