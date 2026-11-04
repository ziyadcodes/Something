import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ServerPlayer {
  id: string;
  ws: WebSocket;
  name: string;
  team: 'attackers' | 'defenders';
  agent: string;
  weapon: string;
  health: number;
  shield: number;
  isAlive: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  kills: number;
  deaths: number;
}

interface RoomState {
  roomId: string;
  mode: string;
  mapId: string;
  fillWithBots: boolean;
  players: Map<string, ServerPlayer>;
  chatLog: {
    id: string;
    senderId: string;
    senderName: string;
    senderTeam: 'attackers' | 'defenders';
    text: string;
    timestamp: number;
  }[];
}

const rooms = new Map<string, RoomState>();

function getOrCreateRoom(
  roomId: string,
  mode = 'standard',
  mapId = 'industrial',
  fillWithBots = true
): RoomState {
  const cleanId = (roomId || 'GLOBAL-1').toUpperCase().slice(0, 12);
  let room = rooms.get(cleanId);
  if (!room) {
    room = {
      roomId: cleanId,
      mode,
      mapId,
      fillWithBots,
      players: new Map(),
      chatLog: [],
    };
    rooms.set(cleanId, room);
  }
  return room;
}

// Seed default public room
getOrCreateRoom('GLOBAL-1', 'standard', 'industrial', true);

function serializePlayer(p: ServerPlayer) {
  return {
    id: p.id,
    name: p.name,
    team: p.team,
    agent: p.agent,
    weapon: p.weapon,
    health: p.health,
    shield: p.shield,
    isAlive: p.isAlive,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    pitch: p.pitch,
    kills: p.kills,
    deaths: p.deaths,
  };
}

