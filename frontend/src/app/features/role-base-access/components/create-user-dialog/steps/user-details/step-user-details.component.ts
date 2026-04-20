import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
    CustomInputComponent,
    HelpTooltipComponent,
    ToggleSwitchComponent,
    ValidationErrorsComponent,
} from '@shared/components';

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
export class StepUserDetailsComponent implements OnInit {
    private fb = inject(FormBuilder);

    form!: FormGroup;

    ngOnInit() {
        this.form = this.fb.group({
            full_name: ['', [Validators.required]],
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(8)]],
            superadmin: [false],
        });
    }
}
