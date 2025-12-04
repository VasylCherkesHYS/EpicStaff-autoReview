import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { GetPythonCodeToolRequest } from '../../../../../../features/tools/models/python-code-tool.model';
import { PythonCodeToolConfig } from '../../../../../../features/tools/models/tool_config.model';
import { AppIconComponent } from '../../../../../../shared/components/app-icon/app-icon.component';
import { animate, style, transition, trigger } from '@angular/animations';

export interface FullPythonTool extends GetPythonCodeToolRequest {
  toolConfigs: PythonCodeToolConfig[];
}

@Component({
  selector: 'app-python-tool-item',
  standalone: true,
  imports: [NgClass, NgFor, NgIf, AppIconComponent],
  template: `
    <div class="python-tool-item-container">
      <div
        class="python-tool-item"
        [ngClass]="{ 'selected-tool': isSelected }"
        (click)="hasConfigs ? toggleToolConfigs() : onToolToggle()"
      >
        <app-icon icon="ui/python" size="16px"></app-icon>
        <span class="tool-name">{{ tool.name }}</span>

        <!-- Chevron for tools with configs -->
        <span
          *ngIf="hasConfigs"
          class="chevron-icon"
          [ngClass]="{ expanded: isExpanded }"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>

        <!-- Checkbox for tools without configs -->
        <input
          *ngIf="!hasConfigs"
          type="checkbox"
          [checked]="isSelected"
          (click)="$event.stopPropagation(); onToolToggle()"
        />
      </div>

      <!-- Expanded configs section -->
      <div
        class="tool-configs"
        *ngIf="isExpanded && hasConfigs"
        @expandCollapse
      >
        <div
          class="tool-config-item"
          *ngFor="let config of tool.toolConfigs"
          [ngClass]="{ 'selected-config': selectedConfigIds.has(config.id) }"
          (click)="onConfigToggle(config)"
        >
          <span class="config-name">{{ config.name }}</span>
          <input
            type="checkbox"
            [checked]="selectedConfigIds.has(config.id)"
            (click)="$event.stopPropagation(); onConfigToggle(config)"
          />
        </div>
        <div *ngIf="tool.toolConfigs.length === 0" class="no-config-message">
          No configurations available
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./python-tool-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('expandCollapse', [
      transition(':enter', [
        style({ height: '0', opacity: 0 }),
        animate(
          '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ height: '*', opacity: 1 })
        ),
      ]),
      transition(':leave', [
        style({ height: '*', opacity: 1 }),
        animate('200ms ease-out', style({ height: '0', opacity: 0 })),
      ]),
    ]),
  ],
})
export class PythonToolItemComponent {
  @Input() public tool!: FullPythonTool;
  @Input() public isSelected = false;
  @Input() public isExpanded = false;
  @Input() public selectedConfigIds: Set<number> = new Set<number>();

  @Output() public toolToggled = new EventEmitter<FullPythonTool>();
  @Output() public configToggled = new EventEmitter<PythonCodeToolConfig>();
  @Output() public toolConfigsToggled = new EventEmitter<FullPythonTool>();

  get hasConfigs(): boolean {
    return this.tool.tool_fields && this.tool.tool_fields.length > 0;
  }

  public onToolToggle(): void {
    this.toolToggled.emit(this.tool);
  }

  public toggleToolConfigs(): void {
    this.toolConfigsToggled.emit(this.tool);
  }

  public onConfigToggle(config: PythonCodeToolConfig): void {
    this.configToggled.emit(config);
  }

  public onCheckboxClick(event: Event): void {
    event.stopPropagation();
    this.toolToggled.emit(this.tool);
  }
}
