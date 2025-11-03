import { Component, OnInit, Inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormArray,
} from '@angular/forms';
import { Dialog, DialogRef, DIALOG_DATA, DialogModule } from '@angular/cdk/dialog';

import {
  ChunkStrategy,
  GetSourceCollectionRequest,
  FileWithSettings,
  FileWithIndex,
  AdditionalParams
} from '../../models/source-collection.model';
import {
  FullEmbeddingConfig,
  FullEmbeddingConfigService
} from '../../../../features/settings-dialog/services/embeddings/full-embedding.service';
import { CollectionsService } from '../../services/source-collections.service';
import { ToastService } from '../../../../services/notifications/toast.service';
import { uniqueCollectionNameValidator } from '../../../../shared/form-validators/unique-collection-name.validator';
import { FileUploadContainerComponent } from './file-upload-container/file-upload-container.component';
import { EmbeddingModelSelectorComponent } from '../../../../shared/components/embedding-model-selector/embedding-model-selector.component';
import { ButtonComponent } from '../../../../shared/components/buttons/button/button.component';
import { HelpTooltipComponent } from '../../../../shared/components/help-tooltip/help-tooltip.component';
import { signal, WritableSignal } from '@angular/core';
import { ChunkConfigurationComponent } from "./chunk-configuration/chunk-configuration.component";
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-create-collection-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    FileUploadContainerComponent,
    EmbeddingModelSelectorComponent,
    ButtonComponent,
    HelpTooltipComponent,
    ChunkConfigurationComponent
  ],
  templateUrl: './create-collection-dialog.component.html',
  styleUrls: ['./create-collection-dialog.component.scss'],
})
export class CreateCollectionDialogComponent implements OnInit {
  @ViewChild(FileUploadContainerComponent)
  fileUploader!: FileUploadContainerComponent;

  collectionForm: FormGroup;
  isSubmitting = false;
  progress = 0;
  embeddingConfigs: FullEmbeddingConfig[] = [];
  isLoadingEmbeddings = true;
  collections: GetSourceCollectionRequest[] = [];
  draftCollectionId: number | null = null;
  draftCollection: GetSourceCollectionRequest = {} as GetSourceCollectionRequest;
  private isCreatingDraft = false;
  maxChunkSize = 8000;
  maxOverlapSize = 1000;

  csvStrategy = {
    rows_in_chunk: {
      min: 1,
      max: 8000,
      default: 150
    },
    headers_level: {
      min: 1,
      max: 50,
      default: 1
    }
  }

  markdown = {
    return_each_line: {
      default: false
    },
    strip_headers: {
      default: false
    }
  }

  html = {
    preserve_links: {
      default: false,
    },
    normalize_text: {
      default: false,
    },
  }

  chunkStrategies: { label: string; value: ChunkStrategy }[] = [
    { label: 'Token', value: 'token' },
    { label: 'Character', value: 'character' },
    { label: 'Markdown', value: 'markdown' },
    { label: 'JSON', value: 'json' },
    { label: 'HTML', value: 'html' },
  ];

  // aditional_params_info = {
  //   // csvStrategy: this.csvSt rategy,
  //   markdown: this.markdown,
  //   html: this.html,
  // }

  // aditional_params_default_value: AdditionalParams = {
  //   character: { regex: '' },
  //   csvStrategy: {
  //     rows_in_chunk: this.csvStrategy.rows_in_chunk.default,
  //     headers_level: 1,
  //   },
  //   markdown: {
  //     headers_to_split_on: [],
  //     return_each_line: this.markdown.return_each_line.default,
  //     strip_headers: this.markdown.strip_headers.default,
  //   },
  //   html: {
  //     preserve_links: this.html.preserve_links.default,
  //     normalize_text: this.html.normalize_text.default,
  //     external_metadata: { value: '', key: '' },
  //     denylist_tags: []
  //   }
  // }

  currentFile: WritableSignal<FileWithIndex | null> = signal<FileWithIndex | null>(null);
  hasInvalidFiles = false;
  isDraft = signal<boolean>(true);

  constructor(
    private fb: FormBuilder,
    private dialogRef: DialogRef<any>,
    private collectionsService: CollectionsService,
    private fullEmbeddingConfigService: FullEmbeddingConfigService,
    private toastService: ToastService,
    @Inject(DIALOG_DATA) public data: { collections: GetSourceCollectionRequest[] }
  ) {
    this.collections = data.collections || [];
    this.collectionForm = this.buildCollectionForm();
  }

  ngOnInit(): void {
    this.loadEmbeddingConfigs();
    this.subscribeToFormChanges();
  }

