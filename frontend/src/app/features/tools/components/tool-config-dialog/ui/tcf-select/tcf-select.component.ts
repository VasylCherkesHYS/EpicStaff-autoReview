import { ChangeDetectionStrategy, ChangeDetectorRef, Component, input, forwardRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

export interface TcfSelectOption {
  value: any;
  label: string;
}

@Component({
  selector: 'tcf-select',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="tcf-select">
      @if (label()) {
        <label class="tcf-select__label">
          {{ label() }}
          @if (required()) { <span class="tcf-select__required">*</span> }
        </label>
      }
      <div class="tcf-select__wrapper">
        <select
          class="tcf-select__field"
          [class.tcf-select__field--error]="error()"
          [disabled]="disabled"
          [ngModel]="value"
          (ngModelChange)="onValueChange($event)"
          (blur)="onTouched()"
        >
          @if (placeholder()) {
            <option [ngValue]="null">{{ placeholder() }}</option>
          }
          @for (option of options(); track option.value) {
            <option [ngValue]="option.value">{{ option.label }}</option>
          }
        </select>
        <mat-icon class="tcf-select__arrow">expand_more</mat-icon>
      </div>
      @if (hint() && !error()) {
        <span class="tcf-select__hint">{{ hint() }}</span>
      }
      @if (error()) {
        <span class="tcf-select__error">{{ error() }}</span>
      }
    </div>
  `,
  styleUrl: './tcf-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TcfSelectComponent),
      multi: true,
    },
  ],
})
export class TcfSelectComponent implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  label = input<string>('');
  placeholder = input<string>('');
  options = input<TcfSelectOption[]>([]);
  hint = input<string>('');
  error = input<string | null>(null);
  required = input<boolean>(false);

  value: any = null;
  disabled = false;

  private onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: any): void {
    this.value = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onValueChange(value: any): void {
    this.value = value;
    this.onChange(value);
  }
}