function broadcastToRoom(room: RoomState, payload: unknown, excludeId?: string) {
  const data = JSON.stringify(payload);
  room.players.forEach((player) => {
    if (player.id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/rooms', (_req, res) => {
    const list: {
      roomId: string;
      playerCount: number;
      maxPlayers: number;
      mode: string;
      mapId: string;
      fillWithBots: boolean;
    }[] = [];
    rooms.forEach((r) => {
      list.push({
        roomId: r.roomId,
        playerCount: r.players.size,
        maxPlayers: 10,
        mode: r.mode,
        mapId: r.mapId,
        fillWithBots: r.fillWithBots,
      });
    });
    res.json({ rooms: list });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const playerId = `plr_${Math.random().toString(36).slice(2, 9)}`;
    let currentRoom: RoomState | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'room:join') {
          if (currentRoom) {
            currentRoom.players.delete(playerId);
            broadcastToRoom(currentRoom, { type: 'player:left', playerId }, playerId);
          }

          const room = getOrCreateRoom(
            msg.roomId || 'GLOBAL-1',
            msg.mode || 'standard',
            msg.mapId || 'industrial',
            msg.fillWithBots !== false
          );
          if (msg.mode) room.mode = msg.mode;
          if (msg.mapId) room.mapId = msg.mapId;
          if (typeof msg.fillWithBots === 'boolean') room.fillWithBots = msg.fillWithBots;

          // Auto-balance team unless explicitly requested
          let attackersCount = 0;
          let defendersCount = 0;
          room.players.forEach((p) => {
            if (p.team === 'attackers') attackersCount++;
            else defendersCount++;
          });
          const assignedTeam: 'attackers' | 'defenders' =
            msg.team === 'attackers' || msg.team === 'defenders'
              ? msg.team
              : attackersCount <= defendersCount
              ? 'attackers'
              : 'defenders';

          const newPlayer: ServerPlayer = {
            id: playerId,
            ws,
            name: String(msg.name || `AGENT_${playerId.slice(-4).toUpperCase()}`).slice(0, 18),
            team: assignedTeam,
            agent: msg.agent || 'jett',
            weapon: msg.weapon || 'vandal',
            health: 100,
            shield: 50,
            isAlive: true,
            x: 0,
            y: 0,
            z: assignedTeam === 'attackers' ? 35 : -44,
            yaw: 0,
            pitch: 0,
            kills: 0,
            deaths: 0,
          };

          room.players.set(playerId, newPlayer);
          currentRoom = room;

          const allPlayers = Array.from(room.players.values()).map(serializePlayer);
          ws.send(
            JSON.stringify({
              type: 'room:joined',
              playerId,
              roomId: room.roomId,
              team: assignedTeam,
              mode: room.mode,
              mapId: room.mapId,
              fillWithBots: room.fillWithBots,
              players: allPlayers,
              chatLog: room.chatLog.slice(-20),
            })
          );

          broadcastToRoom(
            room,
            {
              type: 'player:joined',
              player: serializePlayer(newPlayer),
            },
            playerId
          );
        } else if (msg.type === 'player:update' && currentRoom) {
          const p = currentRoom.players.get(playerId);
          if (!p) return;
          if (typeof msg.x === 'number') p.x = msg.x;
          if (typeof msg.y === 'number') p.y = msg.y;
          if (typeof msg.z === 'number') p.z = msg.z;
          if (typeof msg.yaw === 'number') p.yaw = msg.yaw;
          if (typeof msg.pitch === 'number') p.pitch = msg.pitch;
          if (msg.weapon) p.weapon = msg.weapon;
          if (msg.agent) p.agent = msg.agent;
          if (msg.team === 'attackers' || msg.team === 'defenders') p.team = msg.team;
          if (typeof msg.health === 'number') p.health = msg.health;
          if (typeof msg.shield === 'number') p.shield = msg.shield;
          if (typeof msg.isAlive === 'boolean') p.isAlive = msg.isAlive;

          broadcastToRoom(
            currentRoom,
            {
              type: 'player:moved',
              player: serializePlayer(p),
            },
            playerId
          );
        } else if (msg.type === 'player:shoot' && currentRoom) {
          const shooter = currentRoom.players.get(playerId);
          if (!shooter) return;

          broadcastToRoom(
            currentRoom,
            {
              type: 'player:shot',
              shooterId: playerId,
              weaponId: msg.weaponId || shooter.weapon,
              origin: msg.origin,
              target: msg.target,
            },
            playerId
          );

          if (msg.hitPlayerId && typeof msg.damage === 'number') {
            const victim = currentRoom.players.get(msg.hitPlayerId);
            if (victim && victim.isAlive) {
              const incoming = Math.max(1, Math.min(255, msg.damage));
              const shieldAbsorb = Math.min(victim.shield, Math.round(incoming * 0.66));
              victim.shield = Math.max(0, victim.shield - shieldAbsorb);
              victim.health = Math.max(0, victim.health - (incoming - shieldAbsorb));

              const isEliminated = victim.health <= 0;
              if (isEliminated) {
                victim.isAlive = false;
                victim.deaths += 1;
                shooter.kills += 1;
              }

              broadcastToRoom(currentRoom, {
                type: 'player:damaged',
                shooterId: shooter.id,
                shooterName: shooter.name,
                shooterTeam: shooter.team,
                victimId: victim.id,
                victimName: victim.name,
                victimTeam: victim.team,
                weaponId: msg.weaponId || shooter.weapon,
                damage: incoming,
                isHeadshot: Boolean(msg.isHeadshot),
                remainingHealth: victim.health,
                remainingShield: victim.shield,
                isEliminated,
              });
            }
          }
        } else if (msg.type === 'ability:cast' && currentRoom) {
          broadcastToRoom(
            currentRoom,
            {
              type: 'ability:cast',
              casterId: playerId,
              agent: msg.agent,
              key: msg.key,
              origin: msg.origin,
              direction: msg.direction,
              target: msg.target,
            },
            playerId
          );
        } else if (msg.type === 'round:event' && currentRoom) {
          if (msg.eventType === 'newRound') {
            currentRoom.players.forEach((p) => {
              p.health = 100;
              p.shield = 50;
              p.isAlive = true;
            });
          }
          broadcastToRoom(
            currentRoom,
            {
              type: 'round:event',
              senderId: playerId,
              eventType: msg.eventType,
              payload: msg.payload,
            },
            playerId
          );
        } else if (msg.type === 'chat:send' && currentRoom) {
          const sender = currentRoom.players.get(playerId);
          if (!sender || !msg.text) return;
          const chatItem = {
            id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            senderId: sender.id,
            senderName: sender.name,
            senderTeam: sender.team,
            text: String(msg.text).slice(0, 140),
            timestamp: Date.now(),
          };
          currentRoom.chatLog.push(chatItem);
          if (currentRoom.chatLog.length > 40) {
            currentRoom.chatLog.shift();
          }
          broadcastToRoom(currentRoom, {
            type: 'chat:message',
            message: chatItem,
          });
        }
      } catch {
        // Ignore malformed packet
      }
    });

    ws.on('close', () => {
      if (currentRoom) {
        currentRoom.players.delete(playerId);
        broadcastToRoom(currentRoom, { type: 'player:left', playerId }, playerId);
        if (currentRoom.players.size === 0 && currentRoom.roomId !== 'GLOBAL-1') {
          rooms.delete(currentRoom.roomId);
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`VALORANT Multiplayer Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
