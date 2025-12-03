import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AppIconComponent } from '../../../../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-category-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppIconComponent],
  template: `
    <button
      type="button"
      class="category-btn"
      [class.selected]="selected"
      (click)="clicked.emit()"
    >
      <app-icon [icon]="icon" size="1.1rem" class="category-btn__icon"></app-icon>
      <span class="category-btn__label">{{ label }}</span>
    </button>
  `,
  styleUrls: ['./category-button.component.scss'],
})
export class CategoryButtonComponent {
  @Input() label!: string;
  @Input() selected = false;
  @Input() icon = '';
  @Output() clicked = new EventEmitter<void>();
}

