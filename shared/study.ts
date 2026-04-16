import { z } from "zod";

export const studyActorSchema = z.object({
  userId: z.number(),
  name: z.string(),
});

export const studyMessageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  text: z.string(),
  createdAt: z.string(),
  user: z.object({
    id: z.number(),
    name: z.string(),
    role: z.string(),
  }),
});

export const studyHistoryTypeSchema = z.enum([
  "room_created",
  "session_started",
  "invite_sent",
  "invite_accepted",
  "screen_share_started",
  "screen_share_stopped",
]);

export const studyHistoryEntrySchema = z.object({
  id: z.string(),
  roomId: z.string(),
  type: studyHistoryTypeSchema,
  createdAt: z.string(),
  actor: studyActorSchema.nullable(),
  text: z.string(),
});

export const studyInviteStatusSchema = z.enum(["pending", "accepted"]);

export const studyInviteSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  roomName: z.string(),
  roomTopic: z.string(),
  inviteCode: z.string().nullable(),
  isPrivate: z.boolean(),
  createdAt: z.string(),
  acceptedAt: z.string().nullable(),
  status: studyInviteStatusSchema,
  inviter: studyActorSchema,
  inviteeUserId: z.number(),
  inviteeLabel: z.string(),
});

export const studyParticipantSchema = z.object({
  socketId: z.string(),
  userId: z.number(),
  name: z.string(),
  role: z.string(),
  department: z.string().nullable(),
  year: z.number().nullable(),
  joinedAt: z.string(),
  isVideoEnabled: z.boolean(),
  isAudioEnabled: z.boolean(),
  isScreenSharing: z.boolean(),
});

export const studySessionSchema = z.object({
  goal: z.string(),
  durationMinutes: z.number().int().min(5).max(180),
  startedAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  status: z.enum(["idle", "running", "completed"]),
  startedBy: studyActorSchema.nullable(),
});

export const studyRoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  topic: z.string(),
  description: z.string(),
  capacity: z.number().int().min(2).max(20),
  isPrivate: z.boolean(),
  inviteCode: z.string().nullable(),
  createdAt: z.string(),
  createdBy: studyActorSchema,
  participants: z.array(studyParticipantSchema),
  messages: z.array(studyMessageSchema),
  history: z.array(studyHistoryEntrySchema),
  session: studySessionSchema,
  allowScreenShare: z.boolean().default(true),
  expiresAt: z.string().nullable(),
  isArchived: z.boolean().default(false),
});

export const createStudyRoomSchema = z.object({
  name: z.string().trim().min(3).max(48),
  topic: z.string().trim().min(2).max(64),
  description: z.string().trim().max(240).default(""),
  capacity: z.coerce.number().int().min(2).max(20).default(8),
  isPrivate: z.boolean().default(false),
  inviteIdentifiers: z.array(z.string().trim().min(1).max(254)).max(10).default([]),
  durationHours: z.coerce.number().int().min(0).max(24).optional(),
  durationMinutes: z.coerce.number().int().min(0).max(59).optional(),
  endAt: z.string().optional(),
});

export const joinStudyRoomSchema = z.object({
  roomId: z.string().trim().min(1),
  inviteCode: z.string().trim().min(4).max(32).optional(),
});

export const joinStudyRoomByCodeSchema = z.object({
  inviteCode: z.string().trim().min(4).max(32),
});

export const sendStudyInviteSchema = z.object({
  roomId: z.string().trim().min(1),
  identifiers: z.array(z.string().trim().min(1).max(254)).min(1).max(10),
});

export const acceptStudyInviteSchema = z.object({
  inviteId: z.string().trim().min(1),
});

export const sendStudyMessageSchema = z.object({
  roomId: z.string().trim().min(1),
  text: z.string().trim().min(1).max(500),
});

export const updateStudySessionSchema = z.object({
  roomId: z.string().trim().min(1),
  goal: z.string().trim().min(2).max(120),
  durationMinutes: z.coerce.number().int().min(5).max(180),
});

export const updateMediaStateSchema = z.object({
  roomId: z.string().trim().min(1),
  isVideoEnabled: z.boolean(),
  isAudioEnabled: z.boolean(),
  isScreenSharing: z.boolean(),
});

export const signalPeerSchema = z.object({
  roomId: z.string().trim().min(1),
  toSocketId: z.string().trim().min(1),
  data: z.unknown(),
});

export const kickStudyParticipantSchema = z.object({
  roomId: z.string().trim().min(1),
  targetSocketId: z.string().trim().min(1),
});

export const muteStudyParticipantSchema = z.object({
  roomId: z.string().trim().min(1),
  targetSocketId: z.string().trim().min(1),
});

export const updateRoomSettingsSchema = z.object({
  roomId: z.string().trim().min(1),
  allowScreenShare: z.boolean(),
});

export const deleteStudyRoomSchema = z.object({
  roomId: z.string().trim().min(1),
});

export type StudyActor = z.infer<typeof studyActorSchema>;
export type StudyMessage = z.infer<typeof studyMessageSchema>;
export type StudyHistoryType = z.infer<typeof studyHistoryTypeSchema>;
export type StudyHistoryEntry = z.infer<typeof studyHistoryEntrySchema>;
export type StudyInviteStatus = z.infer<typeof studyInviteStatusSchema>;
export type StudyInvite = z.infer<typeof studyInviteSchema>;
export type StudyParticipant = z.infer<typeof studyParticipantSchema>;
export type StudySession = z.infer<typeof studySessionSchema>;
export type StudyRoom = z.infer<typeof studyRoomSchema>;
export type CreateStudyRoomInput = z.infer<typeof createStudyRoomSchema>;
export type JoinStudyRoomInput = z.infer<typeof joinStudyRoomSchema>;
export type JoinStudyRoomByCodeInput = z.infer<typeof joinStudyRoomByCodeSchema>;
export type SendStudyInviteInput = z.infer<typeof sendStudyInviteSchema>;
export type AcceptStudyInviteInput = z.infer<typeof acceptStudyInviteSchema>;
export type SendStudyMessageInput = z.infer<typeof sendStudyMessageSchema>;
export type UpdateStudySessionInput = z.infer<typeof updateStudySessionSchema>;
export type UpdateMediaStateInput = z.infer<typeof updateMediaStateSchema>;
export type SignalPeerInput = z.infer<typeof signalPeerSchema>;
export type KickStudyParticipantInput = z.infer<typeof kickStudyParticipantSchema>;
export type MuteStudyParticipantInput = z.infer<typeof muteStudyParticipantSchema>;
export type UpdateRoomSettingsInput = z.infer<typeof updateRoomSettingsSchema>;
export type DeleteStudyRoomInput = z.infer<typeof deleteStudyRoomSchema>;
