import { Component, effect, Input, Signal, OnInit, EventEmitter, Output, signal, OnDestroy } from '@angular/core';
import { ChunkStrategy, FileWithIndex, FileWithSettings } from '../../../models/source-collection.model';
import { CommonModule } from '@angular/common';
import { HelpTooltipComponent } from "../../../../../shared/components/help-tooltip/help-tooltip.component";
import { FormArray } from '@angular/forms';
import { ButtonComponent } from '../../../../../shared/components/buttons/button/button.component';
import { SourceEmbeddingService } from '../../../services/source-embedding.service';
import { getChunkingPreview } from '../../../utils/chunking.utils';
import { Subscription } from 'rxjs';
import { PreviewChunks } from '../../../models/embedding-result.model';
import { ChunkPreviewComponent } from "../../shared/chunk-preview/chunk-preview.component";

@Component({
  selector: 'app-chunk-configuration',
  imports: [CommonModule, HelpTooltipComponent, ButtonComponent, ChunkPreviewComponent],
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

  public previewChunks = signal<PreviewChunks | undefined>(undefined);

  private chunkingSubscription: Subscription | null = null;

  public isLoading = false;

  // Default values
  defaultChunkSize = 1000;
  defaultOverlapSize = 200;
  defaultChunkStrategy: ChunkStrategy = 'character';

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

  onClickPreview() {
    console.log("chunking clicked");
    // console.log("selectedFile", this.selectedFile);
    this.isLoading = false;

    if (!this.selectedFile || this.hasChunkError(this.selectedFile.index)) {
      return
    }

    const documentId = this.selectedFile.file.document_id;
    if (!documentId) {
      console.warn('No server document_id found for selected file. Cannot request chunk preview.');
      return;
    }
    // Clear previous preview immediately so UI shows no stale data while loading
    this.previewChunks.set(undefined);

    // Cancel any previous in-flight request
    if (this.chunkingSubscription) {
      this.chunkingSubscription.unsubscribe();
      this.chunkingSubscription = null;
    }

    // Call the util which returns an Observable<PreviewChunks>
    this.isLoading = true;

    const obs = getChunkingPreview(this.sourceEmbeddingService, documentId);
    console.log("chunking observable", obs);

    this.chunkingSubscription = obs.subscribe({
      next: (res: PreviewChunks) => {
        console.log('chunkingResult', res);
        this.previewChunks.set(res);
        this.isLoading = false;

      },
      error: (err) => {
        console.error('Failed to get chunking preview', err);
        // keep preview empty on error
        this.isLoading = false;
        this.previewChunks.set({ results: [], previous: null, count: 0, next: null } as PreviewChunks);
      }
    });


  }

  ngOnDestroy(): void {
    if (this.chunkingSubscription) {
      this.chunkingSubscription.unsubscribe();
      this.chunkingSubscription = null;
      this.isLoading = false;

    }
  }

  ngOnChanges() {
    if (this.selectedFile) {
      console.log('File updated:', this.selectedFile);

    } else {
      console.log('File not chosen');
    }
  }


}
