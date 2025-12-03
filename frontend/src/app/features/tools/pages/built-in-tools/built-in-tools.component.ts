import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
  computed,
  DestroyRef,
} from '@angular/core';
import { Tool } from '../../models/tool.model';
import { BuiltInToolCardComponent } from './components/built-in-tool-card/built-in-tool-card.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { HttpErrorResponse } from '@angular/common/http';
import { CategoryButtonComponent } from './components/category-button/category-button.component';
import { TOOL_CATEGORIES_CONFIG } from '../../constants/built-in-tools-categories';
import { BuiltinToolsService } from '../../services/builtin-tools/builtin-tools.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog } from '@angular/cdk/dialog';
import { ToolConfigurationDialogComponent } from '../../../../user-settings-page/tools/tool-configuration-dialog/tool-configuration-dialog.component';
import { ToastService } from '../../../../services/notifications/toast.service';

@Component({
  selector: 'app-built-in-tools',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './built-in-tools.component.html',
  styleUrls: ['./built-in-tools.component.scss'],
  imports: [
    BuiltInToolCardComponent,
    LoadingSpinnerComponent,
    CategoryButtonComponent,
  ],
})
export class BuiltInToolsComponent implements OnInit {
  private readonly builtinToolsService = inject(BuiltinToolsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly toastService = inject(ToastService);

  private readonly allTools = signal<Tool[]>([]);
  private readonly selectedCategorySignal = signal<string | null>(null);

  readonly error = signal<string | null>(null);
  readonly isLoaded = signal<boolean>(false);
  readonly selectedCategory = computed(() => this.selectedCategorySignal());
  readonly filteredTools = computed(() => {
    const tools = this.allTools();
    const category = this.selectedCategorySignal();

    if (!category) {
      return tools.slice().sort((a, b) => b.id - a.id);
    }

    const categoryConfig = TOOL_CATEGORIES_CONFIG.find((cat) => cat.name === category);
    if (!categoryConfig) {
      return tools.slice().sort((a, b) => b.id - a.id);
    }

    return tools
      .filter((tool) => categoryConfig.toolIds.includes(tool.id))
      .sort((a, b) => b.id - a.id);
  });
  readonly TOOL_CATEGORIES_CONFIG = TOOL_CATEGORIES_CONFIG;

  ngOnInit(): void {
    this.loadTools();
  }

  toggleCategory(category: string): void {
    const currentCategory = this.selectedCategory();
    if (currentCategory === category) {
      this.selectedCategorySignal.set(null);
    } else {
      this.selectedCategorySignal.set(category);
    }
  }

  onToolConfigure(tool: Tool): void {
    const dialogRef = this.dialog.open(ToolConfigurationDialogComponent, {
      data: { tool },
    });

    dialogRef.closed.subscribe((result) => {
      if (result) {
        console.log('Tool configuration updated:', result);
      }
    });
  }

  onToolEnabledChange(event: { tool: Tool; enabled: boolean }): void {
    const { tool, enabled } = event;

    const updatedTool: Tool = { ...tool, enabled };

    this.builtinToolsService
      .updateTool(updatedTool)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          const currentTools = this.allTools();
          const index = currentTools.findIndex((t) => t.id === updated.id);
          if (index !== -1) {
            const updatedTools = [...currentTools];
            updatedTools[index] = updated;
            this.allTools.set(updatedTools);
          }

          const message = enabled
            ? `Tool "${updated.name}" has been activated successfully`
            : `Tool "${updated.name}" has been deactivated`;

          this.toastService.success(message, 3000, 'bottom-right');
        },
        error: () => {
          this.toastService.error(
            `Failed to ${enabled ? 'activate' : 'deactivate'} tool "${tool.name}"`,
            5000,
            'bottom-right'
          );
        },
      });
  }

  private loadTools(): void {
    this.builtinToolsService
      .getTools()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tools) => {
          this.allTools.set(tools);
          this.isLoaded.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set('Failed to load tools. Please try again later.');
          this.isLoaded.set(true);
          console.error('Error loading built-in tools:', err);
        },
      });
  }
}

