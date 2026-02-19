import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { Badge, IconButton, Tooltip, Snackbar, Alert } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PeopleIcon from '@mui/icons-material/People';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import HistoryIcon from '@mui/icons-material/History';
import styles from '../styles/videoComponent.module.css';
import { saveMeetingToHistory } from './history.jsx';
import PreJoinScreen from './PreJoinScreen';

const server_url = 'http://localhost:8000';
var connections = {};
const peerConfigConnections = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const silence = () => {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const dst = osc.connect(ctx.createMediaStreamDestination());
  osc.start(); ctx.resume();
  return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
};
const black = ({ width = 640, height = 480 } = {}) => {
  const c = Object.assign(document.createElement('canvas'), { width, height });
  c.getContext('2d').fillRect(0, 0, width, height);
  return Object.assign(c.captureStream().getVideoTracks()[0], { enabled: false });
};
const createBlackSilenceStream = () => new MediaStream([black(), silence()]);
const addTracksToConnection = (conn, stream) => stream.getTracks().forEach((t) => conn.addTrack(t, stream));
const replaceTracksOnConnection = (conn, stream) => {
  conn.getSenders().forEach((s) => conn.removeTrack(s));
  stream.getTracks().forEach((t) => conn.addTrack(t, stream));
};
const REACTIONS = ['👍', '❤️', '😂', '🎉', '👏', '🔥'];
const fmtTimer = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

// ✅ Grid layout — controls BOTH columns and rows via inline style object
function getGridCols(remoteCount) {
  const total = remoteCount + 1; // +1 for local video
  if (total === 1) return '1fr';
  if (total === 2) return '1fr 1fr';
  if (total === 3) return 'repeat(3, 1fr)'; // all 3 side by side in one row
  if (total === 4) return 'repeat(2, 1fr)'; // 2x2 grid
  if (total <= 6) return 'repeat(3, 1fr)'; // 2 rows of 3
  if (total <= 9) return 'repeat(3, 1fr)'; // 3 rows of 3
  return 'repeat(4, 1fr)';
}

// Controls number of rows for proper height distribution
function getGridRows(remoteCount) {
  const total = remoteCount + 1;
  if (total <= 2) return '1fr';
  if (total === 3) return '1fr';        // 1 row, 3 columns
  if (total <= 6) return '1fr 1fr';   // 2 rows
  if (total <= 9) return 'repeat(3, 1fr)'; // 3 rows
  return 'repeat(4, 1fr)';
}

