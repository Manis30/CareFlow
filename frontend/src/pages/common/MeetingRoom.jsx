import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Clock,
  AlertCircle,
  Maximize,
  Minimize,
  Radio,
  User,
  RefreshCw
} from 'lucide-react';
import { getMeetingAccessApi } from '../../api/appointment';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../socket/socket';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

const CONNECTION_STATES = {
  MEDIA_REQUESTING: 'MEDIA_REQUESTING',
  MEDIA_READY: 'MEDIA_READY',
  WAITING_FOR_OTHER_PARTICIPANT: 'WAITING_FOR_OTHER_PARTICIPANT',
  CONNECTING: 'CONNECTING',
  NEGOTIATING: 'NEGOTIATING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR'
};

// Production consultation access validation active (5 minutes before appointment start time)
const BYPASS_CONSULTATION_ACCESS_VALIDATION = false;

const MeetingRoom = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Core Access & Connection States
  const [accessData, setAccessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deviceErrorType, setDeviceErrorType] = useState(null);
  const [connectionState, setConnectionState] = useState(CONNECTION_STATES.MEDIA_REQUESTING);
  const [isMeetingExpired, setIsMeetingExpired] = useState(false);

  // Strictly Separated MediaStreams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // Audio/Video Track & Real-Time Sync States
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [remoteMicMuted, setRemoteMicMuted] = useState(false);
  const [remoteCameraEnabled, setRemoteCameraEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Stable Refs (Separated Local and Remote Video DOM Elements)
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const socketRef = useRef(null);
  const containerRef = useRef(null);
  const makingOfferRef = useRef(false);
  const isInitializedRef = useRef(false);

  // Determine Perfect Negotiation politeness deterministically (Doctor is polite, Patient is impolite)
  const isPolite = user?.role === 'doctor';

  useEffect(() => {
    const userId = user?._id || user?.id || 'authenticated_user';
    console.log(`[CareFlow WebRTC] Initializing session for appt: ${appointmentId}, User: ${userId} (${user?.role})`);
    if (appointmentId && !isInitializedRef.current) {
      isInitializedRef.current = true;
      initSession();
    }

    return () => {
      cleanupMediaAndWebRTC();
      isInitializedRef.current = false;
    };
  }, [appointmentId]);

  // Automatic consultation scheduled end-time monitoring
  useEffect(() => {
    if (!accessData || !accessData.endTime) return;

    const datePart = new Date(accessData.appointmentDate || Date.now()).toISOString().split('T')[0];
    const timeMatch = String(accessData.endTime).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);

    let hours = 0;
    let minutes = 0;
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      const period = timeMatch[3]?.toUpperCase();
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
    }

    const endIso = `${datePart}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    const endTimeMs = new Date(endIso).getTime();

    const checkExpiry = () => {
      if (Date.now() >= endTimeMs) {
        console.log('[CareFlow WebRTC] Scheduled consultation end time reached! Closing room automatically...');
        setIsMeetingExpired(true);
        cleanupMediaAndWebRTC();
        setTimeout(() => {
          if (user?.role === 'doctor') {
            navigate(`/doctor/appointments/${appointmentId}`);
          } else {
            navigate(`/patient/appointments/${appointmentId}`);
          }
        }, 4000);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 5000);
    return () => clearInterval(interval);
  }, [accessData, appointmentId, navigate, user?.role]);

  // Guaranteed attachment of remoteStream to remoteVideoRef DOM element
  useEffect(() => {
    const video = remoteVideoRef.current;
    if (!video || !remoteStream) return;

    if (video.srcObject !== remoteStream) {
      console.log('[CareFlow WebRTC] Binding remoteStream to remoteVideoRef DOM element. Tracks:', remoteStream.getTracks().map((t) => `${t.kind}:${t.enabled}:${t.readyState}`));
      video.srcObject = remoteStream;
    }

    const playVideo = async () => {
      try {
        await video.play();
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[CareFlow WebRTC] remoteVideo play failed:', err);
        }
      }
    };

    playVideo();
  }, [remoteStream]);

  // Guaranteed attachment of localStream to localVideoRef DOM element
  useEffect(() => {
    const video = localVideoRef.current;
    if (!video || !localStream) return;

    if (video.srcObject !== localStream) {
      console.log('[CareFlow WebRTC] Binding localStream to localVideoRef DOM element. Tracks:', localStream.getTracks().map((t) => `${t.kind}:${t.enabled}:${t.readyState}`));
      video.srcObject = localStream;
    }

    const playLocal = async () => {
      try {
        await video.play();
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[CareFlow WebRTC] localVideo play failed:', err);
        }
      }
    };

    playLocal();
  }, [localStream, isVideoEnabled]);

  const initSession = async () => {
    try {
      setLoading(true);
      setError('');
      setDeviceErrorType(null);

      // 1. Verify Appointment & Meeting Authorization
      console.log(`[CareFlow WebRTC] Fetching meeting access for appt: ${appointmentId}`);
      const res = await getMeetingAccessApi(appointmentId);
      const data = res.data || res;
      setAccessData(data);

      const effectiveCanJoin = BYPASS_CONSULTATION_ACCESS_VALIDATION ? true : data.canJoin;

      if (!effectiveCanJoin) {
        setConnectionState(CONNECTION_STATES.ERROR);
        setLoading(false);
        return;
      }

      // 2. Initialize Camera & Microphone MediaStream (Acquired once and reused)
      await acquireUserMedia();

      // 3. Connect Socket & Join Room
      setupSocketAndJoinRoom(data);
    } catch (err) {
      console.error('[CareFlow WebRTC Error] Session init error:', err);
      setError(err.message || 'Failed to verify consultation meeting authorization.');
      setConnectionState(CONNECTION_STATES.ERROR);
    } finally {
      setLoading(false);
    }
  };

  const acquireUserMedia = async () => {
    if (localStreamRef.current) {
      console.log('[CareFlow WebRTC] Reusing existing local MediaStream instance.');
      setLocalStream(localStreamRef.current);
      setConnectionState(CONNECTION_STATES.MEDIA_READY);
      return;
    }

    setConnectionState(CONNECTION_STATES.MEDIA_REQUESTING);
    try {
      console.log('[CareFlow WebRTC] Requesting camera/microphone permissions...');
      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        });
      } catch (firstErr) {
        console.warn('[CareFlow WebRTC] Default getUserMedia failed, attempting fallback constraints:', firstErr.name);
        if (firstErr.name === 'NotReadableError') {
          stream = createFallbackMediaStream();
        } else {
          throw firstErr;
        }
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      const vTrack = stream.getVideoTracks()[0];
      const aTrack = stream.getAudioTracks()[0];

      setIsVideoEnabled(Boolean(vTrack && vTrack.enabled));
      setIsAudioEnabled(Boolean(aTrack && aTrack.enabled));
      setIsMicMuted(!Boolean(aTrack && aTrack.enabled));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setConnectionState(CONNECTION_STATES.MEDIA_READY);
      console.log(`[CareFlow WebRTC] Media acquired successfully. Video tracks: ${stream.getVideoTracks().length}, Audio tracks: ${stream.getAudioTracks().length}`);
    } catch (err) {
      console.error('[CareFlow WebRTC Error] getUserMedia failed:', err.name, err.message);
      setDeviceErrorType(err.name);

      let msg = 'Failed to access camera or microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera or microphone permission was blocked in your browser settings. Please allow access and retry.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera or microphone device was found on your system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera or microphone is currently in use by another application or browser window.';
      } else if (err.name === 'OverconstrainedError') {
        msg = 'The required camera resolution or settings are not supported by your device.';
      } else {
        msg = `Device Error (${err.name}): ${err.message}`;
      }

      setError(msg);
      setConnectionState(CONNECTION_STATES.ERROR);
      throw err;
    }
  };

  const createFallbackMediaStream = () => {
    console.log('[CareFlow WebRTC] Creating virtual fallback video stream for testing...');
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    const animate = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#14b8a6';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CareFlow Virtual Video Stream', canvas.width / 2, canvas.height / 2);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.fillText(`User: ${user?.name || 'Participant'} (${user?.role})`, canvas.width / 2, canvas.height / 2 + 30);
      requestAnimationFrame(animate);
    };
    animate();

    const canvasStream = canvas.captureStream(30);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const dst = audioCtx.createMediaStreamDestination();
    osc.connect(dst);
    osc.start();
    const silentAudioTrack = dst.stream.getAudioTracks()[0];
    canvasStream.addTrack(silentAudioTrack);

    return canvasStream;
  };

  const emitCurrentMediaState = () => {
    if (socketRef.current && localStreamRef.current) {
      const aTracks = localStreamRef.current.getAudioTracks();
      const vTracks = localStreamRef.current.getVideoTracks();

      const aTrack = aTracks[0];
      const vTrack = vTracks[0];

      if (aTrack) {
        socketRef.current.emit('participant_media_state_changed', {
          appointmentId,
          userId: user?.id || user?._id,
          role: user?.role,
          mediaType: 'microphone',
          enabled: aTrack.enabled,
          isMuted: !aTrack.enabled
        });
      }

      if (vTrack) {
        socketRef.current.emit('participant_media_state_changed', {
          appointmentId,
          userId: user?.id || user?._id,
          role: user?.role,
          mediaType: 'camera',
          enabled: vTrack.enabled,
          isMuted: !vTrack.enabled
        });
      }
    }
  };

  const setupSocketAndJoinRoom = (accessInfo) => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) {
      console.log('[CareFlow WebRTC] Connecting Socket.IO client...');
      socket.connect();
    }

    socket.off('connect');
    socket.off('disconnect');

    socket.on('connect', () => {
      console.log(`[CareFlow WebRTC] Socket connected (ID: ${socket.id}). Emitting join_video_room...`);
      emitJoinRoom(socket, accessInfo);
    });

    socket.on('disconnect', () => {
      console.warn('[CareFlow WebRTC] Socket disconnected.');
    });

    setupSignalingListeners(socket);

    if (socket.connected) {
      emitJoinRoom(socket, accessInfo);
    }
  };

  const emitJoinRoom = (socket, accessInfo) => {
    console.log(`[CareFlow WebRTC] Emitting join_video_room for appt: ${appointmentId}`);
    socket.emit('join_video_room', { appointmentId }, (response) => {
      console.log('[CareFlow WebRTC] join_video_room ack response:', response);
      if (response && response.success) {
        handleRoomJoined(response.peers, socket);
        emitCurrentMediaState();
      } else if (response && response.message) {
        setError(response.message);
        setConnectionState(CONNECTION_STATES.ERROR);
      }
    });
  };

  const setupSignalingListeners = (socket) => {
    socket.off('peer_joined');
    socket.off('webrtc_offer');
    socket.off('webrtc_answer');
    socket.off('webrtc_ice_candidate');
    socket.off('participant_media_state_changed');
    socket.off('peer_left');
    socket.off('video_error');

    socket.on('peer_joined', ({ socketId, user: peerUser }) => {
      console.log(`[CareFlow WebRTC] Event peer_joined: New peer ${peerUser?.id} (${peerUser?.role}) joined with Socket ID: ${socketId}`);
      setConnectionState(CONNECTION_STATES.NEGOTIATING);

      // Existing peer in room creates initial SDP Offer and broadcasts current media state to new peer
      initiateWebRTCOffer(socketId, socket);
      emitCurrentMediaState();
    });

    socket.on('webrtc_offer', async ({ callerSocketId, callerUser, offer }) => {
      console.log(`[CareFlow WebRTC] Event webrtc_offer received from caller Socket ID: ${callerSocketId}`);
      setConnectionState(CONNECTION_STATES.NEGOTIATING);

      await handleIncomingOffer(callerSocketId, offer, socket);
    });

    socket.on('webrtc_answer', async ({ responderSocketId, answer }) => {
      console.log(`[CareFlow WebRTC] Event webrtc_answer received from responder Socket ID: ${responderSocketId}`);

      await handleIncomingAnswer(answer);
    });

    socket.on('webrtc_ice_candidate', async ({ candidate }) => {
      if (candidate) {
        await handleIncomingICECandidate(candidate);
      }
    });

    socket.on('participant_media_state_changed', (data) => {
      console.log('[CareFlow WebRTC Client] participant_media_state_changed received:', data);
      const senderId = data.userId || data.user?.id || data.user?._id;
      const myId = user?.id || user?._id;

      if (senderId && myId && senderId.toString() === myId.toString()) return;

      if (data.mediaType === 'microphone') {
        setRemoteMicMuted(Boolean(data.isMuted));
      } else if (data.mediaType === 'camera') {
        setRemoteCameraEnabled(Boolean(data.enabled));
      }
    });

    socket.on('peer_left', ({ socketId, user: peerUser }) => {
      console.log(`[CareFlow WebRTC] Event peer_left: Socket ${socketId} left room.`);
      setConnectionState(CONNECTION_STATES.WAITING_FOR_OTHER_PARTICIPANT);
      setRemoteStream(null);
      setRemoteMicMuted(false);
      setRemoteCameraEnabled(true);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    });

    socket.on('video_error', ({ message }) => {
      console.error('[CareFlow WebRTC Error] video_error received:', message);
      setError(message);
      setConnectionState(CONNECTION_STATES.ERROR);
    });
  };

  const handleRoomJoined = (peers, socket) => {
    if (peers && peers.length > 0) {
      const targetPeer = peers[0];
      console.log(`[CareFlow WebRTC] Joined room with 1 active peer (${targetPeer.socketId}). Waiting for existing peer to offer...`);
      setConnectionState(CONNECTION_STATES.NEGOTIATING);
      // Joining peer waits for the offer from existing peer
    } else {
      console.log('[CareFlow WebRTC] No peers currently in room. Waiting for second participant to join...');
      setConnectionState(CONNECTION_STATES.WAITING_FOR_OTHER_PARTICIPANT);
    }
  };

  const getOrCreatePeerConnection = (targetSocketId, socket) => {
    let pc = peerConnectionRef.current;
    if (pc && pc.signalingState !== 'closed' && pc.connectionState !== 'closed') {
      console.log('[CareFlow WebRTC] Reusing existing active RTCPeerConnection instance.');
      return pc;
    }

    if (pc) {
      console.log('[CareFlow WebRTC] Closing stale RTCPeerConnection instance...');
      pc.close();
    }

    console.log('[CareFlow WebRTC] Creating new RTCPeerConnection with STUN servers...');
    pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;
    pendingCandidatesRef.current = [];

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        console.log(`[CareFlow WebRTC] Adding local track (${track.kind}, enabled=${track.enabled}) to PeerConnection`);
        pc.addTrack(track, stream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc_ice_candidate', {
          targetSocketId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[CareFlow WebRTC] Remote track received on PeerConnection:', event.track.kind, 'id:', event.track.id);

      const incomingStream = event.streams?.[0];

      if (incomingStream) {
        setRemoteStream(incomingStream);
      } else {
        setRemoteStream((currentStream) => {
          const stream = currentStream || new MediaStream();
          if (!stream.getTracks().some((track) => track.id === event.track.id)) {
            stream.addTrack(event.track);
          }
          return stream;
        });
      }

      setConnectionState(CONNECTION_STATES.CONNECTED);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[CareFlow WebRTC] Peer Connection StateChanged: ${pc.connectionState}`);

      if (pc.connectionState === 'connected') {
        setConnectionState(CONNECTION_STATES.CONNECTED);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionState(CONNECTION_STATES.WAITING_FOR_OTHER_PARTICIPANT);
        setRemoteStream(null);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      }
    };

    return pc;
  };

  const initiateWebRTCOffer = async (targetSocketId, socket) => {
    if (makingOfferRef.current) {
      console.warn('[CareFlow WebRTC] Skipping duplicate initiateWebRTCOffer call while offer creation is in progress.');
      return;
    }

    try {
      makingOfferRef.current = true;
      const pc = getOrCreatePeerConnection(targetSocketId, socket);

      if (pc.signalingState !== 'stable') {
        console.warn(`[CareFlow WebRTC] Cannot create offer while signalingState is '${pc.signalingState}'`);
        return;
      }

      console.log('[CareFlow WebRTC] Creating SDP Offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('[CareFlow WebRTC] Sending SDP Offer via socket signaling...');
      socket.emit('webrtc_offer', { targetSocketId, offer: pc.localDescription });
    } catch (err) {
      console.error('[CareFlow WebRTC Error] createOffer failed:', err);
    } finally {
      makingOfferRef.current = false;
    }
  };

  const handleIncomingOffer = async (callerSocketId, offer, socket) => {
    try {
      const pc = getOrCreatePeerConnection(callerSocketId, socket);

      const offerCollision = makingOfferRef.current || pc.signalingState !== 'stable';
      const ignoreOffer = !isPolite && offerCollision;

      if (ignoreOffer) {
        console.warn('[CareFlow WebRTC] Impolite peer ignoring colliding offer.');
        return;
      }

      if (offerCollision && isPolite) {
        console.log('[CareFlow WebRTC] Polite peer rolling back colliding offer...');
        await Promise.all([
          pc.setLocalDescription({ type: 'rollback' }),
          pc.setRemoteDescription(new RTCSessionDescription(offer))
        ]);
      } else {
        console.log('[CareFlow WebRTC] Setting Remote Description from SDP Offer...');
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
      }

      await flushPendingICECandidates(pc);

      console.log('[CareFlow WebRTC] Creating SDP Answer...');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('[CareFlow WebRTC] Sending SDP Answer via socket signaling...');
      socket.emit('webrtc_answer', { targetSocketId: callerSocketId, answer: pc.localDescription });
    } catch (err) {
      console.error('[CareFlow WebRTC Error] handleIncomingOffer failed:', err);
    }
  };

  const handleIncomingAnswer = async (answer) => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.warn('[CareFlow WebRTC] Received answer but no peer connection instance exists.');
        return;
      }

      if (pc.signalingState !== 'have-local-offer') {
        console.warn(`[CareFlow WebRTC] Skipping setRemoteDescription(answer) because signalingState is '${pc.signalingState}' (expected 'have-local-offer')`);
        return;
      }

      console.log('[CareFlow WebRTC] Setting Remote Description from SDP Answer...');
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      await flushPendingICECandidates(pc);
    } catch (err) {
      console.error('[CareFlow WebRTC Error] handleIncomingAnswer failed:', err);
    }
  };

  const handleIncomingICECandidate = async (candidate) => {
    const pc = peerConnectionRef.current;
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[CareFlow WebRTC Error] addIceCandidate failed:', err);
      }
    } else {
      console.log('[CareFlow WebRTC] Queuing ICE Candidate (remoteDescription not set yet)...');
      pendingCandidatesRef.current.push(candidate);
    }
  };

  const flushPendingICECandidates = async (pc) => {
    if (pendingCandidatesRef.current.length > 0) {
      console.log(`[CareFlow WebRTC] Flushing ${pendingCandidatesRef.current.length} queued ICE candidate(s)...`);
      const candidates = [...pendingCandidatesRef.current];
      pendingCandidatesRef.current = [];
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding queued ICE candidate:', e);
        }
      }
    }
  };

  // Complete Audio Mute (Disables ALL actual MediaStreamTracks in localStream)
  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach((track) => {
          track.enabled = !track.enabled;
        });

        const isMuted = audioTracks.every((track) => !track.enabled);
        setIsAudioEnabled(!isMuted);
        setIsMicMuted(isMuted);

        console.log(`[CareFlow WebRTC] Real Audio Tracks toggled. Muted: ${isMuted}`);

        if (socketRef.current) {
          socketRef.current.emit('participant_media_state_changed', {
            appointmentId,
            userId: user?.id || user?._id,
            role: user?.role,
            mediaType: 'microphone',
            enabled: !isMuted,
            isMuted
          });
        }
      }
    }
  };

  // Camera Toggle
  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach((track) => {
          track.enabled = !track.enabled;
        });

        const enabled = videoTracks.some((track) => track.enabled);
        setIsVideoEnabled(enabled);
        console.log(`[CareFlow WebRTC] Camera Video Tracks toggled to: ${enabled}`);

        if (socketRef.current) {
          socketRef.current.emit('participant_media_state_changed', {
            appointmentId,
            userId: user?.id || user?._id,
            role: user?.role,
            mediaType: 'camera',
            enabled,
            isMuted: !enabled
          });
        }
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const cleanupMediaAndWebRTC = () => {
    console.log('[CareFlow WebRTC] Cleaning up media streams, WebRTC PeerConnection, and Socket handlers...');
    if (socketRef.current) {
      socketRef.current.emit('leave_video_room', { appointmentId });
      socketRef.current.off('peer_joined');
      socketRef.current.off('webrtc_offer');
      socketRef.current.off('webrtc_answer');
      socketRef.current.off('webrtc_ice_candidate');
      socketRef.current.off('participant_media_state_changed');
      socketRef.current.off('peer_left');
      socketRef.current.off('video_error');
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    if (peerConnectionRef.current) {
      const pc = peerConnectionRef.current;
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.onsignalingstatechange = null;
      pc.getSenders().forEach((sender) => {
        try {
          pc.removeTrack(sender);
        } catch (e) {}
      });
      pc.close();
      peerConnectionRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    localStreamRef.current = null;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  const handleLeave = () => {
    cleanupMediaAndWebRTC();
    if (user?.role === 'doctor') {
      navigate(`/doctor/appointments/${appointmentId}`);
    } else {
      navigate(`/patient/appointments/${appointmentId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4 p-4 font-sans">
        <Loader size="lg" text="Verifying consultation security & initializing WebRTC session..." />
      </div>
    );
  }

  if (error || !accessData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Consultation Access Error</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {error || 'You are not authorized to join this consultation meeting.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            {deviceErrorType && (
              <Button variant="primary" size="sm" onClick={() => initSession()} icon={RefreshCw}>
                Retry Device Access
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} icon={ArrowLeft} className="border-slate-700 text-slate-300 hover:bg-slate-800">
              Back to Appointment Details
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!BYPASS_CONSULTATION_ACCESS_VALIDATION && !accessData.canJoin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-lg w-full text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-400 flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <span className="px-3 py-1 bg-amber-950 text-amber-300 border border-amber-800 rounded-full text-[11px] font-bold uppercase tracking-wider">
              Consultation Closed
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight mt-3">Consultation Access Restricted</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {accessData.reason || 'This consultation has ended or is not currently open.'}
            </p>
            {accessData.startTime && (
              <div className="mt-4 p-3 bg-slate-800/80 rounded-xl border border-slate-700 inline-block text-xs font-semibold text-blue-300">
                Scheduled: {formatDate(accessData.appointmentDate)} from {formatTime(accessData.startTime)} to {formatTime(accessData.endTime)}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} icon={ArrowLeft} className="mx-auto border-slate-700 text-slate-300 hover:bg-slate-800">
            Back to Appointment Details
          </Button>
        </div>
      </div>
    );
  }

  const isDoctorRole = user?.role === 'doctor';
  const otherParticipantTitle = isDoctorRole
    ? (accessData.patientName || 'Patient')
    : (accessData.doctorName || 'Doctor');

  // Verify live video track presence for UI state
  const remoteVideoTrack = remoteStream?.getVideoTracks().find((t) => t.readyState === 'live');
  const hasRemoteVideo = Boolean(remoteVideoTrack) && remoteCameraEnabled;

  return (
    <div ref={containerRef} className="h-screen w-screen bg-slate-950 flex flex-col font-sans overflow-hidden select-none relative">
      {/* AUTOMATIC EXPIRY MODAL OVERLAY */}
      {isMeetingExpired && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans backdrop-blur-md">
          <div className="w-16 h-16 rounded-full bg-amber-950/80 border border-amber-800 text-amber-400 flex items-center justify-center mx-auto shadow-2xl">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Scheduled Consultation Time Completed</h2>
          <p className="text-sm text-slate-300 max-w-md leading-relaxed">
            This consultation has ended because the scheduled appointment time has been completed.
          </p>
          <p className="text-xs text-slate-500">Redirecting to appointment details...</p>
        </div>
      )}

      {/* TOP BAR */}
      <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shrink-0 shadow-xs">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
              CareFlow Online Consultation
              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold tracking-wide flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                SECURE WEBRTC
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>{accessData.doctorName} • Patient: {accessData.patientName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Remote Mic Muted Badge in Top Bar */}
          {remoteMicMuted && (
            <span className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800 text-[10px] font-bold shadow-2xs">
              <MicOff className="w-3 h-3 text-rose-400 shrink-0" />
              <span>{otherParticipantTitle} Muted</span>
            </span>
          )}

          {/* Connection Status Badge */}
          {hasRemoteVideo || connectionState === CONNECTION_STATES.CONNECTED ? (
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Connected (Live HD Video)
            </span>
          ) : connectionState === CONNECTION_STATES.NEGOTIATING || connectionState === CONNECTION_STATES.CONNECTING ? (
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-full text-[11px] font-bold">
              <Clock className="w-3 h-3 animate-spin text-indigo-400" />
              Connecting securely...
            </span>
          ) : (
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-950 text-amber-300 border border-amber-800 rounded-full text-[11px] font-bold">
              <Clock className="w-3 h-3 text-amber-400" />
              Waiting for {otherParticipantTitle} to join...
            </span>
          )}

          <Button variant="danger" size="sm" onClick={handleLeave} icon={PhoneOff} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
            Leave Consultation
          </Button>
        </div>
      </header>

      {/* MAIN VIDEO VIEWPORT */}
      <div className="flex-1 w-full bg-slate-950 relative overflow-hidden flex items-center justify-center">
        {/* Remote Mic Muted Floating Badge */}
        {remoteMicMuted && (
          <div className="absolute top-4 left-4 z-20 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-2 backdrop-blur-md shadow-lg">
            <MicOff className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{otherParticipantTitle}'s microphone is muted</span>
          </div>
        )}

        {/* Remote Video Element */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-contain bg-black ${hasRemoteVideo ? 'block' : 'hidden'}`}
        />

        {/* Remote Waiting / Camera Off Placeholder */}
        {!hasRemoteVideo && (
          <div className="text-center space-y-4 max-w-sm px-6">
            <div className="w-24 h-24 rounded-full bg-slate-800/80 border-2 border-dashed border-slate-700 text-slate-400 flex items-center justify-center mx-auto shadow-2xl">
              {!remoteCameraEnabled ? <VideoOff className="w-12 h-12 text-slate-400" /> : <User className="w-12 h-12" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {!remoteCameraEnabled
                  ? `${otherParticipantTitle} turned off their camera`
                  : connectionState === CONNECTION_STATES.NEGOTIATING || connectionState === CONNECTION_STATES.CONNECTING
                  ? 'Connecting Securely...'
                  : `Waiting for ${otherParticipantTitle} to Join`}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {!remoteCameraEnabled
                  ? 'Microphone remains active. Video feed will reappear when camera is turned back on.'
                  : connectionState === CONNECTION_STATES.NEGOTIATING || connectionState === CONNECTION_STATES.CONNECTING
                  ? 'Handshaking WebRTC audio/video tracks...'
                  : `${otherParticipantTitle} will automatically appear in this window once connected.`}
              </p>
            </div>
          </div>
        )}

        {/* Local Video Stream Picture-in-Picture Card (Bottom Right) */}
        <div className="absolute bottom-6 right-6 w-44 sm:w-56 aspect-video bg-slate-900 rounded-xl border-2 border-slate-700/80 overflow-hidden shadow-2xl z-20 group">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${!isVideoEnabled || !localStream ? 'hidden' : 'block'}`}
          />
          {(!isVideoEnabled || !localStream) && (
            <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-slate-400">
              <VideoOff className="w-8 h-8 mb-1 text-slate-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Camera Off</span>
            </div>
          )}

          {/* User Tag */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-slate-950/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-800 text-[10px] font-bold text-white">
            <span className="truncate">{user?.name || 'You'}</span>
            <div className="flex items-center gap-1">
              {isMicMuted && <MicOff className="w-3 h-3 text-rose-400" />}
              {!isVideoEnabled && <VideoOff className="w-3 h-3 text-rose-400" />}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROLS BAR (Mic Mute, Camera Toggle, Fullscreen, End Consultation) */}
      <footer className="h-20 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 px-6 flex items-center justify-center gap-4 shrink-0 z-30">
        {/* Toggle Audio */}
        <button
          onClick={toggleAudio}
          type="button"
          className={`p-3.5 rounded-xl font-bold transition-all cursor-pointer ${
            isMicMuted
              ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-900/40'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
          }`}
          title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Video */}
        <button
          onClick={toggleVideo}
          type="button"
          className={`p-3.5 rounded-xl font-bold transition-all cursor-pointer ${
            !isVideoEnabled
              ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-900/40'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
          }`}
          title={!isVideoEnabled ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {!isVideoEnabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          type="button"
          className="p-3.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 font-bold transition-all cursor-pointer"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>

        {/* End Call Button */}
        <button
          onClick={handleLeave}
          type="button"
          className="px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
        >
          <PhoneOff className="w-5 h-5" />
          <span>End Consultation</span>
        </button>
      </footer>
    </div>
  );
};

export default MeetingRoom;
