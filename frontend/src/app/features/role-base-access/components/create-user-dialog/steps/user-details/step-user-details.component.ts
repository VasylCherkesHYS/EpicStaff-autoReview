import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
    CustomInputComponent,
    HelpTooltipComponent,
    ToggleSwitchComponent,
    ValidationErrorsComponent,
} from '@shared/components';
import { map } from 'rxjs';

@Component({
    selector: 'app-step-user-details',
    templateUrl: './step-user-details.component.html',
    styleUrls: ['./step-user-details.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        CustomInputComponent,
        ValidationErrorsComponent,
        ToggleSwitchComponent,
        HelpTooltipComponent,
    ],
})
export class StepUserDetailsComponent {
    private fb = inject(FormBuilder);

    form = this.fb.group({
        full_name: ['', [Validators.required]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        superadmin: [false],
    });

    readonly isFormValid = toSignal(this.form.statusChanges.pipe(map(() => this.form.valid)), {
        initialValue: this.form.valid,
    });
}