export default function VideoMeetComponent() {
  const navigate = useNavigate();
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoref = useRef();
  const videoRef = useRef([]);
  const messagesEndRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const seenStreams = useRef(new Set()); // ← tracks stream IDs synchronously

  const [videoAvailable, setVideoAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [video, setVideo] = useState(false);
  const [audio, setAudio] = useState(false);
  const [screen, setScreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState('');
  const [videos, setVideos] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [copySnackbar, setCopySnackbar] = useState(false);
  const [reaction, setReaction] = useState('');
  const [showReactions, setShowReactions] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [permissionError, setPermissionError] = useState('');

  useEffect(() => {
    getPermissions();
    return () => {
      clearInterval(timerRef.current);
      socketRef.current?.disconnect();
      window.localStream?.getTracks().forEach((t) => t.stop());
      Object.values(connections).forEach((c) => c.close());
      connections = {};
    };
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (!askForUsername) getUserMedia(); }, [video, audio]); // eslint-disable-line
  useEffect(() => {
    if (screen === true) getDisplayMedia();
    else if (screen === false && socketRef.current) getUserMedia();
  }, [screen]); // eslint-disable-line

  const getPermissions = async () => {
    try {
      const vid = await navigator.mediaDevices.getUserMedia({ video: true }).then(() => true).catch(() => false);
      const aud = await navigator.mediaDevices.getUserMedia({ audio: true }).then(() => true).catch(() => false);
      setVideoAvailable(vid); setAudioAvailable(aud);
      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
      if (vid || aud) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: vid, audio: aud });
        window.localStream = stream;
        if (localVideoref.current) localVideoref.current.srcObject = stream;
      }
    } catch (err) { setPermissionError('Could not access camera/microphone. Check browser permissions.'); }
  };

  const getUserMediaSuccess = useCallback((stream) => {
    try { window.localStream?.getTracks().forEach((t) => t.stop()); } catch (_) { }
    window.localStream = stream;
    if (localVideoref.current) localVideoref.current.srcObject = stream;
    Object.entries(connections).forEach(([id, conn]) => {
      if (id === socketIdRef.current) return;
      replaceTracksOnConnection(conn, window.localStream);
      conn.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
        .then((d) => conn.setLocalDescription(d))
        .then(() => socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription })))
        .catch(console.error);
    });
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideo(false); setAudio(false);
        const silent = createBlackSilenceStream();
        window.localStream = silent;
        if (localVideoref.current) localVideoref.current.srcObject = silent;
        Object.entries(connections).forEach(([id, conn]) => {
          if (id === socketIdRef.current) return;
          replaceTracksOnConnection(conn, window.localStream);
          conn.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
            .then((d) => conn.setLocalDescription(d))
            .then(() => socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription })))
            .catch(console.error);
        });
      };
    });
  }, []);

  const getUserMedia = useCallback(() => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices.getUserMedia({ video, audio }).then(getUserMediaSuccess).catch(console.error);
    } else {
      try { localVideoref.current?.srcObject?.getTracks().forEach((t) => t.stop()); } catch (_) { }
    }
  }, [video, audio, videoAvailable, audioAvailable, getUserMediaSuccess]);

  const getDisplayMedia = () => {
    if (!navigator.mediaDevices.getDisplayMedia) return;
    navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      .then((stream) => {
        try { window.localStream?.getTracks().forEach((t) => t.stop()); } catch (_) { }
        window.localStream = stream;
        if (localVideoref.current) localVideoref.current.srcObject = stream;
        Object.entries(connections).forEach(([id, conn]) => {
          if (id === socketIdRef.current) return;
          replaceTracksOnConnection(conn, window.localStream);
          conn.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
            .then((d) => conn.setLocalDescription(d))
            .then(() => socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription })))
            .catch(console.error);
        });
        stream.getTracks().forEach((t) => { t.onended = () => setScreen(false); });
      })
      .catch((e) => { console.error(e); setScreen(false); });
  };

  const gotMessageFromServer = useCallback((fromId, msg) => {
    const signal = JSON.parse(msg);
    if (fromId === socketIdRef.current) return;
    if (signal.sdp) {
      connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(() => {
          if (signal.sdp.type === 'offer') {
            return connections[fromId].createAnswer()
              .then((d) => connections[fromId].setLocalDescription(d))
              .then(() => socketRef.current.emit('signal', fromId, JSON.stringify({ sdp: connections[fromId].localDescription })));
          }
        }).catch(console.error);
    }
    if (signal.ice) connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(console.error);
  }, []);

  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });
    setConnectionStatus('connecting');
    socketRef.current.on('signal', gotMessageFromServer);
    socketRef.current.on('connect', () => {
      setConnectionStatus('connected');
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      socketRef.current.emit('join-call', window.location.href);
      socketIdRef.current = socketRef.current.id;
      socketRef.current.on('chat-message', addMessage);
      socketRef.current.on('user-left', (id) => {
        // Remove from seenStreams so rejoin works correctly
        const leaving = videoRef.current.find((v) => v.socketId === id);
        if (leaving?.streamId) seenStreams.current.delete(leaving.streamId);

        setVideos((prev) => prev.filter((v) => v.socketId !== id));
        videoRef.current = videoRef.current.filter((v) => v.socketId !== id);
        if (connections[id]) { connections[id].close(); delete connections[id]; }
      });
      socketRef.current.on('user-joined', (id, clients) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(peerConfigConnections);
          connections[socketListId].onicecandidate = (e) => {
            if (e.candidate) socketRef.current.emit('signal', socketListId, JSON.stringify({ ice: e.candidate }));
          };
          // ✅ ontrack fires once per TRACK (video + audio = fires twice)
          // FIX: use a synchronous Set ref — state updates are async and too slow
          connections[socketListId].ontrack = (event) => {
            const stream = event.streams[0];
            if (!stream) return;

            // If we already processed this exact stream, skip — prevents duplicate tiles
            if (seenStreams.current.has(stream.id)) return;
            seenStreams.current.add(stream.id);

            setVideos((prev) => {
              // Extra guard: also skip if socketId already in list
              if (prev.find((v) => v.socketId === socketListId)) return prev;

              const u = [...prev, {
                socketId: socketListId,
                streamId: stream.id,
                stream,
                autoplay: true,
                playsinline: true,
              }];
              videoRef.current = u;
              return u;
            });
          };
          connections[socketListId].onconnectionstatechange = () =>
            console.log(`[WebRTC] ${socketListId}: ${connections[socketListId]?.connectionState}`);
          // ✅ addTrack replaces deprecated addStream
          const streamToAdd = window.localStream ?? createBlackSilenceStream();
          if (!window.localStream) window.localStream = streamToAdd;
          addTracksToConnection(connections[socketListId], window.localStream);
        });
        if (id === socketIdRef.current) {
          Object.entries(connections).forEach(([id2, conn]) => {
            if (id2 === socketIdRef.current) return;
            try { replaceTracksOnConnection(conn, window.localStream); } catch (_) { }
            conn.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
              .then((d) => conn.setLocalDescription(d))
              .then(() => socketRef.current.emit('signal', id2, JSON.stringify({ sdp: connections[id2].localDescription })))
              .catch(console.error);
          });
        }
      });
      socketRef.current.on('disconnect', () => setConnectionStatus('disconnected'));
    });
    socketRef.current.on('connect_error', () => setConnectionStatus('error'));
  };

  const addMessage = useCallback((data, sender, socketIdSender) => {
    setMessages((prev) => [...prev, { sender, data, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    if (socketIdSender !== socketIdRef.current) setNewMessages((p) => p + 1);
  }, []);

  const sendMessage = () => {
    if (!message.trim() || !socketRef.current) return;
    socketRef.current.emit('chat-message', message, username);
    setMessage('');
  };

  const handleVideo = () => setVideo((v) => !v);
  const handleAudio = () => setAudio((a) => !a);
  const handleScreen = () => setScreen((s) => !s);

  // ── End call: save to history then redirect ──────────────────
  const handleEndCall = () => {
    clearInterval(timerRef.current);
    saveMeetingToHistory({
      roomUrl: window.location.href,
      username,
      duration: startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0,
      participants: videos.length + 1,
    });
    try { localVideoref.current?.srcObject?.getTracks().forEach((t) => t.stop()); } catch (_) { }
    window.localStream?.getTracks().forEach((t) => t.stop());
    Object.values(connections).forEach((c) => c.close());
    connections = {};
    socketRef.current?.disconnect();
    navigate('/history');
  };

  const copyMeetingLink = () => { navigator.clipboard.writeText(window.location.href); setCopySnackbar(true); };
  const sendReaction = (emoji) => { setReaction(emoji); setShowReactions(false); setTimeout(() => setReaction(''), 3000); socketRef.current?.emit('reaction', emoji, username); };
  const openChat = () => { setShowChat(true); setNewMessages(0); };
  // Called by PreJoinScreen when user clicks "Join Now"
  const connect = (name, camOn, micOn) => {
    setUsername(name);
    setVideo(camOn);
    setAudio(micOn);
    setAskForUsername(false);
    connectToSocketServer();
  };

  const totalParticipants = videos.length + 1;
  const connDotClass = connectionStatus === 'connected' ? styles.connDotConnected : connectionStatus === 'connecting' ? styles.connDotConnecting : styles.connDotError;

  /* ════ PRE-JOIN SCREEN ════ */
  if (askForUsername) {
    return (
      <PreJoinScreen
        onJoin={connect}
        roomCode={window.location.pathname.replace('/', '')}
      />
    );
  }

  /* ════ MEET ROOM ════ */
  return (
    <div className={styles.meetRoot}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.logo}>⬡</span>
          <span className={styles.brandName}>NexMeet</span>
          <span className={`${styles.connDot} ${connDotClass}`} title={connectionStatus} />
        </div>
        <div className={styles.topCenter}>
          <span className={styles.liveTimer}><span className={styles.liveTimerDot} />{fmtTimer(callDuration)}</span>
          <span className={styles.urlText}>{window.location.href.length > 45 ? window.location.href.slice(0, 45) + '…' : window.location.href}</span>
          <Tooltip title="Copy invite link"><IconButton size="small" onClick={copyMeetingLink} style={{ color: '#8899aa' }}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
        </div>
        <div className={styles.topRight}>
          <Tooltip title="Meeting history"><IconButton size="small" onClick={() => navigate('/history')} style={{ color: '#8899aa' }}><HistoryIcon fontSize="small" /></IconButton></Tooltip>
          <PeopleIcon style={{ color: '#8899aa', fontSize: 18 }} />
          <span className={styles.participantCount}>{totalParticipants}</span>
        </div>
      </div>

      {/* Main area */}
      <div className={styles.mainArea}>
        <div
          className={styles.videoGrid}
          style={{
            gridTemplateColumns: getGridCols(videos.length),
            gridTemplateRows: getGridRows(videos.length),
          }}
        >
          {/* Local */}
          <div className={styles.videoCard}>
            <video ref={localVideoref} autoPlay muted playsInline className={styles.videoEl} />
            <div className={styles.videoLabel}>
              <span className={styles.labelName}>{username || 'You'} (You)</span>
              <div className={styles.labelIcons}>
                {!audio && <MicOffIcon style={{ fontSize: 13, color: '#ff5252' }} />}
                {!video && <VideocamOffIcon style={{ fontSize: 13, color: '#ff5252' }} />}
              </div>
            </div>
            {reaction && <div className={styles.reactionFloat}>{reaction}</div>}
          </div>
          {/* Remote — ✅ playsInline + srcObject guard */}
          {videos.map((v) => (
            <div key={v.socketId} className={styles.videoCard}>
              <video data-socket={v.socketId}
                ref={(ref) => { if (ref && v.stream && ref.srcObject !== v.stream) ref.srcObject = v.stream; }}
                autoPlay playsInline className={styles.videoEl} />
              <div className={styles.videoLabel}><span className={styles.labelName}>Participant {v.socketId.slice(0, 6)}</span></div>
            </div>
          ))}
        </div>

        {/* Participants panel */}
        {showParticipants && (
          <div className={styles.sidePanel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Participants ({totalParticipants})</span>
              <IconButton size="small" onClick={() => setShowParticipants(false)} style={{ color: '#8899aa' }}><CloseIcon fontSize="small" /></IconButton>
            </div>
            <div className={styles.participantList}>
              <div className={styles.partItem}><div className={styles.partAvatar}>{(username[0] || 'Y').toUpperCase()}</div><span className={styles.partName}>{username || 'You'} (You)</span></div>
              {videos.map((v) => (
                <div key={v.socketId} className={styles.partItem}>
                  <div className={styles.partAvatar}>{v.socketId[0].toUpperCase()}</div>
                  <span className={styles.partName}>Participant {v.socketId.slice(0, 6)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat panel */}
        {showChat && (
          <div className={styles.chatPanel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Chat</span>
              <IconButton size="small" onClick={() => setShowChat(false)} style={{ color: '#8899aa' }}><CloseIcon fontSize="small" /></IconButton>
            </div>
            <div className={styles.msgList}>
              {messages.length === 0 ? <p className={styles.noMsg}>No messages yet. Say hello! 👋</p> :
                messages.map((msg, i) => {
                  const isOwn = msg.sender === username;
                  return (
                    <div key={i} className={`${styles.messageBubbleRow} ${isOwn ? styles.messageBubbleRowOwn : styles.messageBubbleRowOther}`}>
                      <div className={`${styles.bubble} ${isOwn ? styles.bubbleOwn : styles.bubbleOther}`}>
                        {!isOwn && <p className={styles.bubbleSender}>{msg.sender}</p>}
                        <p className={styles.bubbleText}>{msg.data}</p>
                        <p className={styles.bubbleTime}>{msg.time}</p>
                      </div>
                    </div>
                  );
                })}
              <div ref={messagesEndRef} />
            </div>
            <div className={styles.chatInputRow}>
              <input className={styles.chatInput} placeholder="Type a message…" value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
              <IconButton onClick={sendMessage} disabled={!message.trim()} style={{ color: message.trim() ? '#1668dc' : '#445566' }}><SendIcon /></IconButton>
            </div>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className={styles.ctrlBar}>
        <div className={styles.ctrlGroup}>
          <Tooltip title={video ? 'Turn off camera' : 'Turn on camera'}>
            <IconButton onClick={handleVideo} className={`${styles.ctrlBtn} ${video ? styles.ctrlBtnOn : styles.ctrlBtnOff}`}>
              {video ? <VideocamIcon style={{ color: '#e0ecff' }} /> : <VideocamOffIcon style={{ color: '#ff5252' }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title={audio ? 'Mute' : 'Unmute'}>
            <IconButton onClick={handleAudio} className={`${styles.ctrlBtn} ${audio ? styles.ctrlBtnOn : styles.ctrlBtnOff}`}>
              {audio ? <MicIcon style={{ color: '#e0ecff' }} /> : <MicOffIcon style={{ color: '#ff5252' }} />}
            </IconButton>
          </Tooltip>
          {screenAvailable && (
            <Tooltip title={screen ? 'Stop sharing' : 'Share screen'}>
              <IconButton onClick={handleScreen} className={`${styles.ctrlBtn} ${screen ? styles.ctrlBtnActive : styles.ctrlBtnOn}`}>
                {screen ? <ScreenShareIcon style={{ color: '#4fc3f7' }} /> : <StopScreenShareIcon style={{ color: '#8899aa' }} />}
              </IconButton>
            </Tooltip>
          )}
          <div className={styles.reactionPickerWrap}>
            <Tooltip title="Reactions">
              <IconButton onClick={() => setShowReactions((r) => !r)} className={`${styles.ctrlBtn} ${styles.ctrlBtnOn}`}>
                <EmojiEmotionsIcon style={{ color: '#f9a825' }} />
              </IconButton>
            </Tooltip>
            {showReactions && (
              <div className={styles.reactionPicker}>
                {REACTIONS.map((emoji) => <button key={emoji} className={styles.reactionOpt} onClick={() => sendReaction(emoji)}>{emoji}</button>)}
              </div>
            )}
          </div>
        </div>

        <Tooltip title="End call">
          <IconButton onClick={handleEndCall} className={styles.endBtn}><CallEndIcon style={{ color: '#fff' }} /></IconButton>
        </Tooltip>

        <div className={styles.ctrlGroup}>
          <Tooltip title="Chat">
            <IconButton onClick={openChat} className={`${styles.ctrlBtn} ${showChat ? styles.ctrlBtnActive : styles.ctrlBtnOn}`}>
              <Badge badgeContent={newMessages} color="error" max={99}><ChatIcon style={{ color: showChat ? '#4fc3f7' : '#8899aa' }} /></Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title="Participants">
            <IconButton onClick={() => setShowParticipants((p) => !p)} className={`${styles.ctrlBtn} ${showParticipants ? styles.ctrlBtnActive : styles.ctrlBtnOn}`}>
              <Badge badgeContent={totalParticipants} color="primary" max={99}><PeopleIcon style={{ color: showParticipants ? '#4fc3f7' : '#8899aa' }} /></Badge>
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <Snackbar open={copySnackbar} autoHideDuration={2500} onClose={() => setCopySnackbar(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" sx={{ background: '#1e2a3a', color: '#fff', border: '1px solid #00c474' }}>Link copied!</Alert>
      </Snackbar>
    </div>
  );
}
