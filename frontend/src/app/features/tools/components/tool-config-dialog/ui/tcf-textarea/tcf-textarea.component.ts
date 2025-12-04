import { ChangeDetectionStrategy, ChangeDetectorRef, Component, input, forwardRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
  selector: 'tcf-textarea',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tcf-textarea">
      @if (label()) {
        <label class="tcf-textarea__label">
          {{ label() }}
          @if (required()) { <span class="tcf-textarea__required">*</span> }
        </label>
      }
      <textarea
        class="tcf-textarea__field"
        [class.tcf-textarea__field--error]="error()"
        [placeholder]="placeholder()"
        [rows]="rows()"
        [disabled]="disabled"
        [ngModel]="value"
        (ngModelChange)="onValueChange($event)"
        (blur)="onTouched()"
      ></textarea>
      @if (hint() && !error()) {
        <span class="tcf-textarea__hint">{{ hint() }}</span>
      }
      @if (error()) {
        <span class="tcf-textarea__error">{{ error() }}</span>
      }
    </div>
  `,
  styleUrl: './tcf-textarea.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TcfTextareaComponent),
      multi: true,
    },
  ],
})
export class TcfTextareaComponent implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  label = input<string>('');
  placeholder = input<string>('');
  rows = input<number>(3);
  hint = input<string>('');
  error = input<string | null>(null);
  required = input<boolean>(false);

  value: string = '';
  disabled = false;

  private onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: any): void {
    this.value = value ?? '';
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

  onValueChange(value: string): void {
    this.value = value;
    this.onChange(value);
  }
}

