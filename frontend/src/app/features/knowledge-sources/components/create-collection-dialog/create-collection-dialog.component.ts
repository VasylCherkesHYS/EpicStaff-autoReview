import {ChangeDetectionStrategy, Component, inject, signal} from "@angular/core";
import {ButtonComponent} from "../../../../shared/components/buttons/button/button.component";
import {DIALOG_DATA, DialogRef} from "@angular/cdk/dialog";
import {AppIconComponent} from "../../../../shared/components/app-icon/app-icon.component";
import {CreateCollectionDtoResponse, CreateCollectionStep} from "../../models/collection.model";
import {StepUploadFilesComponent} from "./steps/step-upload-files/step-upload-files.component";
import {StepSelectRagComponent} from "./steps/step-select-rag/step-select-rag.component";
import {StepConfigureComponent} from "./steps/step-configure/step-configure.component";
import {StepperComponent} from "./stepper/stepper.component";
import {CollectionDocument} from "../../models/document.model";

@Component({
    selector: 'app-create-collection-dialog',
    templateUrl: 'create-collection-dialog.component.html',
    styleUrls: ['create-collection-dialog.component.scss'],
    imports: [
        ButtonComponent,
        AppIconComponent,
        StepUploadFilesComponent,
        StepSelectRagComponent,
        StepConfigureComponent,
        StepperComponent

    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateCollectionDialogComponent {
    collection: CreateCollectionDtoResponse = inject(DIALOG_DATA);
    private dialogRef = inject(DialogRef);

    currentStep = signal<CreateCollectionStep>(CreateCollectionStep.UPLOAD_FILES);

    selectedRagType = signal<string | null>(null);
    selectedDocuments = signal<CollectionDocument[]>([]);

    onCancel(): void {
        this.dialogRef.close();
    }

    prevStep(): void {
        if (this.currentStep() === CreateCollectionStep.UPLOAD_FILES) {
            return;
        }
        this.currentStep.update(step => step - 1);
    }

    nextStep(): void {
        if (this.currentStep() === CreateCollectionStep.CONFIGURE) {
            return;
        }
        this.currentStep.update(step => step + 1);
    }

    protected readonly CreateCollectionStep = CreateCollectionStep;
}
