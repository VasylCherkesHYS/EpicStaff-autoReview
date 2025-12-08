import { Injectable, signal } from '@angular/core';

import { Memory } from '../components/memory-sidebar/models/memory.model';

@Injectable({
    providedIn: 'root',
})
export class MemoryService {
    private readonly memoriesSignal = signal<Memory[]>([]);

    setMemories(memories: Memory[]): void {
        this.memoriesSignal.set(memories ?? []);
    }

    getMemories(): Memory[] {
        return this.memoriesSignal();
    }

    deleteMemory(memoryId: string): void {
        this.memoriesSignal.update((memories) =>
            memories.filter((memory) => memory.id !== memoryId)
        );
    }
}

