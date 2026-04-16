import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import type {
  CreateStudyRoomInput,
  StudyActor,
  StudyHistoryEntry,
  StudyHistoryType,
  StudyInvite,
  StudyRoom,
  StudySession,
} from "@shared/study";

type PersistedStudyRoom = Omit<StudyRoom, "participants"> & {
  participants: [];
  memberUserIds: number[];
  updatedAt: string;
};

type PersistedState = {
  version: 1;
  rooms: PersistedStudyRoom[];
  invites: StudyInvite[];
};

const HISTORY_LIMIT = 200;
const MESSAGE_LIMIT = 100;
const STORE_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function makeInviteCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

function historyText(type: StudyHistoryType, actorName: string, extra: string) {
  switch (type) {
    case "room_created":
      return `${actorName} created the room.`;
    case "session_started":
      return `${actorName} started a ${extra}.`;
    case "invite_sent":
      return `${actorName} invited ${extra}.`;
    case "invite_accepted":
      return `${actorName} joined through a private invite.`;
    case "screen_share_started":
      return `${actorName} started screen sharing.`;
    case "screen_share_stopped":
      return `${actorName} stopped screen sharing.`;
  }
}

function starterRooms(): PersistedStudyRoom[] {
  const createdAt = nowIso();
  return [
    {
      id: "daily-focus-lab",
      name: "Daily Focus Lab",
      topic: "Quiet co-study",
      description:
        "Jump into a calm shared room, keep your camera on if you want accountability, and work through your current task list together.",
      capacity: 10,
      isPrivate: false,
      allowScreenShare: true,
      inviteCode: null,
      createdAt,
      createdBy: { userId: 0, name: "NoteShare" },
      participants: [],
      messages: [],
      history: [
        {
          id: randomUUID(),
          roomId: "daily-focus-lab",
          type: "room_created",
          createdAt,
          actor: { userId: 0, name: "NoteShare" },
          text: "NoteShare created the room.",
        },
      ],
      session: {
        goal: "Set your top priority and study together",
        durationMinutes: 50,
        startedAt: null,
        endsAt: null,
        status: "idle",
        startedBy: null,
      },
      memberUserIds: [],
      updatedAt: createdAt,
      expiresAt: null,
      isArchived: false,
    },
    {
      id: "exam-cram-circle",
      name: "Exam Cram Circle",
      topic: "Revision and quick Q&A",
      description:
        "A livelier room for last-minute review, short questions, and peer support before exams.",
      capacity: 12,
      isPrivate: false,
      allowScreenShare: true,
      inviteCode: null,
      createdAt,
      createdBy: { userId: 0, name: "NoteShare" },
      participants: [],
      messages: [],
      history: [
        {
          id: randomUUID(),
          roomId: "exam-cram-circle",
          type: "room_created",
          createdAt,
          actor: { userId: 0, name: "NoteShare" },
          text: "NoteShare created the room.",
        },
      ],
      session: {
        goal: "Share blockers, then run a 25 minute sprint",
        durationMinutes: 25,
        startedAt: null,
        endsAt: null,
        status: "idle",
        startedBy: null,
      },
      memberUserIds: [],
      updatedAt: createdAt,
      expiresAt: null,
      isArchived: false,
    },
  ];
}

export class StudyStore {
  private readonly filePath: string;
  private state: PersistedState;

  constructor(filePath = path.join(process.cwd(), ".local", "study-state.json")) {
    this.filePath = filePath;
    this.state = this.load();
  }

  listRoomsForUser(userId: number): StudyRoom[] {
    this.normalizeExpiringSessions();

    return this.state.rooms
      .filter((room) => this.canSeeRoom(room, userId) && !room.isArchived)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((room) => this.toExternalRoom(room));
  }

