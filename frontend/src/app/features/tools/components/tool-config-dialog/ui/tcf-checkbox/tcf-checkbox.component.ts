import { ChangeDetectionStrategy, ChangeDetectorRef, Component, input, forwardRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'tcf-checkbox',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <label class="tcf-checkbox">
      <input
        type="checkbox"
        [disabled]="disabled"
        [ngModel]="value"
        (ngModelChange)="onValueChange($event)"
        (blur)="onTouched()"
      />
      <span class="tcf-checkbox__box">
        <mat-icon>check</mat-icon>
      </span>
      <span class="tcf-checkbox__text">
        @if (icon()) {
          <mat-icon>{{ icon() }}</mat-icon>
        }
        {{ label() }}
      </span>
    </label>
  `,
  styleUrl: './tcf-checkbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TcfCheckboxComponent),
      multi: true,
    },
  ],
})
export class TcfCheckboxComponent implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  label = input<string>('');
  icon = input<string>('');

  value = false;
  disabled = false;

  private onChange: (value: boolean) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: any): void {
    this.value = !!value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onValueChange(value: boolean): void {
    this.value = value;
    this.onChange(value);
  }
}

