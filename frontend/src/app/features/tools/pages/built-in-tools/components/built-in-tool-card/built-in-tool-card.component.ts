import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Tool } from '../../../../models/tool.model';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../../../../../../shared/components/app-icon/app-icon.component';
import { TOOL_CATEGORIES_CONFIG } from '../../../../constants/built-in-tools-categories';
import { ToggleSwitchComponent } from '../../../../../../shared/components/form-controls/toggle-switch/toggle-switch.component';
import { ButtonComponent } from '../../../../../../shared/components/buttons/button/button.component';
import { TOOL_PROVIDERS_AND_DESCRIPTIONS } from '../../../../constants/tool-providers-and-descriptions';

@Component({
  selector: 'app-built-in-tool-card',
  standalone: true,
  imports: [CommonModule, AppIconComponent, ToggleSwitchComponent, ButtonComponent],
  templateUrl: './built-in-tool-card.component.html',
  styleUrls: ['./built-in-tool-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuiltInToolCardComponent {
  @Input() tool!: Tool;
  @Input() starred = false;
  @Output() configure = new EventEmitter<Tool>();
  @Output() enabledChange = new EventEmitter<{ tool: Tool; enabled: boolean }>();

  constructor(private cdr: ChangeDetectorRef) {}

  getCategoryConfig(): { name: string; icon: string; toolIds: number[] } {
    return (
      TOOL_CATEGORIES_CONFIG.find((cat) => cat.toolIds.includes(this.tool.id)) ||
      TOOL_CATEGORIES_CONFIG.find((cat) => cat.name === 'Other')!
    );
  }

  getCategory(): string {
    return this.getCategoryConfig().name;
  }

  getIconName(): string {
    return this.getCategoryConfig().icon;
  }

  get provider(): string {
    return TOOL_PROVIDERS_AND_DESCRIPTIONS[this.tool.id]?.provider || '';
  }

  get toolDescription(): string {
    return TOOL_PROVIDERS_AND_DESCRIPTIONS[this.tool.id]?.description || '';
  }

  get starIcon(): string {
    return this.starred ? 'ui/star-filled' : 'ui/star';
  }

  onConfigure(): void {
    this.configure.emit(this.tool);
  }

  onToggle(enabled: boolean): void {
    this.enabledChange.emit({ tool: this.tool, enabled });
  }

  onStar(): void {
    this.starred = !this.starred;
    this.cdr.markForCheck();
  }
}

