import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
  DestroyRef,
  computed,
} from '@angular/core';
import { GetMcpToolRequest } from '../../models/mcp-tool.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { McpToolCardComponent } from './components/mcp-tool-card/mcp-tool-card.component';
import { HttpErrorResponse } from '@angular/common/http';
import { McpToolsService } from '../../services/mcp-tools/mcp-tools.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../../services/notifications/toast.service';
import { ConfirmationDialogService } from '../../../../shared/components/cofirm-dialog/confimation-dialog.service';
import { McpToolDialogComponent } from '../../components/mcp-tool-dialog/mcp-tool-dialog.component';
import { ToolsEventsService } from '../../services/tools-events.service';
import { ToolsSearchService } from '../../services/tools-search.service';

@Component({
  selector: 'app-mcp-tools',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mcp-tools.component.html',
  styleUrls: ['./mcp-tools.component.scss'],
  imports: [LoadingSpinnerComponent, McpToolCardComponent, DialogModule, CommonModule],
})
export class McpToolsComponent implements OnInit {
  private readonly mcpToolsService = inject(McpToolsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly toastService = inject(ToastService);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private readonly toolsEventsService = inject(ToolsEventsService);
  private readonly toolsSearchService = inject(ToolsSearchService);

  readonly searchTerm = signal<string>('');
  private readonly allTools = signal<GetMcpToolRequest[]>([]);

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
        tool.tool_name.toLowerCase().includes(searchLower) ||
        tool.transport.toLowerCase().includes(searchLower)
    );
  });

  ngOnInit(): void {
    this.loadTools();

    this.toolsEventsService.mcpToolCreated$
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
    this.mcpToolsService
      .getMcpTools()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tools) => {
          this.allTools.set(tools);
          this.isLoaded.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set('Failed to load MCP tools. Please try again later.');
          this.isLoaded.set(true);
          console.error('Error loading MCP tools:', err);
        },
      });
  }

  onConfigure(tool: GetMcpToolRequest): void {
    const dialogRef = this.dialog.open<GetMcpToolRequest>(McpToolDialogComponent, {
      data: { selectedTool: tool },
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: true,
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

  onDelete(tool: GetMcpToolRequest): void {
    this.confirmationDialogService
      .confirmDelete(tool.name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.mcpToolsService
            .deleteMcpTool(tool.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                const currentTools = this.allTools();
                this.allTools.set(currentTools.filter((t) => t.id !== tool.id));
                this.toastService.success(`MCP tool "${tool.name}" has been deleted successfully.`);
              },
              error: (err: HttpErrorResponse) => {
                this.toastService.error(`Failed to delete MCP tool "${tool.name}". Please try again.`);
                console.error('Error deleting MCP tool:', err);
              },
            });
        }
      });
  }

  refreshTools(): void {
    this.isLoaded.set(false);
    this.error.set(null);
    this.loadTools();
  }

  addNewTool(tool: GetMcpToolRequest): void {
    const currentTools = this.allTools();
    this.allTools.set([tool, ...currentTools]);
  }
}

