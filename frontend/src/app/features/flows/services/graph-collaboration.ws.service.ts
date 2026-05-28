import { inject, Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

import { ConfigService } from '../../../services/config/config.service';
import { WsTicketService } from '../../../services/auth/ws-ticket.service';

export interface EditorInfo {
    user_id: number;
    display_name: string | null;
    avatar_url?: string | null;
    email?: string | null;
}

type ServerMessage = 
    | PresenceStateMessage
    | UserJoinedMessage
    | UserLeftMessage
    | GraphModifiedMessage
    | GraphSavedMessage
    | WsErrorMessage

type PresenceStateMessage  = { type: 'presence_state'; editors: EditorInfo[] };
type UserJoinedMessage     = { type: 'user_joined'; editor: EditorInfo };
type UserLeftMessage       = { type: 'user_left'; user_id: number };
export type GraphModifiedMessage = { 
    type: 'graph_modified'; 
    graph_id: number; 
    modified_by: EditorInfo 
};
export type GraphSavedMessage    = {
    type: 'graph_saved';
    graph_id: number;
    new_save_version: number;
    saved_by: EditorInfo;
    saved_at: string;
};
type WsErrorMessage = { type: 'error'; code: string; message: string };

type ClientMessage = { type: 'user_editing' };

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

@Injectable ({'providedIn': 'root'})

export class GraphCollaborationWsService {
    private configService = inject(ConfigService);
    private wsTicketService = inject(WsTicketService);
    private socket: WebSocket | null = null;
    private currentGraphId: number | null = null;
    private reconnectTimeout: number | null = null;
    private isManualDisconnect = false;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 5;
    private readonly baseReconnectDelayMs = 1000;
    private readonly maxReconnectDelayMs = 30000;

    public editors = signal<EditorInfo[]>([]);
    public connectionStatus = signal<ConnectionStatus>('disconnected');

    public graphSaved$ = new Subject<GraphSavedMessage>();
    public graphModified$ = new Subject<GraphModifiedMessage>();

}
