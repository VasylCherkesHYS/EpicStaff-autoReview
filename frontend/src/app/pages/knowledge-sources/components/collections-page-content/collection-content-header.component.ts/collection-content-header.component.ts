import {
  Component,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { KnowledgeSourcesPageService } from '../../../services/knowledge-sources-page.service';
import { CollectionStatus, GetSourceCollectionRequest } from '../../../models/source-collection.model';
import { Search2Component } from '../../../../../shared/components/search2/search2.component';
import { ButtonComponent } from '../../../../../shared/components/buttons/button/button.component';
import { CollectionsService } from '../../../services/source-collections.service';
import { SourceEmbeddingService } from '../../../services/source-embedding.service'
import { GetProcessingEmbeddingResponse } from '../../../models/embedding-result.model';


@Component({
  selector: 'app-collection-header',
  standalone: true,
  imports: [CommonModule, Search2Component, ButtonComponent],
  templateUrl: './collection-content-header.component.html',
  styleUrls: ['./collection-content-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionHeaderComponent implements OnInit {
  @Output() uploadFiles = new EventEmitter<void>();
  public collectionStatus: CollectionStatus | null = null
  // Search query binding
  searchQuery: string = '';

  constructor(
    private _pageService: KnowledgeSourcesPageService,
    private collectionsService: CollectionsService,
    private sourceEmbeddingService: SourceEmbeddingService,
  ) { }

  ngOnInit(): void {
    // Initialize search query from service
    this.searchQuery = this._pageService.searchQuery();
  }

  public get selectedCollection() {
    return this._pageService.selectedCollection();
  }

  public get selectedEmbeddingConfig() {
    return this._pageService.selectedEmbeddingConfig();
  }

  /**
   * Gets the display name for a collection status
   */
  public getStatusLabel(status: string): string {
    switch (status) {
      case CollectionStatus.NEW:
        return 'New';
      case CollectionStatus.PROCESSING:
        return 'Processing';
      case CollectionStatus.COMPLETED:
        return 'Completed';
      case CollectionStatus.FAILED:
        return 'Failed';
      default:
        return 'Unknown';
    }
  }

  /**
   * Gets the CSS class for the status indicator
   */
  public getStatusClass(status: string): string {
    switch (status) {
      case CollectionStatus.NEW:
        return 'status-new';
      case CollectionStatus.PROCESSING:
        return 'status-processing';
      case CollectionStatus.COMPLETED:
        return 'status-completed';
      case CollectionStatus.FAILED:
        return 'status-failed';
      default:
        return '';
    }
  }

  /**
   * Emits event to parent component to handle file upload
   */
  public onUploadFiles(): void {
    this.uploadFiles.emit();
  }

  /**
   * Handle search query changes
   */
  public onSearchChange(query: string): void {
    this.searchQuery = query;
    this._pageService.setSearchQuery(query);
  }

  public onEmbedding() {
    console.log("selectedCollection", this.selectedCollection);
    console.log("selectedCollection collection_id", this.selectedCollection?.collection_id);
    if (!this.selectedCollection) {
      return
    }
    this.sourceEmbeddingService.createProcessingEmbedding(this.selectedCollection.collection_id)
      .subscribe((res) => {
        return;
      })

    this.sourceEmbeddingService.getProcessingEmbedding(this.selectedCollection.collection_id)
      .subscribe((res: GetProcessingEmbeddingResponse) => {
        this.collectionStatus != res.results[0].collection_status
      })

  }
}
