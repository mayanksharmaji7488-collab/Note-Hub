import type { Server as HttpServer } from "http";
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { Server as SocketIOServer, type Socket } from "socket.io";
import type { IStorage } from "./storage";
import type { User } from "@shared/schema";
import {
  acceptStudyInviteSchema,
  createStudyRoomSchema,
  joinStudyRoomByCodeSchema,
  joinStudyRoomSchema,
  sendStudyInviteSchema,
  sendStudyMessageSchema,
  signalPeerSchema,
  type StudyActor,
  type StudyParticipant,
  type StudyRoom,
  updateMediaStateSchema,
  updateStudySessionSchema,
  kickStudyParticipantSchema,
  muteStudyParticipantSchema,
  updateRoomSettingsSchema,
  deleteStudyRoomSchema,
} from "@shared/study";
import { getStudyStore } from "./studyStore";

type SessionUser = Pick<User, "id" | "username" | "nickName" | "role" | "department" | "year">;

type SocketAuthedRequest = {
  user?: SessionUser;
};

const studyStore = getStudyStore();
const roomPresence = new Map<string, StudyParticipant[]>();
const socketRooms = new Map<string, string>();

function displayNameFor(user: SessionUser) {
  return user.nickName ?? user.username;
}

function summarizeUser(user: SessionUser): StudyActor {
  return {
    userId: user.id,
    name: displayNameFor(user),
  };
}

function buildParticipant(socketId: string, user: SessionUser): StudyParticipant {
  return {
    socketId,
    userId: user.id,
    name: displayNameFor(user),
    role: user.role ?? "student",
    department: user.department ?? null,
    year: user.year ?? null,
    joinedAt: new Date().toISOString(),
    isVideoEnabled: false,
    isAudioEnabled: false,
    isScreenSharing: false,
  };
}

function attachParticipants(room: StudyRoom): StudyRoom {
  return {
    ...room,
    participants: [...(roomPresence.get(room.id) ?? [])].sort((a, b) =>
      a.joinedAt.localeCompare(b.joinedAt),
    ),
  };
}

function leaveCurrentRoom(socket: Socket) {
  const previousRoomId = socketRooms.get(socket.id);
  if (!previousRoomId) return null;

  socketRooms.delete(socket.id);
  const participants = roomPresence.get(previousRoomId) ?? [];
  const nextParticipants = participants.filter((participant) => participant.socketId !== socket.id);

  if (nextParticipants.length > 0) {
    roomPresence.set(previousRoomId, nextParticipants);
  } else {
    roomPresence.delete(previousRoomId);
  }

  socket.leave(previousRoomId);
  return previousRoomId;
}

function joinSocketToRoom(socket: Socket, roomId: string, user: SessionUser) {
  const previousRoomId = leaveCurrentRoom(socket);
  const participants = roomPresence.get(roomId) ?? [];
  roomPresence.set(
    roomId,
    [...participants.filter((participant) => participant.userId !== user.id), buildParticipant(socket.id, user)],
  );
  socketRooms.set(socket.id, roomId);
  socket.join(roomId);
  return previousRoomId;
}

async function emitRoomState(io: SocketIOServer, roomId: string) {
  const room = studyStore.getRoom(roomId);
  if (!room) return;
  io.to(roomId).emit("study:room_state", attachParticipants(room));
}

function getSocketUser(socket: Socket) {
  return (socket.request as SocketAuthedRequest).user;
}

async function emitListsForSocket(socket: Socket) {
  const user = getSocketUser(socket);
  if (!user) return;

  socket.emit(
    "study:rooms",
    studyStore.listRoomsForUser(user.id).map((room) => attachParticipants(room)),
  );
  socket.emit("study:invites", studyStore.listPendingInvitesForUser(user.id));
}

async function emitListsForAll(io: SocketIOServer) {
  for (const socket of Array.from(io.sockets.sockets.values())) {
    await emitListsForSocket(socket);
  }
}

