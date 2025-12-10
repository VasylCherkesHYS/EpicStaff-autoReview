import {ChangeDetectionStrategy, Component, model} from "@angular/core";

import {RagTypeComponent} from "./rag-type/rag-type.component";
import {RAG_TYPES} from "../../../../constants/constants";

@Component({
    selector: "app-step-select-rag",
    templateUrl: "./step-select-rag.component.html",
    styleUrls: ["./step-select-rag.component.scss"],
    imports: [
        RagTypeComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepSelectRagComponent {
    selectedRag = model<string | null>(null);

    protected readonly RAG_TYPES = RAG_TYPES;
}
