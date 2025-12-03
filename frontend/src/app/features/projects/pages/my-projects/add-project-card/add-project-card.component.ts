import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-add-project-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppIconComponent],
  template: `
    <div class="add-card" (click)="createClick.emit()">
      <div class="add-card__content">
        <div class="add-card__icon">
          <app-icon icon="ui/plus" size="2.5rem"></app-icon>
        </div>
        <span class="add-card__label">Create New Template</span>
      </div>
    </div>
  `,
  styles: [`
    .add-card {
      display: flex;
      flex-direction: column;
      height: 165px;
      padding: 1.5rem;
      border: 1px dashed #3a3e48;
      border-radius: 12px;
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s;

      &:hover {
        border-color: var(--accent-color);
        box-shadow: 0 12px 20px rgba(0, 0, 0, 0.18), 0 3px 6px rgba(0, 0, 0, 0.1);
      }

      &:hover &__label {
        color: #fff;
      }

      &__content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 0.5rem;
      }

      &__icon {
        color: var(--accent-color);
      }

      &__label {
        font-size: 16px;
        font-weight: 500;
        color: #8b8e98;
        transition: color 0.2s;
      }
    }
  `],
})
export class AddProjectCardComponent {
  createClick = output<void>();
}
