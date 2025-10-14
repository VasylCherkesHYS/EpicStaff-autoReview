import { Component, effect, Input, Signal, OnInit, EventEmitter, Output } from '@angular/core';
import { ChunkStrategy, FileWithSettings } from '../../../models/source-collection.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chunk-configuration',
  imports: [CommonModule],
  templateUrl: './chunk-configuration.component.html',
  styleUrl: './chunk-configuration.component.scss'
})
export class ChunkConfigurationComponent {
  @Input() selectedFile: FileWithSettings | null = null;
  @Input() maxChunkSize: number = 8000;
  @Input() maxOverlapSize: number = 1000;
  @Input() chunkStrategies: { label: string; value: ChunkStrategy }[] = [
    { label: 'Token', value: 'token' },
    { label: 'Character', value: 'character' },
    { label: 'Markdown', value: 'markdown' },
    { label: 'JSON', value: 'json' },
    { label: 'HTML', value: 'html' },
  ];
  @Output() chunkParamsChange = new EventEmitter<FileWithSettings>();

  // Default values
  defaultChunkSize = 1000;
  defaultOverlapSize = 200;
  defaultChunkStrategy: ChunkStrategy = 'token';

  updateFileSettings(index: number, field: string, value: any): void {
    const numericValue =
      field !== 'chunkStrategy' ? parseInt(value, 10) : value;

    // Update our tracked array
    if (this.selectedFile) {
      if (field === 'chunkStrategy') {
        this.selectedFile.chunkStrategy = value;
      } else if (field === 'chunkSize') {
        this.selectedFile.chunkSize = numericValue;
      } else if (field === 'overlapSize') {
        this.selectedFile.overlapSize = numericValue;
      }

    }

    // Update the form control
    const control = this.fileSettingsFormArray.at(index);
    control.get(field)?.setValue(numericValue);

    // Run validation after the update
    control.updateValueAndValidity();

    // Update the file's error state
    this.selectedFile.hasChunkSizeError = this.hasChunkError(index);

    // Update overall invalid status
    this.checkForInvalidFiles();
  }

  ngOnChanges() {
    if (this.selectedFile) {
      console.log('Обновился файл:', this.selectedFile);

    } else {
      console.log('Файл не выбран');
    }
  }


}
