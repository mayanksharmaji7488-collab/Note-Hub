import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useStudyRoom } from "@/hooks/use-study-room";
import { useToast } from "@/hooks/use-toast";
import type { StudyHistoryEntry, StudyParticipant } from "@shared/study";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Clock3,
  Copy,
  History,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  Plus,
  ScreenShare,
  ScreenShareOff,
  Signal,
  TimerReset,
  Unlock,
  UserPlus,
  Users,
  Video,
  VideoOff,
} from "lucide-react";

type SignalPayload = {
  roomId: string;
  fromSocketId: string;
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

function formatRemaining(endsAt: string | null) {
  if (!endsAt) return "Not running";
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Session complete";
  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseIdentifiers(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function historyTone(entry: StudyHistoryEntry) {
  switch (entry.type) {
    case "session_started":
      return "secondary" as const;
    case "invite_sent":
    case "invite_accepted":
      return "outline" as const;
    case "screen_share_started":
    case "screen_share_stopped":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

function getMediaErrorMessage(
  error: unknown,
  device: "camera" | "microphone" | "screen sharing",
) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return `Please allow ${device} access in your browser settings.`;
    }

    if (error.name === "NotFoundError") {
      return `No ${device} device was found on this system.`;
    }

    if (error.name === "NotReadableError") {
      return `Your ${device} is already in use by another app.`;
    }

    if (error.name === "AbortError") {
      return `The ${device} request was cancelled.`;
    }
  }

  return `We couldn't access your ${device} right now.`;
}

export default function StudyTogetherPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const {
    socket,
    rooms,
    invites,
    activeRoom,
    setActiveRoom,
    isConnected,
    connectionError,
    createRoom,
    joinRoom,
    joinByCode,
    leaveRoom,
    sendInvites,
    acceptInvite,
    sendMessage,
    startSession,
    updateMedia,
    signalPeer,
  } = useStudyRoom(Boolean(user));

  const [chatText, setChatText] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [sessionGoal, setSessionGoal] = useState("Deep work sprint");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [roomInviteText, setRoomInviteText] = useState("");
  const [roomForm, setRoomForm] = useState({
    name: "",
    topic: "",
    description: "",
    capacity: 8,
    isPrivate: false,
    inviteText: "",
  });
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [timeLabel, setTimeLabel] = useState("Not running");

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const remoteStreamsRef = useRef(new Map<string, MediaStream>());
  const pendingIceCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const currentParticipant = useMemo(
    () => activeRoom?.participants.find((participant) => participant.userId === user.id) ?? null,
    [activeRoom, user.id],
  );
  const remoteParticipants = useMemo(
    () => activeRoom?.participants.filter((participant) => participant.userId !== user.id) ?? [],
    [activeRoom, user.id],
  );
  const isRoomOwner = activeRoom?.createdBy.userId === user.id;

  function getCurrentVideoTrack() {
    return (
      screenStreamRef.current?.getVideoTracks()[0] ??
      (isVideoEnabled ? cameraStreamRef.current?.getVideoTracks()[0] ?? null : null)
    );
  }

  function getCurrentAudioTrack() {
    return isAudioEnabled ? cameraStreamRef.current?.getAudioTracks()[0] ?? null : null;
  }

  function updateLocalPreview() {
    if (!localVideoRef.current) return;
    const currentVideoTrack = getCurrentVideoTrack();
    if (!currentVideoTrack) {
      localVideoRef.current.srcObject = null;
      return;
    }

    localVideoRef.current.srcObject = new MediaStream([currentVideoTrack]);
  }

  async function ensureCameraStream(options: { video?: boolean; audio?: boolean } = {}) {
    const wantVideo = Boolean(options.video);
    const wantAudio = Boolean(options.audio);
    const existingStream = cameraStreamRef.current ?? new MediaStream();
    const hasVideo = existingStream.getVideoTracks().length > 0;
    const hasAudio = existingStream.getAudioTracks().length > 0;

    if ((!wantVideo || hasVideo) && (!wantAudio || hasAudio)) {
      cameraStreamRef.current = existingStream;
      return existingStream;
    }

    const nextStream = await navigator.mediaDevices.getUserMedia({
      video: wantVideo && !hasVideo,
      audio: wantAudio && !hasAudio,
    });

    nextStream.getVideoTracks().forEach((track) => {
      track.enabled = isVideoEnabled;
      existingStream.addTrack(track);
    });
    nextStream.getAudioTracks().forEach((track) => {
      track.enabled = isAudioEnabled;
      existingStream.addTrack(track);
    });

    cameraStreamRef.current = existingStream;
    updateLocalPreview();
    return existingStream;
  }

  function getTransceiver(peer: RTCPeerConnection, kind: "video" | "audio") {
    return peer
      .getTransceivers()
      .find(
        (transceiver) =>
          transceiver.sender.track?.kind === kind || transceiver.receiver.track.kind === kind,
      );
  }

  async function syncPeerConnectionTracks(peer: RTCPeerConnection) {
    const videoTransceiver = getTransceiver(peer, "video");
    const audioTransceiver = getTransceiver(peer, "audio");

    await videoTransceiver?.sender.replaceTrack(getCurrentVideoTrack() ?? null);
    await audioTransceiver?.sender.replaceTrack(getCurrentAudioTrack() ?? null);
  }

  async function syncAllPeerConnections() {
    for (const peer of Array.from(peerConnectionsRef.current.values())) {
      await syncPeerConnectionTracks(peer);
    }
  }

  async function flushPendingIceCandidates(remoteSocketId: string, peer: RTCPeerConnection) {
    const pending = pendingIceCandidatesRef.current.get(remoteSocketId) ?? [];
    if (pending.length === 0) return;

    pendingIceCandidatesRef.current.delete(remoteSocketId);

    for (const candidate of pending) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  async function ensurePeerConnection(remoteSocketId: string) {
    const existing = peerConnectionsRef.current.get(remoteSocketId);
    if (existing) return existing;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peer.addTransceiver("video", { direction: "sendrecv" });
    peer.addTransceiver("audio", { direction: "sendrecv" });

    peer.onicecandidate = (event) => {
      if (!activeRoom || !event.candidate) return;
      signalPeer(activeRoom.id, remoteSocketId, event.candidate.toJSON());
    };

    peer.ontrack = (event) => {
      remoteStreamsRef.current.set(remoteSocketId, event.streams[0]);
      const element = remoteVideoRefs.current.get(remoteSocketId);
      if (element) {
        element.srcObject = event.streams[0];
        void element.play().catch(() => {});
      }
    };

    await syncPeerConnectionTracks(peer);
    peerConnectionsRef.current.set(remoteSocketId, peer);
    return peer;
  }

  async function stopScreenShare(notify = true) {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setIsScreenSharing(false);
    updateLocalPreview();
    await syncAllPeerConnections();

    if (activeRoom && notify) {
      updateMedia(activeRoom.id, isVideoEnabled, isAudioEnabled, false);
    }
  }

  useEffect(() => {
    if (!activeRoom) {
      setTimeLabel("Not running");
      return;
    }

    const sync = () => setTimeLabel(formatRemaining(activeRoom.session.endsAt));
    sync();
    const timer = window.setInterval(sync, 1000);
    return () => window.clearInterval(timer);
  }, [activeRoom]);

  useEffect(() => {
    for (const peer of Array.from(peerConnectionsRef.current.values())) {
      peer.close();
    }
    peerConnectionsRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    remoteStreamsRef.current.clear();
    remoteVideoRefs.current.forEach((element) => {
      element.srcObject = null;
    });
  }, [activeRoom?.id]);

  useEffect(() => {
    if (!socket || !activeRoom) return;

    const handleSignal = async (payload: SignalPayload) => {
      if (payload.roomId !== activeRoom.id || payload.fromSocketId === currentParticipant?.socketId) {
        return;
      }

      try {
        const peer = await ensurePeerConnection(payload.fromSocketId);
        const signalData = payload.data as RTCSessionDescriptionInit & RTCIceCandidateInit;

        if (signalData.type) {
          await peer.setRemoteDescription(new RTCSessionDescription(signalData));
          await flushPendingIceCandidates(payload.fromSocketId, peer);

          if (signalData.type === "offer") {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            signalPeer(activeRoom.id, payload.fromSocketId, answer);
          }
          return;
        }

        if (signalData.candidate) {
          if (!peer.remoteDescription) {
            const pending = pendingIceCandidatesRef.current.get(payload.fromSocketId) ?? [];
            pending.push(signalData);
            pendingIceCandidatesRef.current.set(payload.fromSocketId, pending);
            return;
          }

          await peer.addIceCandidate(new RTCIceCandidate(signalData));
        }
      } catch (error) {
        console.error("Failed to handle WebRTC signal", error);
      }
    };

    socket.on("study:signal", handleSignal);
    return () => {
      socket.off("study:signal", handleSignal);
    };
  }, [activeRoom, currentParticipant?.socketId, signalPeer, socket]);

  useEffect(() => {
    if (!activeRoom || !currentParticipant) return;

    const connectPeers = async () => {
      for (const participant of remoteParticipants) {
        if (
          !participant.isVideoEnabled &&
          !participant.isAudioEnabled &&
          !participant.isScreenSharing
        ) {
          continue;
        }

        const peer = await ensurePeerConnection(participant.socketId);
        if (peer.signalingState === "stable" && currentParticipant.socketId < participant.socketId) {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          signalPeer(activeRoom.id, participant.socketId, offer);
        }
      }
    };

    void connectPeers();
  }, [activeRoom, currentParticipant, remoteParticipants, signalPeer]);

  useEffect(() => {
    return () => {
      void stopScreenShare(false);
      for (const peer of Array.from(peerConnectionsRef.current.values())) {
        peer.close();
      }
      peerConnectionsRef.current.clear();
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function handleToggleVideo() {
    const nextValue = !isVideoEnabled;

    try {
      if (nextValue) {
        const stream = await ensureCameraStream({ video: true });
        stream.getVideoTracks().forEach((track) => {
          track.enabled = true;
        });
      } else {
        cameraStreamRef.current?.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
      }

      setIsVideoEnabled(nextValue);
      updateLocalPreview();
      await syncAllPeerConnections();

      if (activeRoom) {
        updateMedia(activeRoom.id, nextValue, isAudioEnabled, isScreenSharing);
      }
    } catch (error) {
      toast({
        title: "Camera unavailable",
        description: getMediaErrorMessage(error, "camera"),
        variant: "destructive",
      });
    }
  }

  async function handleToggleAudio() {
    const nextValue = !isAudioEnabled;

    try {
      if (nextValue) {
        const stream = await ensureCameraStream({ audio: true });
        stream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
      } else {
        cameraStreamRef.current?.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }

      setIsAudioEnabled(nextValue);
      await syncAllPeerConnections();

      if (activeRoom) {
        updateMedia(activeRoom.id, isVideoEnabled, nextValue, isScreenSharing);
      }
    } catch (error) {
      toast({
        title: "Microphone unavailable",
        description: getMediaErrorMessage(error, "microphone"),
        variant: "destructive",
      });
    }
  }

  async function handleToggleScreenShare() {
    if (!activeRoom) return;

    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      track.onended = () => {
        void stopScreenShare();
      };

      updateLocalPreview();
      await syncAllPeerConnections();
      updateMedia(activeRoom.id, isVideoEnabled, isAudioEnabled, true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      toast({
        title: "Screen share unavailable",
        description: getMediaErrorMessage(error, "screen sharing"),
        variant: "destructive",
      });
    }
  }
  async function handleCreateRoom() {
    const inviteIdentifiers = parseIdentifiers(roomForm.inviteText);
    const response = await createRoom({
      name: roomForm.name,
      topic: roomForm.topic,
      description: roomForm.description,
      capacity: roomForm.capacity,
      isPrivate: roomForm.isPrivate,
      inviteIdentifiers,
    });

    if (!response.ok || !response.roomId) {
      toast({
        title: "Could not create room",
        description: response.message ?? "Please check the details and try again.",
        variant: "destructive",
      });
      return;
    }

    const joined = await joinRoom(response.roomId);
    if (!joined.ok) {
      toast({
        title: "Room created",
        description: "The room is ready, but we could not join it automatically.",
      });
      return;
    }

    setRoomForm({
      name: "",
      topic: "",
      description: "",
      capacity: 8,
      isPrivate: false,
      inviteText: "",
    });

    if (response.inviteCode) {
      toast({
        title: "Private room ready",
        description: `Invite code ${response.inviteCode} is ready to share.`,
      });
    }

    if (response.missingIdentifiers?.length) {
      toast({
        title: "Some invites were skipped",
        description: response.missingIdentifiers.join(", "),
        variant: "destructive",
      });
    }
  }

  async function handleJoinRoom(roomId: string, inviteCode?: string) {
    const response = await joinRoom(roomId, inviteCode);
    if (!response.ok) {
      toast({
        title: "Could not join room",
        description: response.message ?? "Please try another room.",
        variant: "destructive",
      });
    }
  }

  async function handleJoinByCode() {
    if (!joinCode.trim()) return;

    const response = await joinByCode(joinCode.trim().toUpperCase());
    if (!response.ok) {
      toast({
        title: "Invite code not accepted",
        description: response.message ?? "Please double-check the code and try again.",
        variant: "destructive",
      });
      return;
    }

    setJoinCode("");
  }

  async function handleAcceptInvite(inviteId: string) {
    const response = await acceptInvite(inviteId);
    if (!response.ok) {
      toast({
        title: "Invite not accepted",
        description: response.message ?? "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleSendMessage() {
    if (!activeRoom || !chatText.trim()) return;

    const response = await sendMessage(activeRoom.id, chatText.trim());
    if (!response.ok) {
      toast({
        title: "Message not sent",
        description: response.message ?? "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setChatText("");
  }

  async function handleStartSession() {
    if (!activeRoom) return;

    const response = await startSession(activeRoom.id, sessionGoal, durationMinutes);
    if (!response.ok) {
      toast({
        title: "Session not started",
        description: response.message ?? "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleSendInvites() {
    if (!activeRoom) return;
    const identifiers = parseIdentifiers(roomInviteText);
    if (identifiers.length === 0) return;

    const response = await sendInvites(activeRoom.id, identifiers);
    if (!response.ok) {
      toast({
        title: "Invites not sent",
        description: response.message ?? "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setRoomInviteText("");
    toast({
      title: "Invites sent",
      description: response.missingIdentifiers?.length
        ? `Missing: ${response.missingIdentifiers.join(", ")}`
        : `Sent ${response.createdCount ?? 0} invite(s).`,
    });
  }

  async function handleCopyInviteCode(inviteCode: string) {
    try {
      await navigator.clipboard.writeText(inviteCode);
      toast({
        title: "Invite code copied",
        description: `${inviteCode} is ready to share.`,
      });
    } catch {
      toast({
        title: "Could not copy code",
        description: "Please copy the invite code manually.",
        variant: "destructive",
      });
    }
  }

  const roomStatus = connectionError
    ? connectionError
    : isConnected
      ? "Realtime connected"
      : "Connecting to realtime rooms...";

  return (
    <Layout>
      <div className="space-y-8">
        <Card className="glass-card rounded-3xl border-border/60">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-3xl font-display">
                <Users className="h-8 w-8 text-primary" />
                Study Together
              </CardTitle>
              <p className="mt-2 text-muted-foreground">
                Create public or private rooms, invite classmates, keep a persistent session history, and share your screen or camera live.
              </p>
            </div>
            <Badge variant={isConnected ? "secondary" : "outline"} className="w-fit">
              <Signal className="mr-2 h-4 w-4" />
              {roomStatus}
            </Badge>
          </CardHeader>
        </Card>

        <div className="grid gap-6 2xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="rounded-3xl border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Plus className="h-5 w-5 text-primary" />
                  Create a room
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Room name"
                  value={roomForm.name}
                  onChange={(event) => setRoomForm((current) => ({ ...current, name: event.target.value }))}
                />
                <Input
                  placeholder="Topic"
                  value={roomForm.topic}
                  onChange={(event) => setRoomForm((current) => ({ ...current, topic: event.target.value }))}
                />
                <Textarea
                  placeholder="What will people work on here?"
                  value={roomForm.description}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
                <Input
                  type="number"
                  min={2}
                  max={20}
                  value={roomForm.capacity}
                  onChange={(event) =>
                    setRoomForm((current) => ({
                      ...current,
                      capacity: Number(event.target.value || 8),
                    }))
                  }
                />
                <div className="flex items-center justify-between rounded-2xl border border-border/60 p-3">
                  <div>
                    <div className="font-medium">Private room</div>
                    <div className="text-sm text-muted-foreground">
                      Only invited members or people with the code can get in.
                    </div>
                  </div>
                  <Switch
                    checked={roomForm.isPrivate}
                    onCheckedChange={(checked) =>
                      setRoomForm((current) => ({ ...current, isPrivate: checked }))
                    }
                  />
                </div>
                <Textarea
                  placeholder="Invite by username or email, separated by commas"
                  value={roomForm.inviteText}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, inviteText: event.target.value }))
                  }
                />
                <Button className="w-full" onClick={handleCreateRoom}>
                  Create room
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/60">
              <CardHeader>
                <CardTitle className="text-xl">Join with code</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Enter private room code"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleJoinByCode();
                    }
                  }}
                />
                <Button onClick={handleJoinByCode}>Join</Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/60">
              <CardHeader>
                <CardTitle className="text-xl">Pending invites</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No pending invites right now.
                  </p>
                ) : (
                  invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="rounded-2xl border border-border/60 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold">{invite.roomName}</div>
                          <div className="text-sm text-muted-foreground">{invite.roomTopic}</div>
                        </div>
                        <Badge variant="outline">
                          {invite.isPrivate ? "Private" : "Open"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Invited by {invite.inviter.name}
                        {invite.inviteCode ? ` • code ${invite.inviteCode}` : ""}
                      </p>
                      <Button className="mt-3" size="sm" onClick={() => handleAcceptInvite(invite.id)}>
                        Accept and join
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/60">
              <CardHeader>
                <CardTitle className="text-xl">Live rooms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setActiveRoom(room)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      activeRoom?.id === room.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{room.name}</div>
                        <div className="text-sm text-muted-foreground">{room.topic}</div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">
                          {room.participants.length}/{room.capacity}
                        </Badge>
                        <Badge variant="outline">
                          {room.isPrivate ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{room.description}</p>
                    <Button
                      className="mt-3"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleJoinRoom(room.id);
                      }}
                    >
                      Join room
                    </Button>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {activeRoom ? (
              <Card className="rounded-3xl border-border/60">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="text-2xl">{activeRoom.name}</CardTitle>
                    <p className="mt-1 text-muted-foreground">{activeRoom.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{activeRoom.topic}</Badge>
                    <Badge variant="outline">{activeRoom.participants.length} online</Badge>
                    <Badge variant="outline">
                      {activeRoom.isPrivate ? (
                        <>
                          <Lock className="mr-2 h-3.5 w-3.5" />
                          Private
                        </>
                      ) : (
                        <>
                          <Unlock className="mr-2 h-3.5 w-3.5" />
                          Public
                        </>
                      )}
                    </Badge>
                    {currentParticipant ? (
                      <Button variant="outline" onClick={() => leaveRoom(activeRoom.id)}>
                        Leave room
                      </Button>
                    ) : (
                      <Button onClick={() => handleJoinRoom(activeRoom.id)}>Join now</Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_360px]">
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-2xl border border-border/60 bg-card p-4">
                        <div className="text-sm text-muted-foreground">Current goal</div>
                        <div className="mt-2 font-semibold">{activeRoom.session.goal}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card p-4">
                        <div className="text-sm text-muted-foreground">Focus timer</div>
                        <div className="mt-2 font-semibold">{timeLabel}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card p-4">
                        <div className="text-sm text-muted-foreground">Started by</div>
                        <div className="mt-2 font-semibold">
                          {activeRoom.session.startedBy?.name ?? "No one yet"}
                        </div>
                      </div>
                    </div>

                    {activeRoom.isPrivate && activeRoom.inviteCode ? (
                      <div className="flex flex-col gap-3 rounded-3xl border border-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="font-semibold">Private room invite code</div>
                          <div className="mt-1 font-mono text-lg tracking-widest">{activeRoom.inviteCode}</div>
                        </div>
                        <Button variant="outline" onClick={() => handleCopyInviteCode(activeRoom.inviteCode!)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy code
                        </Button>
                      </div>
                    ) : null}

                    {isRoomOwner ? (
                      <div className="space-y-4 rounded-3xl border border-border/60 p-4">
                        <div className="flex items-center gap-2 font-semibold">
                          <UserPlus className="h-5 w-5 text-primary" />
                          Send private invites
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            placeholder="Invite by username or email"
                            value={roomInviteText}
                            onChange={(event) => setRoomInviteText(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void handleSendInvites();
                              }
                            }}
                          />
                          <Button onClick={handleSendInvites}>Invite</Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-4 rounded-3xl border border-border/60 p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">Shared session controls</div>
                        <TimerReset className="h-5 w-5 text-primary" />
                      </div>
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_auto]">
                        <Input value={sessionGoal} onChange={(event) => setSessionGoal(event.target.value)} />
                        <Input
                          type="number"
                          min={5}
                          max={180}
                          value={durationMinutes}
                          onChange={(event) => setDurationMinutes(Number(event.target.value || 45))}
                        />
                        <Button onClick={handleStartSession}>Start together</Button>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-border/60 p-4">
                      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="font-semibold">Video and screen share</div>
                          <div className="text-sm text-muted-foreground">
                            Share your camera, microphone, or full screen for collaborative study.
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant={isVideoEnabled ? "default" : "outline"}
                            size="sm"
                            onClick={() => void handleToggleVideo()}
                          >
                            {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant={isAudioEnabled ? "default" : "outline"}
                            size="sm"
                            onClick={() => void handleToggleAudio()}
                          >
                            {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant={isScreenSharing ? "default" : "outline"}
                            size="sm"
                            onClick={() => void handleToggleScreenShare()}
                          >
                            {isScreenSharing ? <ScreenShareOff className="h-4 w-4" /> : <ScreenShare className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="overflow-hidden rounded-2xl border border-border/60 bg-black/90">
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="aspect-video w-full object-cover"
                          />
                          <div className="flex items-center justify-between p-3 text-sm text-white/80">
                            <span>You</span>
                            <span>{isScreenSharing ? "Screen sharing" : isVideoEnabled ? "Camera on" : "Camera off"}</span>
                          </div>
                        </div>
                        {remoteParticipants.map((participant) => (
                          <div
                            key={participant.socketId}
                            className="overflow-hidden rounded-2xl border border-border/60 bg-black/90"
                          >
                            <video
                              autoPlay
                              playsInline
                              className="aspect-video w-full object-cover"
                              ref={(element) => {
                                if (element) {
                                  remoteVideoRefs.current.set(participant.socketId, element);
                                  const stream = remoteStreamsRef.current.get(participant.socketId);
                                  if (stream) {
                                    element.srcObject = stream;
                                    void element.play().catch(() => {});
                                  }
                                } else {
                                  remoteVideoRefs.current.delete(participant.socketId);
                                }
                              }}
                            />
                            <div className="flex items-center justify-between p-3 text-sm text-white/80">
                              <span>{participant.name}</span>
                              <span>{participant.isScreenSharing ? "Sharing screen" : "Live"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Card className="rounded-3xl border-border/60 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <History className="h-5 w-5 text-primary" />
                          Persistent room history
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[260px] rounded-2xl border border-border/60 p-4">
                          <div className="space-y-4">
                            {activeRoom.history.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Room events will appear here once your group starts using the space.
                              </p>
                            ) : (
                              activeRoom.history
                                .slice()
                                .reverse()
                                .map((entry) => (
                                  <div key={entry.id} className="rounded-2xl border border-border/60 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <Badge variant={historyTone(entry)}>{entry.type.replaceAll("_", " ")}</Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(entry.createdAt).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-sm">{entry.text}</p>
                                  </div>
                                ))
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card className="rounded-3xl border-border/60 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Users className="h-5 w-5 text-primary" />
                          Participants
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {activeRoom.participants.map((participant: StudyParticipant) => (
                          <div key={participant.socketId} className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>{initials(participant.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="font-medium">{participant.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {[participant.department, participant.year ? `Year ${participant.year}` : null]
                                  .filter(Boolean)
                                  .join(" • ") || participant.role}
                              </div>
                            </div>
                            <div className="flex gap-1 text-muted-foreground">
                              {participant.isScreenSharing ? <ScreenShare className="h-4 w-4" /> : null}
                              {participant.isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                              {participant.isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-border/60 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <MessageSquare className="h-5 w-5 text-primary" />
                          Room chat
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ScrollArea className="h-[320px] rounded-2xl border border-border/60 p-4">
                          <div className="space-y-4">
                            {activeRoom.messages.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No messages yet. Say hi and share what you&apos;re working on.
                              </p>
                            ) : (
                              activeRoom.messages.map((message) => (
                                <div key={message.id}>
                                  <div className="text-sm font-medium">{message.user.name}</div>
                                  <div className="text-sm text-muted-foreground">{message.text}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    <Clock3 className="mr-1 inline h-3 w-3" />
                                    {new Date(message.createdAt).toLocaleString()}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                        <Separator />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            placeholder="Send a message to the room"
                            value={chatText}
                            onChange={(event) => setChatText(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void handleSendMessage();
                              }
                            }}
                          />
                          <Button onClick={() => void handleSendMessage()}>Send</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-3xl border-border/60">
                <CardContent className="py-16 text-center">
                  <Users className="mx-auto h-12 w-12 text-primary" />
                  <h2 className="mt-4 text-2xl font-semibold">Pick a room to get started</h2>
                  <p className="mt-2 text-muted-foreground">
                    Join an existing group, accept an invite, or create a private room for your combined study session.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

