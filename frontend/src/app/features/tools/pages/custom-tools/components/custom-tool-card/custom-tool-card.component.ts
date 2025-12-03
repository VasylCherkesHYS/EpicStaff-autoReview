import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { GetPythonCodeToolRequest } from '../../../../models/python-code-tool.model';
import { AppIconComponent } from '../../../../../../shared/components/app-icon/app-icon.component';
import { ToggleSwitchComponent } from '../../../../../../shared/components/form-controls/toggle-switch/toggle-switch.component';
import { ButtonComponent } from '../../../../../../shared/components/buttons/button/button.component';

@Component({
  selector: 'app-custom-tool-card',
  standalone: true,
  templateUrl: './custom-tool-card.component.html',
  styleUrls: ['./custom-tool-card.component.scss'],
  imports: [AppIconComponent, ToggleSwitchComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomToolCardComponent {
  @Input() tool!: GetPythonCodeToolRequest;
  @Input() enabled = false;
  @Input() starred = false;
  @Output() configure = new EventEmitter<GetPythonCodeToolRequest>();
  @Output() toggle = new EventEmitter<{ tool: GetPythonCodeToolRequest; enabled: boolean }>();
  @Output() star = new EventEmitter<{ tool: GetPythonCodeToolRequest; starred: boolean }>();
  @Output() delete = new EventEmitter<GetPythonCodeToolRequest>();

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

