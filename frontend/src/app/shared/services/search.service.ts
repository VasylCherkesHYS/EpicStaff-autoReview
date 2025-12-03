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
    private config = inject(SEARCH_CONFIG, { optional: true });
    private searchSubject$ = new BehaviorSubject('');
    
    searchTerm = toSignal(
      this.searchSubject$.pipe(
        debounceTime(this.config?.debounceMs ?? 300),
        distinctUntilChanged(),
        filter(term => term.length >= (this.config?.minLength ?? 0))
      ),
      { requireSync: true }
    );
    
    search(term: string) {
      this.searchSubject$.next(term);
    }
    
    clear() {
      this.searchSubject$.next('');
    }
  }