  listPendingInvitesForUser(userId: number): StudyInvite[] {
    return this.state.invites
      .filter((invite) => invite.inviteeUserId === userId && invite.status === "pending")
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  getRoom(roomId: string): StudyRoom | undefined {
    this.normalizeExpiringSessions();
    const room = this.state.rooms.find((entry) => entry.id === roomId);
    return room ? this.toExternalRoom(room) : undefined;
  }

  createRoom(input: CreateStudyRoomInput, creator: StudyActor): StudyRoom {
    const createdAt = nowIso();
    let inviteCode: string | null = null;
    let expiresAt: string | null = null;

    if (input.endAt) {
      expiresAt = new Date(input.endAt).toISOString();
    } else if (input.durationHours || input.durationMinutes) {
      const ms = ((input.durationHours || 0) * 60 * 60 + (input.durationMinutes || 0) * 60) * 1000;
      if (ms > 0) {
        expiresAt = new Date(Date.now() + ms).toISOString();
      }
    }

    if (input.isPrivate) {
      do {
        inviteCode = makeInviteCode();
      } while (this.state.rooms.some((room) => room.inviteCode === inviteCode));
    }

    const roomId = `${input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 32) || "study-room"}-${randomBytes(3).toString("hex")}`;

    const room: PersistedStudyRoom = {
      id: roomId,
      name: input.name,
      topic: input.topic,
      description: input.description,
      capacity: input.capacity,
      isPrivate: input.isPrivate,
      allowScreenShare: true,
      inviteCode,
      createdAt,
      createdBy: creator,
      participants: [],
      messages: [],
      history: [
        {
          id: randomUUID(),
          roomId,
          type: "room_created",
          createdAt,
          actor: creator,
          text: historyText("room_created", creator.name, ""),
        },
      ],
      session: {
        goal: `Start a shared session for ${input.topic}`,
        durationMinutes: 45,
        startedAt: null,
        endsAt: null,
        status: "idle",
        startedBy: null,
      },
      memberUserIds: [],
      updatedAt: createdAt,
      expiresAt,
      isArchived: false,
    };

    this.state.rooms.unshift(room);
    this.save();
    return this.toExternalRoom(room);
  }

  joinRoom(roomId: string, user: StudyActor, inviteCode?: string): StudyRoom | undefined {
    const room = this.state.rooms.find((entry) => entry.id === roomId);
    if (!room) return undefined;

    if (room.isPrivate && room.createdBy.userId !== user.userId) {
      const hasAccess = room.memberUserIds.includes(user.userId);
      const pendingInvite = this.state.invites.find(
        (invite) => invite.roomId === room.id && invite.inviteeUserId === user.userId,
      );
      const validCode = inviteCode && room.inviteCode && inviteCode.trim().toUpperCase() === room.inviteCode;

      if (!hasAccess && !pendingInvite && !validCode) {
        return undefined;
      }

      if (!room.memberUserIds.includes(user.userId)) {
        room.memberUserIds.push(user.userId);
      }

      if (pendingInvite && pendingInvite.status !== "accepted") {
        pendingInvite.status = "accepted";
        pendingInvite.acceptedAt = nowIso();
        this.addHistoryEntry(
          room,
          "invite_accepted",
          user,
          historyText("invite_accepted", user.name, ""),
        );
      } else if (validCode) {
        this.addHistoryEntry(
          room,
          "invite_accepted",
          user,
          `${user.name} joined with the invite code.`,
        );
      }
    }

    room.updatedAt = nowIso();
    this.save();
    return this.toExternalRoom(room);
  }

  joinRoomByInviteCode(inviteCode: string, user: StudyActor): StudyRoom | undefined {
    const normalizedCode = inviteCode.trim().toUpperCase();
    const room = this.state.rooms.find((entry) => entry.inviteCode === normalizedCode);
    if (!room) return undefined;
    return this.joinRoom(room.id, user, normalizedCode);
  }

  sendInvites(
    roomId: string,
    inviter: StudyActor,
    invitees: Array<{ userId: number; label: string }>,
  ) {
    const room = this.state.rooms.find((entry) => entry.id === roomId);
    if (!room) {
      throw new Error("Study room not found");
    }

    const created: StudyInvite[] = [];

    for (const invitee of invitees) {
      if (invitee.userId === inviter.userId) continue;
      if (room.memberUserIds.includes(invitee.userId)) continue;

      const existing = this.state.invites.find(
        (invite) => invite.roomId === roomId && invite.inviteeUserId === invitee.userId,
      );

      if (existing) {
        if (existing.status === "accepted") continue;
        existing.createdAt = nowIso();
        created.push(existing);
        continue;
      }

      const invite: StudyInvite = {
        id: randomUUID(),
        roomId,
        roomName: room.name,
        roomTopic: room.topic,
        inviteCode: room.inviteCode,
        isPrivate: room.isPrivate,
        createdAt: nowIso(),
        acceptedAt: null,
        status: "pending",
        inviter,
        inviteeUserId: invitee.userId,
        inviteeLabel: invitee.label,
      };

      this.state.invites.unshift(invite);
      created.push(invite);
      this.addHistoryEntry(
        room,
        "invite_sent",
        inviter,
        historyText("invite_sent", inviter.name, invitee.label),
      );
    }

    room.updatedAt = nowIso();
    this.save();

    return created;
  }

  acceptInvite(inviteId: string, user: StudyActor): StudyRoom | undefined {
    const invite = this.state.invites.find(
      (entry) => entry.id === inviteId && entry.inviteeUserId === user.userId,
    );
    if (!invite) return undefined;

    return this.joinRoom(invite.roomId, user, invite.inviteCode ?? undefined);
  }

  addMessage(roomId: string, message: StudyRoom["messages"][number]) {
    const room = this.state.rooms.find((entry) => entry.id === roomId);
    if (!room) {
      throw new Error("Study room not found");
    }

    room.messages = [...room.messages, message].slice(-MESSAGE_LIMIT);
    room.updatedAt = nowIso();
    this.save();
    return message;
  }

  updateSession(roomId: string, session: StudySession, actor: StudyActor) {
    const room = this.state.rooms.find((entry) => entry.id === roomId);
    if (!room) {
      throw new Error("Study room not found");
    }

    room.session = session;
    room.updatedAt = nowIso();
    this.addHistoryEntry(
      room,
      "session_started",
      actor,
      historyText(
        "session_started",
        actor.name,
        `${session.durationMinutes} minute session: ${session.goal}`,
      ),
    );
    this.save();
    return this.toExternalRoom(room);
  }

  recordScreenShare(roomId: string, actor: StudyActor, isSharing: boolean) {
    const room = this.state.rooms.find((entry) => entry.id === roomId);
    if (!room) return;

    this.addHistoryEntry(
      room,
      isSharing ? "screen_share_started" : "screen_share_stopped",
      actor,
      historyText(
        isSharing ? "screen_share_started" : "screen_share_stopped",
        actor.name,
        "",
      ),
    );
    room.updatedAt = nowIso();
    this.save();
  }

  updateSettings(roomId: string, allowScreenShare: boolean) {
    const room = this.state.rooms.find((entry) => entry.id === roomId);
    if (!room) return;

    room.allowScreenShare = allowScreenShare;
    room.updatedAt = nowIso();
    this.save();
    return this.toExternalRoom(room);
  }

  archiveRoom(roomId: string) {
    const room = this.state.rooms.find((entry) => entry.id === roomId);
    if (!room || room.isArchived) return;
    room.isArchived = true;
    room.updatedAt = nowIso();
    this.save();
  }

  deleteRoom(roomId: string, actor: StudyActor) {
    const index = this.state.rooms.findIndex((entry) => entry.id === roomId);
    if (index === -1) return false;
    
    if (this.state.rooms[index].createdBy.userId !== actor.userId) {
       return false;
    }
    this.state.rooms.splice(index, 1);
    this.save();
    return true;
  }

  private canSeeRoom(room: PersistedStudyRoom, userId: number) {
    if (!room.isPrivate) return true;
    if (room.createdBy.userId === userId) return true;
    return room.memberUserIds.includes(userId);
  }

  private addHistoryEntry(
    room: PersistedStudyRoom,
    type: StudyHistoryType,
    actor: StudyActor | null,
    text: string,
  ) {
    const entry: StudyHistoryEntry = {
      id: randomUUID(),
      roomId: room.id,
      type,
      createdAt: nowIso(),
      actor,
      text,
    };

    room.history = [...room.history, entry].slice(-HISTORY_LIMIT);
  }

  private toExternalRoom(room: PersistedStudyRoom): StudyRoom {
    return {
      id: room.id,
      name: room.name,
      topic: room.topic,
      description: room.description,
      capacity: room.capacity,
      isPrivate: room.isPrivate,
      inviteCode: room.inviteCode,
      createdAt: room.createdAt,
      createdBy: room.createdBy,
      participants: [],
      messages: room.messages,
      history: room.history,
      session: room.session,
      allowScreenShare: room.allowScreenShare ?? true,
      expiresAt: room.expiresAt ?? null,
      isArchived: room.isArchived ?? false,
    };
  }

  private normalizeExpiringSessions() {
    let changed = false;
    const now = Date.now();

    for (const room of this.state.rooms) {
      if (
        room.session.status === "running" &&
        room.session.endsAt &&
        now >= Date.parse(room.session.endsAt)
      ) {
        room.session = {
          ...room.session,
          status: "completed",
        };
        room.updatedAt = nowIso();
        changed = true;
      }

      if (!room.isArchived && room.expiresAt && now >= Date.parse(room.expiresAt)) {
        room.isArchived = true;
        room.updatedAt = nowIso();
        changed = true;
      }
    }

    if (changed) {
      this.save();
    }
  }

  private load(): PersistedState {
    try {
      if (!fs.existsSync(this.filePath)) {
        return {
          version: STORE_VERSION,
          rooms: starterRooms(),
          invites: [],
        };
      }

      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedState;
      return {
        version: STORE_VERSION,
        rooms: parsed.rooms?.length ? parsed.rooms : starterRooms(),
        invites: parsed.invites ?? [],
      };
    } catch {
      return {
        version: STORE_VERSION,
        rooms: starterRooms(),
        invites: [],
      };
    }
  }

  private save() {
    const directory = path.dirname(this.filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    fs.writeFileSync(
      this.filePath,
      JSON.stringify(
        {
          version: STORE_VERSION,
          rooms: this.state.rooms,
          invites: this.state.invites,
        } satisfies PersistedState,
        null,
        2,
      ),
      "utf8",
    );
  }
}

let studyStoreSingleton: StudyStore | null = null;

export function getStudyStore() {
  if (!studyStoreSingleton) {
    studyStoreSingleton = new StudyStore();
  }

  return studyStoreSingleton;
}
