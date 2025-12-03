import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
  DestroyRef,
  computed,
} from '@angular/core';
import { GetPythonCodeToolRequest } from '../../models/python-code-tool.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { CustomToolCardComponent } from './components/custom-tool-card/custom-tool-card.component';
import { HttpErrorResponse } from '@angular/common/http';
import { CustomToolsService } from '../../services/custom-tools/custom-tools.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { CustomToolDialogComponent } from '../../../../user-settings-page/tools/custom-tool-editor/custom-tool-dialog.component';
import { ToastService } from '../../../../services/notifications/toast.service';
import { ConfirmationDialogService } from '../../../../shared/components/cofirm-dialog/confimation-dialog.service';
import { ToolsEventsService } from '../../services/tools-events.service';
import { ToolsSearchService } from '../../services/tools-search.service';

@Component({
  selector: 'app-custom-tools',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './custom-tools.component.html',
  styleUrls: ['./custom-tools.component.scss'],
  imports: [LoadingSpinnerComponent, CustomToolCardComponent, DialogModule, CommonModule],
})
export class CustomToolsComponent implements OnInit {
  private readonly customToolsService = inject(CustomToolsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly toastService = inject(ToastService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly toolsEventsService = inject(ToolsEventsService);
  private readonly toolsSearchService = inject(ToolsSearchService);

  readonly searchTerm = signal<string>('');
  private readonly allTools = signal<GetPythonCodeToolRequest[]>([]);

  readonly error = signal<string | null>(null);
  readonly isLoaded = signal<boolean>(false);
  readonly tools = computed(() => {
    const tools = this.allTools().slice().sort((a, b) => b.id - a.id);
    const term = this.searchTerm();

    if (!term || term.trim() === '') {
      return tools;
    }

    const searchLower = term.toLowerCase();
    return tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(searchLower) ||
        tool.description.toLowerCase().includes(searchLower)
    );
  });

  ngOnInit(): void {
    this.loadTools();

    this.toolsEventsService.customToolCreated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((newTool) => {
        this.addNewTool(newTool);
      });

    this.toolsSearchService.searchTerm$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.searchTerm.set(term);
      });
  }

  private loadTools(): void {
    this.customToolsService
      .getPythonCodeTools()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tools) => {
          this.allTools.set(tools);
          this.isLoaded.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set('Failed to load custom tools. Please try again later.');
          this.isLoaded.set(true);
          console.error('Error loading custom tools:', err);
        },
      });
  }

  onConfigure(tool: GetPythonCodeToolRequest): void {
    const dialogRef = this.dialog.open<GetPythonCodeToolRequest>(CustomToolDialogComponent, {
      data: { pythonTools: this.tools(), selectedTool: tool },
    });

    dialogRef.closed.subscribe((result) => {
      if (result) {
        const currentTools = this.allTools();
        const index = currentTools.findIndex((t) => t.id === result.id);
        if (index !== -1) {
          const updatedTools = [...currentTools];
          updatedTools[index] = result;
          this.allTools.set(updatedTools);
        }
      }
    });
  }

  onDelete(tool: GetPythonCodeToolRequest): void {
    this.confirmationDialogService
      .confirmDelete(tool.name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.customToolsService
            .deletePythonCodeTool(tool.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                const currentTools = this.allTools();
                this.allTools.set(currentTools.filter((t) => t.id !== tool.id));
                this.toastService.success(`Tool "${tool.name}" has been deleted successfully.`);
              },
              error: (err: HttpErrorResponse) => {
                this.toastService.error(`Failed to delete tool "${tool.name}". Please try again.`);
                console.error('Error deleting tool:', err);
              },
            });
        }
      });
  }

  addNewTool(tool: GetPythonCodeToolRequest): void {
    const currentTools = this.allTools();
    this.allTools.set([tool, ...currentTools]);
  }
}