  /** =================== FORM BUILDERS =================== */
  private buildCollectionForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, uniqueCollectionNameValidator(this.collections)]],
      embedding_config: [null, [Validators.required]],
      fileSettings: this.fb.array([]),
      additionalParams: this.fb.group({}),
    });
  }

  // private buildFilesFormData(filesWithSettings: FileWithSettings[]): FormData {
  //   // Use array-style keys so the server receives arrays: files[] and file_settings[]
  //   const formData = new FormData();

  //   // filesWithSettings.forEach((fileWithSettings, index) => {
  //   //   // Use 1-based indexing as requested
  //   //   const fileIndex = index + 1;

  //   //   // Append file with index
  //   //   formData.append(
  //   //     `files[${fileIndex}]`,
  //   //     fileWithSettings.file,
  //   //     fileWithSettings.file.name
  //   //   );

  //   //   // Append settings with matching indices
  //   //   formData.append(
  //   //     `chunk_strategies[${fileIndex}]`,
  //   //     fileWithSettings.chunkStrategy
  //   //   );
  //   //   formData.append(
  //   //     `chunk_sizes[${fileIndex}]`,
  //   //     fileWithSettings.chunkSize.toString()
  //   //   );
  //   //   formData.append(
  //   //     `chunk_overlaps[${fileIndex}]`,
  //   //     fileWithSettings.overlapSize.toString()
  //   //   );
  //   // });



  //   filesWithSettings.forEach((fileWithSettings, index) => {
  //     const fileIndex = index + 1;

  //     // append file
  //     formData.append(`files[${fileIndex}]`, fileWithSettings.file, fileWithSettings.file.name);

  //     // bundle per-file settings as a JSON string so they stay tied to the file by order
  //     // Append settings with matching indices
  //     formData.append(
  //       `chunk_strategies[${fileIndex}]`,
  //       fileWithSettings.chunkStrategy
  //     );
  //     formData.append(
  //       `chunk_sizes[${fileIndex}]`,
  //       fileWithSettings.chunkSize.toString()
  //     );
  //     formData.append(
  //       `chunk_overlaps[${fileIndex}]`,
  //       fileWithSettings.overlapSize.toString()
  //     );
  //   });
  //   return formData;
  // }

  private buildFormData(): FormData {
    const formData = new FormData();
    const name = this.collectionForm.get('name')?.value;
    const embedder = this.collectionForm.get('embedding_config')?.value;
    const additionalParams = this.collectionForm.get('additionalParams')?.value || {};
    const filesWithSettings = this.fileUploader.getFiles();
    const fileAdditionalParams = this.fileUploader.getAdditionalParams();

    formData.append('collection_name', name);
    formData.append('user_id', '1');
    formData.append('embedder', embedder?.toString() ?? '');
    formData.append('additional_params', JSON.stringify(additionalParams));
    formData.append('file_additional_params', JSON.stringify(fileAdditionalParams));
    formData.append('is_draft', JSON.stringify(this.isDraft()));

    // Append files and per-file settings directly.
    // if (filesWithSettings && filesWithSettings.length) {
    //   const filesFormData = this.buildFilesFormData(filesWithSettings);
    //   // merge keys from filesFormData into main formData (this preserves multiple files and settings)
    //   filesFormData.forEach((val, key) => formData.append(key, val));
    // }



    filesWithSettings.forEach((fileWithSettings, index) => {
      const fileIndex = index + 1;
      console.log(fileIndex, fileWithSettings);

      // append file
      formData.append(`files[${fileIndex}]`, fileWithSettings.file, fileWithSettings.file.name);

      // bundle per-file settings as a JSON string so they stay tied to the file by order
      // Append settings with matching indices
      formData.append(
        `chunk_strategies[${fileIndex}]`,
        fileWithSettings.chunkStrategy

      );
      console.log(`chunk_strategies[${fileIndex}]`, fileWithSettings.chunkStrategy);

      formData.append(
        `chunk_sizes[${fileIndex}]`,
        fileWithSettings.chunkSize.toString()
      );
      console.log(`chunk_sizes[${fileIndex}]`, fileWithSettings.chunkSize);

      formData.append(
        `chunk_overlaps[${fileIndex}]`,
        fileWithSettings.overlapSize.toString()
      );
      console.log(`overlapSize[${fileIndex}]`, fileWithSettings.overlapSize);

    });
    console.log('file_additional_params', JSON.stringify(fileAdditionalParams));
    console.log('additional_params', JSON.stringify(additionalParams));

    return formData;
  }

  /** =================== GETTERS =================== */
  get fileSettingsFormArray(): FormArray {
    return this.collectionForm.get('fileSettings') as FormArray;
  }

  get nameControl() {
    return this.collectionForm.get('name');
  }

  get hasDuplicateNameError(): boolean {
    const control = this.nameControl;
    return control ? control.hasError('duplicateName') && control.touched : false;
  }

  /** =================== EMBEDDINGS =================== */
  private loadEmbeddingConfigs(): void {
    this.isLoadingEmbeddings = true;
    this.fullEmbeddingConfigService.getFullEmbeddingConfigs().subscribe({
      next: (configs) => {
        this.embeddingConfigs = configs;
        if (configs.length) {
          this.collectionForm.patchValue({ embedding_config: configs[0].id });
        }
        this.isLoadingEmbeddings = false;
      },
      error: () => this.isLoadingEmbeddings = false,
    });
  }

  /** =================== FORM SUBSCRIPTIONS =================== */
  private subscribeToFormChanges(): void {
    this.nameControl?.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.onCreatingDraft());
    this.fileSettingsFormArray.valueChanges.subscribe(() => this.onCreatingDraft());
  }

  /** =================== HELPERS =================== */
  private getAllFilesAsync(): Promise<FileWithSettings[]> {
    return new Promise((resolve) => {
      const checkFiles = () => {
        const files = this.fileUploader.getFiles();
        const allReady = files.every(f => f.file); // проверяем, что все файлы реально загружены
        if (allReady) {
          resolve(files);
        } else {
          setTimeout(checkFiles, 100); // проверяем каждые 100ms
        }
      };
      checkFiles();
    });
  }


  /** =================== DRAFT HANDLING =================== */
  async onCreatingDraft(): Promise<void> {

    const name = this.nameControl?.value?.trim();
    const filesWithSettings = await this.getAllFilesAsync();
    console.log("filesWithSettings", filesWithSettings);


    if (!name || !filesWithSettings || filesWithSettings.length === 0) return;

    this.isDraft.set(true);

    // Prevent duplicate requests: if we are already creating or already have a draft id, skip
    if (this.isCreatingDraft || this.draftCollectionId) return;

    this.isCreatingDraft = true;
    const formData = this.buildFormData();

    this.collectionsService.createGetSourceCollectionRequest(formData).subscribe({
      next: (res) => {
        console.log(res);
        this.draftCollection = res;
        // store returned id so we don't create duplicates
        if (res && (res as any).collection_id) {
          this.draftCollectionId = (res as any).collection_id;
        }
        // If server returned document metadata for uploaded files, map document ids
        // to our local files (match by file name)
        try {
          const docs = (res as any).document_metadata as any[] | undefined;
          console.log("docs", docs);

          if (docs && docs.length && this.fileUploader && this.fileUploader.filesWithSettings) {
            docs.forEach((doc) => {
              const match = this.fileUploader.filesWithSettings.find(
                (f) => f.file.name === doc.file_name
              );
              if (match && doc.document_id) {
                match.document_id = doc.document_id;
              }
            });
          }
        } catch (e) {
          console.warn('Failed to map returned document ids to files', e);
        }
      },
      error: (err) => {
        console.error(err);
        this.isSubmitting = false;
        this.isCreatingDraft = false;
      },
      complete: () => {
        this.isSubmitting = false;
        this.isCreatingDraft = false;
      },
    });
  }



  /** =================== SUBMIT =================== */
  onSubmit(): void {
    if (!this.collectionForm.valid || this.fileSettingsFormArray.length === 0 || this.hasInvalidFiles) {
      return;
    }

    this.isSubmitting = true;
    this.isDraft.set(false);
    if (!this.draftCollection.collection_id) {
      return;
    }
    console.log("isDraft", this.isDraft());

    const formData = this.buildFormData();

    this.collectionsService.patchGetSourceCollectionRequest(this.draftCollection.collection_id, formData).subscribe({
      // this.collectionsService.patchGetSourceCollectionRequest(this.draftCollection.collection_id, this.isDraft()).subscribe({
      next: (res) => this.dialogRef.close(res),
      error: (err) => this.isSubmitting = false,
      complete: () => this.isSubmitting = false,
    });
  }

  /** =================== FILE EVENTS =================== */
  onFileSelected({ file, index }: FileWithIndex): void {
    if (this.fileSettingsFormArray.length === 0) {
      this.currentFile.set(null);
      return;
    }

    if (!this.currentFile() || this.currentFile()?.file.file !== file.file) {
      this.currentFile.set({ file, index });
    }
  }

  onInvalidFilesChange(hasInvalidFiles: boolean): void {
    this.hasInvalidFiles = hasInvalidFiles;
  }

  /** =================== CANCEL =================== */
  onCancel(res?: any): void {
    this.buildCollectionForm();

    this.dialogRef.close(res);
  }
}
