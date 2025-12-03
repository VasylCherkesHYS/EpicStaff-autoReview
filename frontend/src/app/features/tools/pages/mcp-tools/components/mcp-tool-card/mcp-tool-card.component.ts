import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { GetMcpToolRequest } from '../../../../models/mcp-tool.model';
import { AppIconComponent } from '../../../../../../shared/components/app-icon/app-icon.component';
import { ToggleSwitchComponent } from '../../../../../../shared/components/form-controls/toggle-switch/toggle-switch.component';
import { ButtonComponent } from '../../../../../../shared/components/buttons/button/button.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-mcp-tool-card',
  standalone: true,
  templateUrl: './mcp-tool-card.component.html',
  styleUrls: ['./mcp-tool-card.component.scss'],
  imports: [AppIconComponent, ToggleSwitchComponent, ButtonComponent, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class McpToolCardComponent {
  @Input() tool!: GetMcpToolRequest;
  @Input() enabled = false;
  @Input() starred = false;
  @Output() configure = new EventEmitter<GetMcpToolRequest>();
  @Output() toggle = new EventEmitter<{ tool: GetMcpToolRequest; enabled: boolean }>();
  @Output() star = new EventEmitter<{ tool: GetMcpToolRequest; starred: boolean }>();
  @Output() delete = new EventEmitter<GetMcpToolRequest>();

  constructor(private cdr: ChangeDetectorRef) {}

  get starIcon(): string {
    return this.starred ? 'ui/star-filled' : 'ui/star';
  }

  onConfigure(): void {
    this.configure.emit(this.tool);
  }

  onToggle(val: boolean): void {
    this.enabled = val;
    this.toggle.emit({ tool: this.tool, enabled: val });
  }

  onStar(): void {
    this.starred = !this.starred;
    this.cdr.markForCheck();
    this.star.emit({ tool: this.tool, starred: this.starred });
  }

  onDelete(): void {
    this.delete.emit(this.tool);
  }
}

