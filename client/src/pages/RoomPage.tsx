import { useState, useEffect, useRef, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useActiveRoom } from "@/hooks/use-study-room";
import { useToast } from "@/hooks/use-toast";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  MessageSquare,
  LogOut,
  Users,
  Settings,
  Shield,
  VolumeX,
  UserMinus,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

function initials(name: string) {
  return name.substring(0, 2).toUpperCase();
}

type SignalPayload = {
  roomId: string;
  fromSocketId: string;
  fromUser: { userId: number; name: string };
  data: unknown;
};

export default function RoomPage() {
  const [, params] = useRoute("/room/:roomId");
  const roomId = params?.roomId;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const {
    socket,
    activeRoom,
    isConnected,
    isKicked,
    leaveRoom,
    sendMessage,
    updateMedia,
    signalPeer,
    kickUser,
    muteUser,
    updateSettings,
    deleteRoom,
    isRoomClosed,
  } = useActiveRoom(roomId || "", Boolean(user));

  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const remoteStreamsRef = useRef(new Map<string, MediaStream>());
  const pendingIceCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());

  const isHost = activeRoom?.createdBy.userId === user?.id;

  const currentParticipant = useMemo(
    () => activeRoom?.participants.find((p) => p.userId === user?.id) ?? null,
    [activeRoom, user?.id]
  );
  
  const remoteParticipants = useMemo(
    () => activeRoom?.participants.filter((p) => p.userId !== user?.id) ?? [],
    [activeRoom, user?.id]
  );

  // 1. Exact fix provided by user for camera
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        if (!mounted) return;

        // Initialize streams to false globally, let UI toggles turn them on
        stream.getVideoTracks().forEach(t => t.enabled = false);
        stream.getAudioTracks().forEach(t => t.enabled = false);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        cameraStreamRef.current = stream;
      } catch (e) {
        console.error("Camera init error", e);
      }
    }
    init();
    return () => {
      mounted = false;
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setLocation("/auth");
    }
  }, [user, setLocation]);

  useEffect(() => {
    if (isKicked) {
      toast({
        title: "Disconnected",
        description: "You have been removed from the room by the host.",
        variant: "destructive",
      });
      setLocation("/study");
    }
  }, [isKicked, setLocation, toast]);

  useEffect(() => {
    if (isRoomClosed) {
      toast({
        title: "Room Ended",
        description: "The host has permanently closed this room.",
      });
      setLocation("/study");
    }
  }, [isRoomClosed, setLocation, toast]);

  useEffect(() => {
    if (!socket) return;
    const handleMute = () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
        setIsAudioEnabled(false);
        updateMedia(isVideoEnabled, false, isScreenSharing);
        toast({ title: "Muted by Host" });
      }
    };
    const handleStopShare = () => {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        updateMedia(isVideoEnabled, isAudioEnabled, false);
        toast({ title: "Screen sharing disabled by Host" });
      }
    };

    socket.on("study:mute_remote", handleMute);
    socket.on("study:stop_screen_share", handleStopShare);
    return () => {
      socket.off("study:mute_remote", handleMute);
      socket.off("study:stop_screen_share", handleStopShare);
    };
  }, [socket, isVideoEnabled, isAudioEnabled, isScreenSharing, updateMedia, toast]);

  // Peer Connection management
  function getCurrentVideoTrack() {
    return (
      screenStreamRef.current?.getVideoTracks()[0] ??
      (isVideoEnabled ? cameraStreamRef.current?.getVideoTracks()[0] ?? null : null)
    );
  }

  function getCurrentAudioTrack() {
    return isAudioEnabled ? cameraStreamRef.current?.getAudioTracks()[0] ?? null : null;
  }

  async function syncPeerConnectionTracks(peer: RTCPeerConnection) {
    const videoTransceiver = peer.getTransceivers().find(t => t.sender.track?.kind === "video" || t.receiver.track.kind === "video");
    const audioTransceiver = peer.getTransceivers().find(t => t.sender.track?.kind === "audio" || t.receiver.track.kind === "audio");

    await videoTransceiver?.sender.replaceTrack(getCurrentVideoTrack() ?? null);
    await audioTransceiver?.sender.replaceTrack(getCurrentAudioTrack() ?? null);
  }

  async function syncAllPeerConnections() {
    for (const peer of Array.from(peerConnectionsRef.current.values())) {
      await syncPeerConnectionTracks(peer);
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
      if (!roomId || !event.candidate) return;
      signalPeer(remoteSocketId, event.candidate.toJSON());
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
          
          const pending = pendingIceCandidatesRef.current.get(payload.fromSocketId) ?? [];
          pendingIceCandidatesRef.current.delete(payload.fromSocketId);
          for (const candidate of pending) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          }

          if (signalData.type === "offer") {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            signalPeer(payload.fromSocketId, answer);
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
        if (!participant.isVideoEnabled && !participant.isAudioEnabled && !participant.isScreenSharing) {
          continue;
        }
        const peer = await ensurePeerConnection(participant.socketId);
        if (peer.signalingState === "stable" && currentParticipant.socketId < participant.socketId) {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          signalPeer(participant.socketId, offer);
        }
      }
    };
    void connectPeers();
  }, [activeRoom, currentParticipant, remoteParticipants, signalPeer]);

  const toggleMic = () => {
    const nextVal = !isAudioEnabled;
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getAudioTracks().forEach(t => t.enabled = nextVal);
    }
    setIsAudioEnabled(nextVal);
    syncAllPeerConnections();
    updateMedia(isVideoEnabled, nextVal, isScreenSharing);
  };

  const toggleCamera = () => {
    const nextVal = !isVideoEnabled;
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getVideoTracks().forEach(t => t.enabled = nextVal);
    }
    setIsVideoEnabled(nextVal);
    syncAllPeerConnections();
    updateMedia(nextVal, isAudioEnabled, isScreenSharing);
  };

  const startScreenShare = async () => {
    if (!activeRoom) return;
    
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      updateMedia(isVideoEnabled, isAudioEnabled, false);
      syncAllPeerConnections();
      return;
    }

    if (!activeRoom.allowScreenShare && !isHost) {
      toast({ title: "Screen sharing disabled by Host", variant: "destructive" });
      return;
    }

    const activeScreenShares = activeRoom.participants.filter(p => p.isScreenSharing).length;
    if (activeScreenShares >= 2) {
      toast({ title: "Max 2 screen shares allowed", variant: "destructive" });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = stream.getVideoTracks()[0];
      
      screenTrack.onended = () => {
         screenStreamRef.current = null;
         setIsScreenSharing(false);
         updateMedia(isVideoEnabled, isAudioEnabled, false);
         syncAllPeerConnections();
      };
      
      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      updateMedia(isVideoEnabled, isAudioEnabled, true);
      syncAllPeerConnections();

    } catch (e) {
      console.error(e);
    }
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput("");
  };

  const handleLeave = () => {
    leaveRoom();
    setLocation("/study");
  };

  if (!user || !roomId) return null;

  // Determine Main View
  const remoteScreenSharers = remoteParticipants.filter(p => p.isScreenSharing);
  const localScreenSharing = isScreenSharing;
  const isSomeoneSharing = remoteScreenSharers.length > 0 || localScreenSharing;
  
  const mainViewParticipant = localScreenSharing 
    ? currentParticipant 
    : (remoteScreenSharers[0] || null);
    
  return (
    <div className="h-screen w-screen bg-background text-foreground flex overflow-hidden font-sans">
      
      {/* Central Video Portal */}
      <div className={`flex flex-col flex-1 relative transition-all duration-300 ${isChatOpen ? 'pr-80' : ''}`}>
        
        {/* Header Indicator */}
        <div className="absolute top-0 left-0 w-full p-4 z-10 flex items-center justify-between">
           <div className="flex gap-2">
             <div className="bg-black/50 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm border border-white/10 flex items-center">
               <Shield className="w-4 h-4 mr-2 text-primary" />
               {activeRoom?.name || "Loading..."}
             </div>
             {isConnected && (
               <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs flex items-center border border-green-500/50">
                 <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                 Encrypted Signal
               </div>
             )}
           </div>
        </div>

        {/* Video Layout Grid vs Screen Share */}
        <div className="flex-1 p-4 lg:p-8 flex items-center justify-center pt-16 pb-24">
          {isSomeoneSharing ? (
            <div className="w-full h-full flex gap-4">
               {/* Main Presentation View */}
               <div className="flex-[3] relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center">
                 {mainViewParticipant?.userId === user.id ? (
                   <video 
                     autoPlay 
                     muted 
                     playsInline 
                     className="w-full h-full object-contain" 
                     ref={el => {
                       if (el && screenStreamRef.current) {
                         el.srcObject = screenStreamRef.current;
                       }
                     }} 
                   />
                 ) : (
                   <video 
                     autoPlay 
                     playsInline 
                     className="w-full h-full object-contain"
                     ref={el => {
                       if (el && mainViewParticipant) {
                         const stream = remoteStreamsRef.current.get(mainViewParticipant.socketId);
                         if (stream && el.srcObject !== stream) {
                           el.srcObject = stream;
                           el.play().catch(() => {});
                         }
                       }
                     }} 
                   />
                 )}
                 <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded text-sm text-white/90">
                   {mainViewParticipant?.name}
                 </div>
               </div>
               
               {/* Side Strip */}
               <div className="flex-1 max-w-[300px] flex flex-col gap-4 overflow-y-auto pr-2 pb-2">
                  <div className="w-full aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 relative">
                     <video 
                        autoPlay 
                        muted 
                        playsInline 
                        className="w-full h-full object-cover scale-x-[-1]" 
                        ref={el => {
                          if (el && cameraStreamRef.current) {
                            el.srcObject = cameraStreamRef.current;
                          }
                        }}
                     />
                     <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 text-xs rounded text-white/90">You</div>
                  </div>
                  {remoteParticipants.filter(p => !p.isScreenSharing).map(p => (
                    <div key={p.socketId} className="w-full aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 relative group">
                       <video 
                         autoPlay 
                         playsInline 
                         className="w-full h-full object-cover"
                         ref={el => {
                           if (el) {
                             remoteVideoRefs.current.set(p.socketId, el);
                             if (remoteStreamsRef.current.has(p.socketId)) {
                               const stream = remoteStreamsRef.current.get(p.socketId)!;
                               if (el.srcObject !== stream) {
                                 el.srcObject = stream;
                                 el.play().catch(() => {});
                               }
                             }
                           }
                         }} 
                       />
                       <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 text-xs rounded flex items-center gap-2">
                         {p.name}
                         {!p.isAudioEnabled && <VolumeX className="w-3 h-3 text-red-400" />}
                       </div>
                       {isHost && (
                         <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                           <Button size="icon" variant="destructive" className="h-6 w-6 rounded" title="Mute" onClick={() => muteUser(p.socketId)}>
                             <VolumeX className="w-3 h-3" />
                           </Button>
                           <Button size="icon" variant="destructive" className="h-6 w-6 rounded" title="Kick" onClick={() => kickUser(p.socketId)}>
                             <UserMinus className="w-3 h-3" />
                           </Button>
                         </div>
                       )}
                    </div>
                  ))}
               </div>
            </div>
          ) : (() => {
            const totalUsers = remoteParticipants.length + 1;
            let gridCols = "grid-cols-1";
            if (totalUsers === 2) gridCols = "grid-cols-1 md:grid-cols-2";
            else if (totalUsers === 3 || totalUsers === 4) gridCols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2";
            else if (totalUsers >= 5) gridCols = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
            return (
              <div className={`w-full h-full mx-auto p-4 lg:p-8 ${totalUsers === 1 ? "flex items-center justify-center max-w-5xl" : `grid auto-rows-[1fr] gap-4 ${gridCols}`}`}>
                <div className={`bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 relative group shadow-lg ${totalUsers === 1 ? "w-full aspect-video" : "w-full h-full"}`}>
                   {isVideoEnabled ? (
                     <video 
                       autoPlay 
                       muted 
                       playsInline 
                       className="w-full h-full object-cover scale-x-[-1]" 
                       ref={el => {
                         if (el && cameraStreamRef.current) {
                           el.srcObject = cameraStreamRef.current;
                         }
                       }}
                     />
                   ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800/50">
                       <Avatar className="w-32 h-32 border-4 border-zinc-700">
                          <AvatarFallback className="text-4xl bg-zinc-700 text-zinc-300">{initials(user?.nickName || user?.email || "You")}</AvatarFallback>
                       </Avatar>
                     </div>
                   )}
                   <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 text-sm rounded shadow-lg backdrop-blur-sm text-white/90">You</div>
                   {(!isVideoEnabled || !isAudioEnabled) && (
                     <div className="absolute top-4 right-4 flex gap-2">
                       {!isVideoEnabled && <div className="bg-red-500/80 p-1.5 rounded text-white shadow"><VideoOff className="w-4 h-4"/></div>}
                       {!isAudioEnabled && <div className="bg-red-500/80 p-1.5 rounded text-white shadow"><MicOff className="w-4 h-4"/></div>}
                     </div>
                   )}
                </div>
                {remoteParticipants.map(participant => (
                  <div key={participant.socketId} className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 relative group shadow-lg">
                     {participant.isVideoEnabled ? (
                     <video 
                       autoPlay 
                       playsInline 
                       className="w-full h-full object-cover"
                       ref={el => {
                         if (el) {
                           remoteVideoRefs.current.set(participant.socketId, el);
                           if (remoteStreamsRef.current.has(participant.socketId)) {
                             const stream = remoteStreamsRef.current.get(participant.socketId)!;
                             if (el.srcObject !== stream) {
                               el.srcObject = stream;
                               el.play().catch(() => {});
                             }
                           }
                         }
                       }} 
                     />
                   ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800/50">
                       <Avatar className="w-24 h-24 border-4 border-zinc-700">
                         <AvatarFallback className="text-3xl bg-zinc-700 text-zinc-300">{initials(participant.name)}</AvatarFallback>
                       </Avatar>
                     </div>
                   )}
                   <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 text-sm rounded shadow-lg backdrop-blur-sm flex items-center gap-2">
                     {participant.name}
                     {participant.role === "faculty" && <Badge variant="secondary" className="ml-2 text-[10px] uppercase">Teacher</Badge>}
                   </div>
                   {(!participant.isVideoEnabled || !participant.isAudioEnabled) && (
                     <div className="absolute top-4 left-4 flex gap-2">
                       {!participant.isVideoEnabled && <div className="bg-zinc-800/80 p-1.5 rounded text-zinc-300 shadow"><VideoOff className="w-4 h-4"/></div>}
                       {!participant.isAudioEnabled && <div className="bg-red-500/80 p-1.5 rounded text-white shadow"><MicOff className="w-4 h-4"/></div>}
                     </div>
                   )}

                   {isHost && (
                     <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                       <Button size="sm" variant="destructive" className="h-8 max-w-fit shadow-lg shadow-black/50" onClick={() => muteUser(participant.socketId)}>
                         <VolumeX className="w-4 h-4 mr-2" /> Mute
                       </Button>
                       <Button size="sm" variant="destructive" className="h-8 max-w-fit shadow-lg shadow-black/50" onClick={() => kickUser(participant.socketId)}>
                         <UserMinus className="w-4 h-4 mr-2" /> Kick
                       </Button>
                     </div>
                   )}
                </div>
              ))}
            </div>
            );
          })()}
        </div>

        {/* Bottom Control Bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-card/90 border border-border/50 backdrop-blur-md p-2 rounded-2xl shadow-2xl overflow-hidden">
          <Button 
            variant={isAudioEnabled ? "secondary" : "destructive"} 
            size="icon" 
            className={`w-12 h-12 rounded-xl transition`}
            onClick={toggleMic}
            title={isAudioEnabled ? "Mute" : "Unmute"}
          >
            {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>

          <Button 
            variant={isVideoEnabled ? "secondary" : "destructive"} 
            size="icon" 
            className={`w-12 h-12 rounded-xl transition`}
            onClick={toggleCamera}
            title={isVideoEnabled ? "Stop Video" : "Start Video"}
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>

          <Button 
            variant={isScreenSharing ? "default" : "secondary"} 
            size="icon" 
            className={`w-12 h-12 rounded-xl transition`}
            onClick={startScreenShare}
            title={isScreenSharing ? "Stop sharing" : "Share Screen"}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
          </Button>

          <div className="w-px h-8 bg-border mx-2" />

          {isHost && (
            <>
              <Button 
                variant={activeRoom?.allowScreenShare ? "secondary" : "destructive"}
                size="icon"
                className={`w-12 h-12 rounded-xl transition`}
                onClick={() => updateSettings(!activeRoom?.allowScreenShare)}
                title={activeRoom?.allowScreenShare ? "Lock screen share" : "Allow screen share"}
              >
                <Settings className="w-5 h-5" />
              </Button>
              <Button 
                variant="destructive"
                className="h-12 px-4 rounded-xl font-medium shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                onClick={() => {
                  if (confirm("Are you sure you want to permanently end this session? Everyone will be disconnected and the room will be deleted.")) {
                    deleteRoom();
                  }
                }}
                title="Permanently End Session and Delete Room"
              >
                End Session
              </Button>
            </>
          )}

          <Button 
            variant={isChatOpen ? "default" : "secondary"} 
            size="icon" 
            className={`w-12 h-12 rounded-xl transition`}
            onClick={() => setIsChatOpen(!isChatOpen)}
            title="Chat Panel"
          >
            <MessageSquare className="w-5 h-5" />
          </Button>

          <div className="w-px h-8 bg-border mx-2" />

          <Button 
            variant="destructive" 
            className="h-12 px-6 rounded-xl font-medium"
            onClick={handleLeave}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Leave
          </Button>
        </div>
      </div>

      {/* Slide-in Chat Panel */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-card border-l border-border shadow-2xl transform transition-transform duration-300 z-50 flex flex-col ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
          <h3 className="font-semibold flex items-center">
            <MessageSquare className="w-4 h-4 mr-2" /> In-call Messages
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50" onClick={() => setIsChatOpen(false)}>
             <MonitorOff className="w-4 h-4 opacity-0" /> {/* Spacer basically, or an X icon ideally */}
             &times;
          </Button>
        </div>
        
        <ScrollArea className="flex-1 p-4">
           {activeRoom?.messages.length === 0 ? (
             <div className="text-muted-foreground text-sm text-center mt-10">
                No messages yet.<br/>Say hi to start the conversation.
             </div>
           ) : (
             <div className="space-y-4">
                {activeRoom?.messages.map(msg => (
                  <div key={msg.id} className="flex flex-col">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-medium text-sm text-foreground">{msg.user.name}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="bg-secondary text-secondary-foreground text-sm px-3 py-2 rounded-lg rounded-tl-none w-fit max-w-[90%] break-words">
                      {msg.text}
                    </div>
                  </div>
                ))}
             </div>
           )}
        </ScrollArea>

        <div className="p-4 bg-muted/30 border-t border-border flex gap-2">
          <Input 
             className="bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
             placeholder="Message..." 
             value={chatInput}
             onChange={e => setChatInput(e.target.value)}
             onKeyDown={e => e.key === "Enter" && handleSendChat()}
          />
          <Button size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleSendChat}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
