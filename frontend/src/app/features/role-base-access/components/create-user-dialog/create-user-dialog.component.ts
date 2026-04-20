import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppSvgIconComponent, ButtonComponent, StepConfig, StepperComponent } from '@shared/components';
import { OrganizationService, UserService } from '@shared/services';
import { of } from 'rxjs';

import { CreateUserStep } from '../../enums/create-user-steps.enum';
import { StepAssignToOrgComponent } from './steps/assign-to-org/step-assign-to-org.component';
import { StepUserDetailsComponent } from './steps/user-details/step-user-details.component';

@Component({
    selector: 'app-create-user-dialog',
    templateUrl: './create-user-dialog.component.html',
    styleUrls: ['./create-user-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AppSvgIconComponent,
        ButtonComponent,
        StepperComponent,
        StepUserDetailsComponent,
        StepAssignToOrgComponent,
    ],
})
export class CreateUserDialogComponent {
    private destroyRef = inject(DestroyRef);
    private dialogRef = inject(DialogRef);
    private organizationService = inject(OrganizationService);
    private userService = inject(UserService);

    currentStepIndex = signal(0);

    currentStep = computed(() => this.steps()[this.currentStepIndex()]);
    nextDisabled = computed(() => !this.currentStep().canProceed());
    nextText = computed(() => this.currentStep().proceedLabel);
    stepLabels = computed(() => this.steps().map((s) => s.label));

    steps = computed<StepConfig[]>(() => [
        {
            id: CreateUserStep.USER_DETAILS,
            label: 'User details',
            proceedLabel: 'Next',
            onProceed: () => of(true),
            canProceed: () => true,
        },
        {
            id: CreateUserStep.ASSIGN_TO_ORG,
            label: 'Assign to Org',
            proceedLabel: 'Create',
            onProceed: () => of(true),
            canProceed: () => true,
        },
    ]);

    prevStep(): void {
        this.currentStepIndex.update((i) => Math.max(i - 1, 0));
    }

    nextStep(): void {
        if (!this.currentStep().canProceed()) return;

        this.currentStep()
            .onProceed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((success) => {
                if (!success) return;

                const last = this.steps().length - 1;

                this.currentStepIndex.update((i) => {
                    if (i >= last) {
                        this.onClose();
                        return i;
                    }
                    return i + 1;
                });
            });
    }

    onClose() {
        this.dialogRef.close();
    }

    protected readonly CreateUserStep = CreateUserStep;
}