async function resolveInvitees(storage: IStorage, identifiers: string[]) {
  const seenUserIds = new Set<number>();
  const missing: string[] = [];
  const resolved: Array<{ userId: number; label: string }> = [];

  for (const raw of identifiers) {
    const identifier = raw.trim();
    if (!identifier) continue;

    const user = await storage.getUserByIdentifier(identifier);
    if (!user) {
      missing.push(identifier);
      continue;
    }

    if (seenUserIds.has(user.id)) continue;
    seenUserIds.add(user.id);
    resolved.push({
      userId: user.id,
      label: user.nickName ?? user.username,
    });
  }

  return { resolved, missing };
}

export function registerStudyRoutes(app: Express) {
  app.get("/api/study/rooms", (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    return res
      .status(200)
      .json(studyStore.listRoomsForUser(req.user.id).map((room) => attachParticipants(room)));
  });
}

export function setupStudyHub(
  httpServer: HttpServer,
  storage: IStorage,
  sessionMiddleware: RequestHandler,
) {
  const allowedOrigins =
    process.env.ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];

  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    sessionMiddleware(socket.request as any, {} as any, async () => {
      try {
        const request = socket.request as any;
        const userId = request.session?.passport?.user;
        if (!userId) {
          return next(new Error("Unauthorized"));
        }

        const user = await storage.getUser(Number(userId));
        if (!user) {
          return next(new Error("Unauthorized"));
        }

        (socket.request as SocketAuthedRequest).user = {
          id: user.id,
          username: user.username,
          nickName: user.nickName,
          role: user.role,
          department: user.department,
          year: user.year,
        };

        next();
      } catch (error) {
        next(error as Error);
      }
    });
  });

  io.on("connection", (socket) => {
    const user = getSocketUser(socket);
    if (!user) {
      socket.disconnect();
      return;
    }

    void emitListsForSocket(socket);

    socket.on("study:room_create", async (payload, ack) => {
      const parsed = createStudyRoomSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid room input" });
        return;
      }

      try {
        const room = studyStore.createRoom(parsed.data, summarizeUser(user));
        let missingIdentifiers: string[] = [];

        if (parsed.data.inviteIdentifiers.length > 0) {
          const { resolved, missing } = await resolveInvitees(storage, parsed.data.inviteIdentifiers);
          missingIdentifiers = missing;
          if (resolved.length > 0) {
            studyStore.sendInvites(room.id, summarizeUser(user), resolved);
          }
        }

        await emitListsForAll(io);
        ack?.({
          ok: true,
          roomId: room.id,
          inviteCode: room.inviteCode,
          missingIdentifiers,
        });
      } catch (error) {
        ack?.({ ok: false, message: (error as Error).message });
      }
    });

    socket.on("study:room_join", async (payload, ack) => {
      const parsed = joinStudyRoomSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid room request" });
        return;
      }

      const requestedRoom = studyStore.getRoom(parsed.data.roomId);
      if (!requestedRoom) {
        ack?.({ ok: false, message: "This room no longer exists." });
        return;
      }

      const currentParticipants = roomPresence.get(parsed.data.roomId) ?? [];
      if (
        currentParticipants.length >= requestedRoom.capacity &&
        !currentParticipants.some((participant) => participant.userId === user.id)
      ) {
        ack?.({ ok: false, message: "This room is full right now." });
        return;
      }

      const room = studyStore.joinRoom(parsed.data.roomId, summarizeUser(user), parsed.data.inviteCode);
      if (!room) {
        ack?.({ ok: false, message: "This room is private or no longer exists." });
        return;
      }

      const previousRoomId = joinSocketToRoom(socket, room.id, user);
      if (previousRoomId) {
        await emitRoomState(io, previousRoomId);
      }

      await emitRoomState(io, room.id);
      await emitListsForAll(io);
      ack?.({ ok: true, room: attachParticipants(room) });
    });

    socket.on("study:room_join_code", async (payload, ack) => {
      const parsed = joinStudyRoomByCodeSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid invite code" });
        return;
      }

      const room = studyStore.joinRoomByInviteCode(parsed.data.inviteCode, summarizeUser(user));
      if (!room) {
        ack?.({ ok: false, message: "That invite code is no longer valid." });
        return;
      }

      const previousRoomId = joinSocketToRoom(socket, room.id, user);
      if (previousRoomId) {
        await emitRoomState(io, previousRoomId);
      }

      await emitRoomState(io, room.id);
      await emitListsForAll(io);
      ack?.({ ok: true, room: attachParticipants(room) });
    });

    socket.on("study:room_leave", async () => {
      const previousRoomId = leaveCurrentRoom(socket);
      if (!previousRoomId) return;

      const currentPresence = roomPresence.get(previousRoomId) ?? [];
      const room = studyStore.getRoom(previousRoomId);
      if (room && currentPresence.length === 0 && !room.expiresAt) {
        studyStore.archiveRoom(previousRoomId);
      }

      await emitRoomState(io, previousRoomId);
      await emitListsForAll(io);
    });

    socket.on("study:invite_send", async (payload, ack) => {
      const parsed = sendStudyInviteSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid invite input" });
        return;
      }

      const room = studyStore.getRoom(parsed.data.roomId);
      if (!room) {
        ack?.({ ok: false, message: "Study room not found" });
        return;
      }

      if (room.createdBy.userId !== user.id) {
        ack?.({ ok: false, message: "Only the room creator can send private invites." });
        return;
      }

      const { resolved, missing } = await resolveInvitees(storage, parsed.data.identifiers);
      const created = resolved.length
        ? studyStore.sendInvites(parsed.data.roomId, summarizeUser(user), resolved)
        : [];

      await emitListsForAll(io);
      ack?.({
        ok: true,
        createdCount: created.length,
        missingIdentifiers: missing,
      });
    });

    socket.on("study:invite_accept", async (payload, ack) => {
      const parsed = acceptStudyInviteSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid invite" });
        return;
      }

      const room = studyStore.acceptInvite(parsed.data.inviteId, summarizeUser(user));
      if (!room) {
        ack?.({ ok: false, message: "That invite is no longer available." });
        return;
      }

      const previousRoomId = joinSocketToRoom(socket, room.id, user);
      if (previousRoomId) {
        await emitRoomState(io, previousRoomId);
      }

      await emitRoomState(io, room.id);
      await emitListsForAll(io);
      ack?.({ ok: true, room: attachParticipants(room) });
    });

    socket.on("study:message_send", async (payload, ack) => {
      const parsed = sendStudyMessageSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid message" });
        return;
      }

      if (socketRooms.get(socket.id) !== parsed.data.roomId) {
        ack?.({ ok: false, message: "Join the room before sending messages." });
        return;
      }

      studyStore.addMessage(parsed.data.roomId, {
        id: randomUUID(),
        roomId: parsed.data.roomId,
        text: parsed.data.text,
        createdAt: new Date().toISOString(),
        user: {
          id: user.id,
          name: displayNameFor(user),
          role: user.role ?? "student",
        },
      });

      await emitRoomState(io, parsed.data.roomId);
      await emitListsForAll(io);
      ack?.({ ok: true });
    });

    socket.on("study:session_update", async (payload, ack) => {
      const parsed = updateStudySessionSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid session settings" });
        return;
      }

      if (socketRooms.get(socket.id) !== parsed.data.roomId) {
        ack?.({ ok: false, message: "Join the room before starting a session." });
        return;
      }

      const startedAt = new Date();
      studyStore.updateSession(
        parsed.data.roomId,
        {
          goal: parsed.data.goal,
          durationMinutes: parsed.data.durationMinutes,
          startedAt: startedAt.toISOString(),
          endsAt: new Date(startedAt.getTime() + parsed.data.durationMinutes * 60_000).toISOString(),
          status: "running",
          startedBy: summarizeUser(user),
        },
        summarizeUser(user),
      );

      await emitRoomState(io, parsed.data.roomId);
      await emitListsForAll(io);
      ack?.({ ok: true });
    });

    socket.on("study:media_update", async (payload) => {
      const parsed = updateMediaStateSchema.safeParse(payload);
      if (!parsed.success) return;

      const roomId = socketRooms.get(socket.id);
      if (!roomId || roomId !== parsed.data.roomId) return;

      const participants = roomPresence.get(roomId) ?? [];
      const current = participants.find((participant) => participant.socketId === socket.id);
      if (!current) return;

      const screenChanged = current.isScreenSharing !== parsed.data.isScreenSharing;

      roomPresence.set(
        roomId,
        participants.map((participant) =>
          participant.socketId === socket.id
            ? {
                ...participant,
                isVideoEnabled: parsed.data.isVideoEnabled,
                isAudioEnabled: parsed.data.isAudioEnabled,
                isScreenSharing: parsed.data.isScreenSharing,
              }
            : participant,
        ),
      );

      if (screenChanged) {
        studyStore.recordScreenShare(roomId, summarizeUser(user), parsed.data.isScreenSharing);
      }

      await emitRoomState(io, roomId);
    });

    socket.on("study:signal", (payload) => {
      const parsed = signalPeerSchema.safeParse(payload);
      if (!parsed.success) return;

      io.to(parsed.data.toSocketId).emit("study:signal", {
        roomId: parsed.data.roomId,
        fromSocketId: socket.id,
        fromUser: summarizeUser(user),
        data: parsed.data.data,
      });
    });

    socket.on("study:kick", async (payload, ack) => {
      const parsed = kickStudyParticipantSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false });

      const room = studyStore.getRoom(parsed.data.roomId);
      if (!room || room.createdBy.userId !== user.id) {
        return ack?.({ ok: false, message: "Unauthorized" });
      }

      io.to(parsed.data.targetSocketId).emit("study:kicked", { roomId: room.id });
      // Remove from roomPresence is handled by their disconnect/leave, but we can actively leave their socket
      const targetSocket = io.sockets.sockets.get(parsed.data.targetSocketId);
      if (targetSocket) {
        targetSocket.leave(room.id);
        const previousRoomId = leaveCurrentRoom(targetSocket);
        if (previousRoomId) {
          await emitRoomState(io, previousRoomId);
          await emitListsForAll(io);
        }
      }
      ack?.({ ok: true });
    });

    socket.on("study:mute", (payload, ack) => {
      const parsed = muteStudyParticipantSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false });

      const room = studyStore.getRoom(parsed.data.roomId);
      if (!room || room.createdBy.userId !== user.id) {
        return ack?.({ ok: false, message: "Unauthorized" });
      }

      io.to(parsed.data.targetSocketId).emit("study:mute_remote", { roomId: room.id });
      ack?.({ ok: true });
    });

    socket.on("study:settings_update", async (payload, ack) => {
      const parsed = updateRoomSettingsSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false });

      const room = studyStore.getRoom(parsed.data.roomId);
      if (!room || room.createdBy.userId !== user.id) {
        return ack?.({ ok: false, message: "Unauthorized" });
      }

      studyStore.updateSettings(room.id, parsed.data.allowScreenShare);
      if (!parsed.data.allowScreenShare) {
        const participants = roomPresence.get(room.id) ?? [];
        let changed = false;
        roomPresence.set(
          room.id,
          participants.map((p) => {
            if (p.isScreenSharing) {
              changed = true;
              io.to(p.socketId).emit("study:stop_screen_share", { roomId: room.id });
              return { ...p, isScreenSharing: false };
            }
            return p;
          })
        );
      }
      await emitRoomState(io, room.id);
      ack?.({ ok: true });
    });

    socket.on("study:room_delete", async (payload, ack) => {
      const parsed = deleteStudyRoomSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, message: "Invalid room deletion" });

      const success = studyStore.deleteRoom(parsed.data.roomId, summarizeUser(user));
      if (!success) {
        return ack?.({ ok: false, message: "Unauthorized or room not found" });
      }

      roomPresence.delete(parsed.data.roomId);
      
      io.to(parsed.data.roomId).emit("study:room_closed", { roomId: parsed.data.roomId });
      io.in(parsed.data.roomId).socketsLeave(parsed.data.roomId);

      await emitListsForAll(io);
      ack?.({ ok: true });
    });

    socket.on("disconnect", async () => {
      const previousRoomId = leaveCurrentRoom(socket);
      if (!previousRoomId) return;

      const currentPresence = roomPresence.get(previousRoomId) ?? [];
      const room = studyStore.getRoom(previousRoomId);
      if (room && currentPresence.length === 0 && !room.expiresAt) {
        studyStore.archiveRoom(previousRoomId);
      }

      await emitRoomState(io, previousRoomId);
      await emitListsForAll(io);
    });
  });

  return io;
}
