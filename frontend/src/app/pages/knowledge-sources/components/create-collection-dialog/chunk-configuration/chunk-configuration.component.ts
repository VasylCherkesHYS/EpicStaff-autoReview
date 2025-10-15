import { Component, effect, Input, Signal, OnInit, EventEmitter, Output } from '@angular/core';
import { ChunkStrategy, FileWithIndex, FileWithSettings } from '../../../models/source-collection.model';
import { CommonModule } from '@angular/common';
import { HelpTooltipComponent } from "../../../../../shared/components/help-tooltip/help-tooltip.component";
import { FormArray } from '@angular/forms';
import { ButtonComponent } from '../../../../../shared/components/buttons/button/button.component';
import { SourceEmbeddingService } from '../../../services/source-embedding.service';

@Component({
  selector: 'app-chunk-configuration',
  imports: [CommonModule, HelpTooltipComponent, ButtonComponent],
  templateUrl: './chunk-configuration.component.html',
  styleUrl: './chunk-configuration.component.scss'
})
export class ChunkConfigurationComponent {
  @Input() selectedFile: FileWithIndex | null = null;
  @Input() fileSettingsFormArray!: FormArray;
  @Input() maxChunkSize: number = 8000;
  @Input() maxOverlapSize: number = 1000;
  @Input() chunkStrategies: { label: string; value: ChunkStrategy }[] = [
    { label: 'Token', value: 'token' },
    { label: 'Character', value: 'character' },
    { label: 'Markdown', value: 'markdown' },
    { label: 'JSON', value: 'json' },
    { label: 'HTML', value: 'html' },
  ];
  @Output() chunkParamsChange = new EventEmitter<FileWithIndex>();


  // Default values
  defaultChunkSize = 1000;
  defaultOverlapSize = 200;
  defaultChunkStrategy: ChunkStrategy = 'token';

  // Check if a file setting has a chunk size error
  hasChunkError(index: number): boolean {
    const group = this.fileSettingsFormArray.at(index);
    return group ? group.hasError('chunkSizeTooSmall') : false;
  }

  constructor(
    private sourceEmbeddingService: SourceEmbeddingService,

  ) { }

  updateFileSettings(index: number, field: string, value: any): void {
    const numericValue =
      field !== 'chunkStrategy' ? parseInt(value, 10) : value;

    // Update our tracked array
    if (this.selectedFile) {
      if (field === 'chunkStrategy') {
        this.selectedFile.file.chunkStrategy = value;
      } else if (field === 'chunkSize') {
        this.selectedFile.file.chunkSize = numericValue;
      } else if (field === 'overlapSize') {
        this.selectedFile.file.overlapSize = numericValue;
      }

    }

    // Update the form control
    const control = this.fileSettingsFormArray.at(index);
    control.get(field)?.setValue(numericValue);

    // Run validation after the update
    control.updateValueAndValidity();

    // Update the file's error state
    if (this.selectedFile) {
      this.selectedFile.file.hasChunkSizeError = this.hasChunkError(index);
    }
  }

  onClick() {
    console.log("chunking clicked");

    if (!this.selectedFile || this.hasChunkError(this.selectedFile.index)) {
      return
    }

    this.sourceEmbeddingService.createDocumentChunking(this.selectedFile.index)
      .subscribe({
        next: (res) => {
          console.log("chunking", res);

        }
      })

  }

  ngOnChanges() {
    if (this.selectedFile) {
      console.log('Обновился файл:', this.selectedFile);

    } else {
      console.log('Файл не выбран');
    }
  }


}
