import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { StudyInvite, StudyRoom } from "@shared/study";
import { getSocketServerUrl } from "@/lib/backend";

export type StudyAck = {
  ok: boolean;
  message?: string;
  roomId?: string;
  room?: StudyRoom;
  inviteCode?: string | null;
  missingIdentifiers?: string[];
  createdCount?: number;
};

export function emitWithAck(socket: Socket, event: string, payload: unknown): Promise<StudyAck> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response: StudyAck) => resolve(response));
  });
}

// Hook for the Lobby Page (Listing rooms, invites, creating rooms)
export function useStudyLobby(enabled: boolean) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [invites, setInvites] = useState<StudyInvite[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

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
    });

    nextSocket.on("disconnect", () => setIsConnected(false));
    nextSocket.on("connect_error", (error) => setConnectionError(error.message || "Unable to connect"));
    
    nextSocket.on("study:rooms", (payload: StudyRoom[]) => setRooms(payload));
    nextSocket.on("study:invites", (payload: StudyInvite[]) => setInvites(payload));

    return () => {
      nextSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setInvites([]);
      setRooms([]);
    };
  }, [enabled]);

  return useMemo(
    () => ({
      socket,
      rooms,
      invites,
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
      async joinByCode(inviteCode: string) {
        const current = socketRef.current;
        if (!current) return { ok: false, message: "Not connected yet" } satisfies StudyAck;
        return emitWithAck(current, "study:room_join_code", { inviteCode });
      },
      async acceptInvite(inviteId: string) {
        const current = socketRef.current;
        if (!current) return { ok: false, message: "Not connected yet" } satisfies StudyAck;
        return emitWithAck(current, "study:invite_accept", { inviteId });
      }
    }),
    [isConnected, connectionError, invites, rooms, socket],
  );
}

// Hook for the Active Dedicated Room Page
export function useActiveRoom(roomId: string, enabled: boolean, inviteCodeSession?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isKicked, setIsKicked] = useState(false);
  const [isRoomClosed, setIsRoomClosed] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const nextSocket = io(getSocketServerUrl(), {
      path: "/socket.io",
      withCredentials: true,
    });

    socketRef.current = nextSocket;
    setSocket(nextSocket);

    nextSocket.on("connect", () => {
      setIsConnected(true);
      setConnectionError(null);

      void emitWithAck(nextSocket, "study:room_join", { roomId, inviteCode: inviteCodeSession }).then(
        (response) => {
          if (response.ok && response.room) {
            setActiveRoom(response.room);
          } else {
            setConnectionError(response.message || "Failed to join room.");
          }
        },
      );
    });

    nextSocket.on("disconnect", () => setIsConnected(false));
    nextSocket.on("connect_error", (error) => setConnectionError(error.message || "Connection error"));
    
    nextSocket.on("study:room_state", (payload: StudyRoom) => {
      if (payload.id === roomId) {
        setActiveRoom(payload);
      }
    });

    nextSocket.on("study:kicked", (payload) => {
      if (payload.roomId === roomId) {
        setIsKicked(true);
        nextSocket.disconnect();
      }
    });

    nextSocket.on("study:room_closed", (payload) => {
      if (payload.roomId === roomId) {
        setIsRoomClosed(true);
        nextSocket.disconnect();
      }
    });

    return () => {
      nextSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setActiveRoom(null);
    };
  }, [enabled, roomId, inviteCodeSession]);

  return useMemo(
    () => ({
      socket,
      activeRoom,
      isConnected,
      connectionError,
      isKicked,
      isRoomClosed,
      leaveRoom() {
        socketRef.current?.emit("study:room_leave", { roomId });
      },
      async sendInvites(identifiers: string[]) {
        const current = socketRef.current;
        if (!current) return { ok: false, message: "Not connected yet" } satisfies StudyAck;
        return emitWithAck(current, "study:invite_send", { roomId, identifiers });
      },
      async sendMessage(text: string) {
        const current = socketRef.current;
        if (!current) return { ok: false, message: "Not connected yet" } satisfies StudyAck;
        return emitWithAck(current, "study:message_send", { roomId, text });
      },
      async startSession(goal: string, durationMinutes: number) {
        const current = socketRef.current;
        if (!current) return { ok: false, message: "Not connected yet" } satisfies StudyAck;
        return emitWithAck(current, "study:session_update", { roomId, goal, durationMinutes });
      },
      updateMedia(isVideoEnabled: boolean, isAudioEnabled: boolean, isScreenSharing: boolean) {
        socketRef.current?.emit("study:media_update", { roomId, isVideoEnabled, isAudioEnabled, isScreenSharing });
      },
      signalPeer(toSocketId: string, data: unknown) {
        socketRef.current?.emit("study:signal", { roomId, toSocketId, data });
      },
      // Host Actions
      kickUser(targetSocketId: string) {
        socketRef.current?.emit("study:kick", { roomId, targetSocketId });
      },
      muteUser(targetSocketId: string) {
        socketRef.current?.emit("study:mute", { roomId, targetSocketId });
      },
      updateSettings(allowScreenShare: boolean) {
        socketRef.current?.emit("study:settings_update", { roomId, allowScreenShare });
      },
      deleteRoom() {
        socketRef.current?.emit("study:room_delete", { roomId });
      }
    }),
    [activeRoom, connectionError, isConnected, isKicked, isRoomClosed, roomId, socket],
  );
}
