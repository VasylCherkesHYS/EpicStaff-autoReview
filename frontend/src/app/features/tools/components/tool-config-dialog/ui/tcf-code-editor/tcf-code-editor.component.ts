import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  input,
  forwardRef,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';

export type CodeLanguage = 'json' | 'python' | 'text';

@Component({
  selector: 'tcf-code-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorModule],
  template: `
    <div class="tcf-code-editor">
      @if (label()) {
        <label class="tcf-code-editor__label">
          {{ label() }}
          @if (required()) { <span class="tcf-code-editor__required">*</span> }
        </label>
      }
      <div class="tcf-code-editor__container" [class.tcf-code-editor__container--error]="error()">
        <ngx-monaco-editor
          [options]="editorOptions"
          [ngModel]="value"
          (ngModelChange)="onValueChange($event)"
          (onInit)="onEditorInit($event)"
          class="tcf-code-editor__monaco"
          [style.height.px]="height()"
        ></ngx-monaco-editor>
        @if (!editorLoaded()) {
          <div class="tcf-code-editor__loading">
            <span>Loading editor...</span>
          </div>
        }
      </div>
      @if (hint() && !error()) {
        <span class="tcf-code-editor__hint">{{ hint() }}</span>
      }
      @if (error()) {
        <span class="tcf-code-editor__error">{{ error() }}</span>
      }
      @if (validationError()) {
        <span class="tcf-code-editor__error">{{ validationError() }}</span>
      }
    </div>
  `,
  styleUrl: './tcf-code-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TcfCodeEditorComponent),
      multi: true,
    },
  ],
})
export class TcfCodeEditorComponent implements ControlValueAccessor, OnInit {
  private readonly cdr = inject(ChangeDetectorRef);

  readonly label = input<string>('');
  readonly language = input<CodeLanguage>('json');
  readonly height = input<number>(150);
  readonly hint = input<string>('');
  readonly error = input<string | null>(null);
  readonly required = input<boolean>(false);
  readonly readonlyInput = input<boolean>(false, { alias: 'readonly' });

  value = '';
  disabled = false;
  readonly editorLoaded = signal(false);
  readonly validationError = signal<string | null>(null);

  editorOptions: Record<string, any> = {};

  private monacoEditor: any;
  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  ngOnInit(): void {
    this.editorOptions = {
      theme: 'vs-dark',
      language: this.language(),
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      folding: true,
      tabSize: 2,
      readOnly: this.readonlyInput() || this.disabled,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    };
  }

  writeValue(value: any): void {
    if (value === null || value === undefined) {
      this.value = '';
    } else if (typeof value === 'object') {
      try {
        this.value = JSON.stringify(value, null, 2);
      } catch {
        this.value = '';
      }
    } else {
      this.value = String(value);
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (this.monacoEditor) {
      this.monacoEditor.updateOptions({ readOnly: isDisabled });
    }
    this.cdr.markForCheck();
  }

  onValueChange(newValue: string): void {
    this.value = newValue;
    this.validationError.set(null);

    if (this.language() === 'json' && newValue.trim()) {
      try {
        JSON.parse(newValue);
      } catch {
        this.validationError.set('Invalid JSON format');
      }
    }

    this.onChange(newValue);
  }

  onEditorInit(editor: any): void {
    this.monacoEditor = editor;
    this.editorLoaded.set(true);
    this.cdr.markForCheck();
  }
}
