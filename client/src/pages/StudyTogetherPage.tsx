import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useStudyLobby } from "@/hooks/use-study-room";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";

function parseIdentifiers(text: string) {
  return text.split(",").map(s => s.trim()).filter(Boolean);
}

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Lock, Unlock, Signal } from "lucide-react";

export default function StudyTogetherPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const {
    rooms,
    invites,
    isConnected,
    connectionError,
    createRoom,
    joinByCode,
    acceptInvite,
  } = useStudyLobby(Boolean(user));

  const [joinCode, setJoinCode] = useState("");
  const [roomForm, setRoomForm] = useState({
    name: "",
    topic: "",
    description: "",
    capacity: 8,
    isPrivate: false,
    inviteText: "",
    durationHours: 1,
    durationMinutes: 0,
    endAt: "",
    timeMode: "none" as "none" | "duration" | "exact",
  });

  useEffect(() => {
    if (user === null) {
      setLocation("/auth");
    }
  }, [user, setLocation]);

  if (!user) return null;

  async function handleCreateRoom() {
    const inviteIdentifiers = parseIdentifiers(roomForm.inviteText);
    const response = await createRoom({
      name: roomForm.name,
      topic: roomForm.topic,
      description: roomForm.description,
      capacity: roomForm.capacity,
      isPrivate: roomForm.isPrivate,
      inviteIdentifiers,
      ...(roomForm.timeMode === "duration" ? { durationHours: roomForm.durationHours, durationMinutes: roomForm.durationMinutes } : {}),
      ...(roomForm.timeMode === "exact" && roomForm.endAt ? { endAt: new Date(roomForm.endAt).toISOString() } : {}),
    });

    if (!response.ok || !response.roomId) {
      toast({
        title: "Could not create room",
        description: response.message ?? "Please check the details and try again.",
        variant: "destructive",
      });
      return;
    }

    setLocation(`/room/${response.roomId}`);
  }

  async function handleJoinByCode() {
    if (!joinCode.trim()) return;

    const response = await joinByCode(joinCode.trim().toUpperCase());
    if (!response.ok || !response.room) {
      toast({
        title: "Invite code not accepted",
        description: response.message ?? "Please double-check the code and try again.",
        variant: "destructive",
      });
      return;
    }

    setJoinCode("");
    setLocation(`/room/${response.room.id}`);
  }

  async function handleAcceptInvite(inviteId: string) {
    const response = await acceptInvite(inviteId);
    if (!response.ok || !response.room) {
      toast({
        title: "Invite not accepted",
        description: response.message ?? "Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    setLocation(`/room/${response.room.id}`);
  }

  const roomStatus = connectionError
    ? connectionError
    : isConnected
      ? "Realtime connected"
      : "Connecting to realtime rooms...";

  return (
    <Layout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <Card className="glass-card rounded-3xl border-border/60">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-3xl font-display">
                <Users className="h-8 w-8 text-primary" />
                Study Together Lobby
              </CardTitle>
              <p className="mt-2 text-muted-foreground">
                Join a live room, accept a private invite, or create your own session.
              </p>
            </div>
            <Badge variant={isConnected ? "secondary" : "outline"} className="w-fit">
              <Signal className="mr-2 h-4 w-4" />
              {roomStatus}
            </Badge>
          </CardHeader>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Create Room */}
          <Card className="rounded-3xl border-border/60 order-1 md:order-none">
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

              <div className="flex flex-col gap-3 rounded-2xl border border-border/60 p-3">
                <div className="font-medium">Room Time Limit</div>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="timeMode" checked={roomForm.timeMode === "none"} onChange={() => setRoomForm(c => ({...c, timeMode: "none"}))} className="accent-primary" /> 
                    No limit
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="timeMode" checked={roomForm.timeMode === "duration"} onChange={() => setRoomForm(c => ({...c, timeMode: "duration"}))} className="accent-primary" /> 
                    Duration
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="timeMode" checked={roomForm.timeMode === "exact"} onChange={() => setRoomForm(c => ({...c, timeMode: "exact"}))} className="accent-primary" /> 
                    Exact end time
                  </label>
                </div>
                {roomForm.timeMode === "duration" && (
                   <div className="flex gap-3">
                     <div className="flex-1 space-y-1">
                       <span className="text-xs text-muted-foreground">Hours</span>
                       <Input type="number" min={0} max={24} value={roomForm.durationHours || ""} onChange={e => setRoomForm(c => ({...c, durationHours: Number(e.target.value)}))} />
                     </div>
                     <div className="flex-1 space-y-1">
                       <span className="text-xs text-muted-foreground">Minutes</span>
                       <Input type="number" min={0} max={59} value={roomForm.durationMinutes || ""} onChange={e => setRoomForm(c => ({...c, durationMinutes: Number(e.target.value)}))} />
                     </div>
                   </div>
                )}
                {roomForm.timeMode === "exact" && (
                   <div className="space-y-1 mt-1">
                     <span className="text-xs text-muted-foreground">Select Date and Time</span>
                     <Input type="datetime-local" value={roomForm.endAt} onChange={e => setRoomForm(c => ({...c, endAt: e.target.value}))} />
                   </div>
                )}
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

          <div className="space-y-6 order-0 md:order-none">
            {/* Join with code */}
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

            {/* Pending Invites */}
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

            {/* Live Rooms */}
            <Card className="rounded-3xl border-border/60">
              <CardHeader>
                <CardTitle className="text-xl">Live rooms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setLocation(`/room/${room.id}`)}
                    className="w-full rounded-2xl border p-4 text-left transition border-border/60 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
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
                    <Button className="mt-3" size="sm" variant="secondary">
                      Join room
                    </Button>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
