import {
  AgentId,
  ChatMessage,
  GameMode,
  MapId,
  RemotePlayerState,
  RoomSummary,
  TeamSide,
  WeaponId,
} from '../types/game';

export interface MultiplayerEvents {
  onRoomJoined?: (data: {
    playerId: string;
    roomId: string;
    team: TeamSide;
    mode: GameMode;
    mapId: MapId;
    fillWithBots: boolean;
    players: RemotePlayerState[];
    chatLog: ChatMessage[];
  }) => void;
  onPlayerJoined?: (player: RemotePlayerState) => void;
  onPlayerMoved?: (player: RemotePlayerState) => void;
  onPlayerLeft?: (playerId: string) => void;
  onPlayerShot?: (data: {
    shooterId: string;
    weaponId: WeaponId;
    origin: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  }) => void;
  onPlayerDamaged?: (data: {
    shooterId: string;
    shooterName: string;
    shooterTeam: TeamSide;
    victimId: string;
    victimName: string;
    victimTeam: TeamSide;
    weaponId: WeaponId;
    damage: number;
    isHeadshot: boolean;
    remainingHealth: number;
    remainingShield: number;
    isEliminated: boolean;
  }) => void;
  onAbilityCast?: (data: {
    casterId: string;
    agent: AgentId;
    key: 'c' | 'q' | 'e' | 'x';
    origin: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  }) => void;
  onRoundEvent?: (data: {
    senderId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }) => void;
  onChatMessage?: (msg: ChatMessage) => void;
  onConnectionChange?: (connected: boolean) => void;
}

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private callbacks: MultiplayerEvents = {};
  public playerId: string = '';
  public currentRoomId: string = 'GLOBAL-1';
  public isConnected: boolean = false;
  private reconnectTimer: number | null = null;
  private lastJoinParams: {
    roomId: string;
    name: string;
    agent: AgentId;
    team?: TeamSide;
    mode: GameMode;
    mapId: MapId;
    fillWithBots: boolean;
  } | null = null;

  public setCallbacks(cb: MultiplayerEvents) {
    this.callbacks = { ...this.callbacks, ...cb };
  }

  public connect(params: {
    roomId: string;
    name: string;
    agent: AgentId;
    team?: TeamSide;
    mode: GameMode;
    mapId: MapId;
    fillWithBots: boolean;
  }) {
    this.connectAndJoin(params);
  }

  public joinRoom(params: {
    roomId: string;
    name: string;
    agent: AgentId;
    team?: TeamSide;
    mode: GameMode;
    mapId: MapId;
    fillWithBots: boolean;
  }) {
    this.connectAndJoin(params);
  }

  public disconnect() {
    this.lastJoinParams = null;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
    this.isConnected = false;
  }

  public connectAndJoin(params: {
    roomId: string;
    name: string;
    agent: AgentId;
    team?: TeamSide;
    mode: GameMode;
    mapId: MapId;
    fillWithBots: boolean;
  }) {
    this.lastJoinParams = params;
    this.currentRoomId = params.roomId.toUpperCase();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'room:join',
        ...params,
      });
      return;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    this.ws = socket;

    socket.onopen = () => {
      this.isConnected = true;
      this.callbacks.onConnectionChange?.(true);
      if (this.lastJoinParams) {
        this.send({
          type: 'room:join',
          ...this.lastJoinParams,
        });
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'room:joined') {
          this.playerId = msg.playerId;
          this.currentRoomId = msg.roomId;
          this.callbacks.onRoomJoined?.(msg);
        } else if (msg.type === 'player:joined') {
          this.callbacks.onPlayerJoined?.(msg.player);
        } else if (msg.type === 'player:moved') {
          this.callbacks.onPlayerMoved?.(msg.player);
        } else if (msg.type === 'player:left') {
          this.callbacks.onPlayerLeft?.(msg.playerId);
        } else if (msg.type === 'player:shot') {
          this.callbacks.onPlayerShot?.(msg);
        } else if (msg.type === 'player:damaged') {
          this.callbacks.onPlayerDamaged?.(msg);
        } else if (msg.type === 'ability:cast') {
          this.callbacks.onAbilityCast?.(msg);
        } else if (msg.type === 'round:event') {
          this.callbacks.onRoundEvent?.(msg);
        } else if (msg.type === 'chat:message') {
          this.callbacks.onChatMessage?.(msg.message);
        }
      } catch {
        // Ignore parse error
      }
    };

    socket.onclose = () => {
      this.isConnected = false;
      this.callbacks.onConnectionChange?.(false);
      if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = window.setTimeout(() => {
        if (this.lastJoinParams) {
          this.connectAndJoin(this.lastJoinParams);
        }
      }, 2500);
    };
  }

  public sendPlayerUpdate(state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    weapon: WeaponId;
    agent: AgentId;
    team: TeamSide;
    health: number;
    shield: number;
    isAlive: boolean;
  }) {
    this.send({
      type: 'player:update',
      ...state,
    });
  }

  public sendShoot(data: {
    weaponId: WeaponId;
    origin: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    hitPlayerId?: string;
    damage?: number;
    isHeadshot?: boolean;
  }) {
    this.send({
      type: 'player:shoot',
      ...data,
    });
  }

  public sendAbilityCast(data: {
    agent: AgentId;
    key: 'c' | 'q' | 'e' | 'x';
    origin: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  }) {
    this.send({
      type: 'ability:cast',
      ...data,
    });
  }

  public sendRoundEvent(eventType: string, payload: Record<string, unknown> = {}) {
    this.send({
      type: 'round:event',
      eventType,
      payload,
    });
  }

  public sendChat(text: string) {
    this.send({
      type: 'chat:send',
      text,
    });
  }

  public async fetchRooms(): Promise<RoomSummary[]> {
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) return [];
      const data = await res.json();
      return data.rooms || [];
    } catch {
      return [];
    }
  }

  private send(payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}

export const multiplayerClient = new MultiplayerClient();
