import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PreviewChunks } from '../../../models/embedding-result.model';

@Component({
  selector: 'app-chunk-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chunk-preview.component.html',
  styleUrls: ['./chunk-preview.component.scss']
})
export class ChunkPreviewComponent {
  @Input() previewChunks: PreviewChunks | undefined = undefined;
  @Input() isLoading: boolean = false
}
