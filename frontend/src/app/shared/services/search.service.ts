import { inject, Injectable, InjectionToken } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { BehaviorSubject, debounceTime, distinctUntilChanged, filter } from "rxjs";

export interface SearchConfig {
  debounceMs?: number;
  minLength?: number;
}

export const SEARCH_CONFIG = new InjectionToken<SearchConfig>('SearchConfig');

@Injectable()
export class SearchService {
  private readonly config = inject(SEARCH_CONFIG, { optional: true });
  private readonly searchSubject$ = new BehaviorSubject<string>('');

  readonly rawTerm = toSignal(this.searchSubject$, { initialValue: '' });

  readonly searchTerm = toSignal(
    this.searchSubject$.pipe(
      debounceTime(this.config?.debounceMs ?? 300),
      distinctUntilChanged(),
      filter(term => term === '' || term.length >= (this.config?.minLength ?? 0))
    ),
    { initialValue: '' }
  );

  search(term: string): void {
    this.searchSubject$.next(term);
  }

  clear(): void {
    this.searchSubject$.next('');
  }
}