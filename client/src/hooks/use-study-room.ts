import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { StudyInvite, StudyRoom } from "@shared/study";
import { getSocketServerUrl } from "@/lib/backend";

type StudyAck = {
  ok: boolean;
  message?: string;
  roomId?: string;
  room?: StudyRoom;
  inviteCode?: string | null;
  missingIdentifiers?: string[];
  createdCount?: number;
};

function emitWithAck(socket: Socket, event: string, payload: unknown): Promise<StudyAck> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response: StudyAck) => resolve(response));
  });
}

export function useStudyRoom(enabled: boolean) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [invites, setInvites] = useState<StudyInvite[]>([]);
  const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const joinedRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const nextSocket = io(getSocketServerUrl(), {
      path: "/socket.io",
      withCredentials: true,
    });

    socketRef.current = nextSocket;
    setSocket(nextSocket);

    nextSocket.on("connect", () => {
      setIsConnected(true);
      setConnectionError(null);

      const joinedRoomId = joinedRoomIdRef.current;
      if (!joinedRoomId) return;

      void emitWithAck(nextSocket, "study:room_join", { roomId: joinedRoomId }).then(
        (response) => {
          if (response.ok && response.room) {
            setActiveRoom(response.room);
            return;
          }

          joinedRoomIdRef.current = null;
        },
      );
    });

    nextSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    nextSocket.on("connect_error", (error) => {
      setConnectionError(error.message || "Unable to connect to study rooms");
    });

    nextSocket.on("study:rooms", (payload: StudyRoom[]) => {
      setRooms(payload);
      setActiveRoom((current) => (current ? payload.find((room) => room.id === current.id) ?? current : current));
    });

    nextSocket.on("study:invites", (payload: StudyInvite[]) => {
      setInvites(payload);
    });

    nextSocket.on("study:room_state", (payload: StudyRoom) => {
      setActiveRoom((current) => (current?.id === payload.id ? payload : current));
      setRooms((current) =>
        current.some((room) => room.id === payload.id)
          ? current.map((room) => (room.id === payload.id ? payload : room))
          : [payload, ...current],
      );
    });

    return () => {
      nextSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setInvites([]);
      setRooms([]);
      setActiveRoom(null);
      joinedRoomIdRef.current = null;
    };
  }, [enabled]);

  return useMemo(
    () => ({
      socket,
      rooms,
      invites,
      activeRoom,
      setActiveRoom,
      isConnected,
      connectionError,
      async createRoom(payload: {
        name: string;
        topic: string;
        description: string;
        capacity: number;
        isPrivate: boolean;
        inviteIdentifiers: string[];
      }) {
        const current = socketRef.current;
        if (!current) return { ok: false, message: "Not connected yet" } satisfies StudyAck;
        return emitWithAck(current, "study:room_create", payload);
      },
      async joinRoom(roomId: string, inviteCode?: string) {
        const current = socketRef.current;
        if (!current) return { ok: false, message: "Not connected yet" } satisfies StudyAck;
        const response = await emitWithAck(current, "study:room_join", { roomId, inviteCode });
        if (response.ok && response.room) {
          joinedRoomIdRef.current = response.room.id;
          setActiveRoom(response.room);
        }
        return response;
      },
      async joinByCode(inviteCode: string) {
        const current = socketRef.current;
        if (!current) return { ok: false, message: "Not connected yet" } satisfies StudyAck;
        const response = await emitWithAck(current, "study:room_join_code", { inviteCode });
        if (response.ok && response.room) {
          joinedRoomIdRef.current = response.room.id;
          setActiveRoom(response.room);
        }
        return response;
      },
      leaveRoom(roomId: string) {
        if (joinedRoomIdRef.current === roomId) {
          joinedRoomIdRef.current = null;
        }
        socketRef.current?.emit("study:room_leave", { roomId });
        setActiveRoom((current) => (current?.id === roomId ? null : current));
      },
      async sendInvites(roomId: string, identifiers: string[]) {
        const current = socketRef.current;
        if (!current) return { ok: false, message: "Not connected yet" } satisfies StudyAck;
        return emitWithAck(current, "study:invite_send", { roomId, identifiers });
      },
      async acceptInvite(inviteId: string) {
        const current = socketRef.current;
        if (!current) return { ok: false, message: "Not connected yet" } satisfies StudyAck;
        const response = await emitWithAck(current, "study:invite_accept", { inviteId });
        if (response.ok && response.room) {
          joinedRoomIdRef.current = response.room.id;
          setActiveRoom(response.room);
        }
        return response;
      },
      async sendMessage(roomId: string, text: string) {
        const current = socketRef.current;
        if (!current) return { ok: false, message: "Not connected yet" } satisfies StudyAck;
        return emitWithAck(current, "study:message_send", { roomId, text });
      },
      async startSession(roomId: string, goal: string, durationMinutes: number) {
        const current = socketRef.current;
        if (!current) return { ok: false, message: "Not connected yet" } satisfies StudyAck;
        return emitWithAck(current, "study:session_update", {
          roomId,
          goal,
          durationMinutes,
        });
      },
      updateMedia(
        roomId: string,
        isVideoEnabled: boolean,
        isAudioEnabled: boolean,
        isScreenSharing: boolean,
      ) {
        socketRef.current?.emit("study:media_update", {
          roomId,
          isVideoEnabled,
          isAudioEnabled,
          isScreenSharing,
        });
      },
      signalPeer(roomId: string, toSocketId: string, data: unknown) {
        socketRef.current?.emit("study:signal", { roomId, toSocketId, data });
      },
    }),
    [activeRoom, connectionError, invites, isConnected, rooms, socket],
  );
}
