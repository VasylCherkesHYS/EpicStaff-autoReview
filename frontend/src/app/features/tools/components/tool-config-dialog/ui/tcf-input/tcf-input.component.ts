import { ChangeDetectionStrategy, ChangeDetectorRef, Component, input, forwardRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
  selector: 'tcf-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tcf-input">
      @if (label()) {
        <label class="tcf-input__label">
          {{ label() }}
          @if (required()) { <span class="tcf-input__required">*</span> }
        </label>
      }
      <input
        class="tcf-input__field"
        [class.tcf-input__field--error]="error()"
        [type]="type()"
        [step]="step()"
        [placeholder]="placeholder()"
        [disabled]="disabled"
        [ngModel]="value"
        (ngModelChange)="onValueChange($event)"
        (blur)="onTouched()"
      />
      @if (hint() && !error()) {
        <span class="tcf-input__hint">{{ hint() }}</span>
      }
      @if (error()) {
        <span class="tcf-input__error">{{ error() }}</span>
      }
    </div>
  `,
  styleUrl: './tcf-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TcfInputComponent),
      multi: true,
    },
  ],
})
export class TcfInputComponent implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  label = input<string>('');
  placeholder = input<string>('');
  type = input<string>('text');
  step = input<string | number | null>(null);
  hint = input<string>('');
  error = input<string | null>(null);
  required = input<boolean>(false);

  value: string | number | null = '';
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

