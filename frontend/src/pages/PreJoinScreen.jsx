import React, { useEffect, useRef, useState } from 'react';
import styles from '../styles/preJoin.module.css';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SettingsIcon from '@mui/icons-material/Settings';

/**
 * PreJoinScreen
 * Props:
 *   onJoin(username, videoOn, audioOn) — called when user clicks "Join Now"
 *   roomCode — displayed on the page
 */
export default function PreJoinScreen({ onJoin, roomCode }) {
  const videoPreviewRef = useRef(null);
  const streamRef = useRef(null);

  const [username, setUsername] = useState('');
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [videoAvailable, setVideoAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0); // 0–100 mic meter
  const [devices, setDevices] = useState({ video: [], audio: [] });
  const [showSettings, setShowSettings] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [selectedAudio, setSelectedAudio] = useState('');

  // ── Get permissions & start preview ────────────────────────
  useEffect(() => {
    startPreview();
    return () => stopStream();
  }, []); // eslint-disable-line

  // ── Restart preview when device selection changes ───────────
  useEffect(() => {
    if (!loading) restartPreview();
  }, [selectedVideo, selectedAudio]); // eslint-disable-line

  // ── Toggle video track on/off without restarting stream ────
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(t => (t.enabled = videoOn));
    }
  }, [videoOn]);

  // ── Toggle audio track on/off without restarting stream ────
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => (t.enabled = audioOn));
    }
  }, [audioOn]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startPreview = async () => {
    setLoading(true);
    try {
      // Enumerate devices
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = allDevices.filter(d => d.kind === 'videoinput');
      const audioDevs = allDevices.filter(d => d.kind === 'audioinput');
      setDevices({ video: videoDevs, audio: audioDevs });
      if (videoDevs.length) setSelectedVideo(v => v || videoDevs[0].deviceId);
      if (audioDevs.length) setSelectedAudio(a => a || audioDevs[0].deviceId);

      const vid = videoDevs.length > 0;
      const aud = audioDevs.length > 0;
      setVideoAvailable(vid);
      setAudioAvailable(aud);

      const constraints = {
        video: vid ? (selectedVideo ? { deviceId: { exact: selectedVideo } } : true) : false,
        audio: aud ? (selectedAudio ? { deviceId: { exact: selectedAudio } } : true) : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Apply current toggle states immediately
      stream.getVideoTracks().forEach(t => (t.enabled = videoOn));
      stream.getAudioTracks().forEach(t => (t.enabled = audioOn));

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      // ── Mic level meter ──────────────────────────────────────
      if (aud) {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setAudioLevel(Math.min(100, Math.round(avg * 2.5)));
          requestAnimationFrame(tick);
        };
        tick();
      }
    } catch (err) {
      console.error('Preview error:', err);
      setVideoAvailable(false);
      setAudioAvailable(false);
    }
    setLoading(false);
  };

  const restartPreview = async () => {
    stopStream();
    await startPreview();
  };

  const handleJoin = () => {
    if (!username.trim()) return;
    // Stop preview stream — VideoMeetComponent will open its own
    stopStream();
    onJoin(username.trim(), videoOn, audioOn);
  };

  return (
    <div className={styles.root}>
      {/* Background orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.logo}>⬡</span>
          <div>
            <h1 className={styles.title}>Ready to join?</h1>
            {roomCode && (
              <p className={styles.roomCode}>Room: <span>{roomCode}</span></p>
            )}
          </div>
          <button
            className={styles.settingsBtn}
            onClick={() => setShowSettings(s => !s)}
            title="Device settings"
          >
            <SettingsIcon style={{ fontSize: 20 }} />
          </button>
        </div>

        {/* ── Device settings dropdown ── */}
        {showSettings && (
          <div className={styles.settingsPanel}>
            <div className={styles.settingRow}>
              <label className={styles.settingLabel}>📹 Camera</label>
              <select
                className={styles.settingSelect}
                value={selectedVideo}
                onChange={e => setSelectedVideo(e.target.value)}
              >
                {devices.video.length === 0
                  ? <option>No cameras found</option>
                  : devices.video.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
              </select>
            </div>
            <div className={styles.settingRow}>
              <label className={styles.settingLabel}>🎤 Microphone</label>
              <select
                className={styles.settingSelect}
                value={selectedAudio}
                onChange={e => setSelectedAudio(e.target.value)}
              >
                {devices.audio.length === 0
                  ? <option>No microphones found</option>
                  : devices.audio.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Mic ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        <div className={styles.body}>
          {/* ── Video preview ── */}
          <div className={styles.previewWrap}>
            {loading && (
              <div className={styles.previewLoader}>
                <div className={styles.spinner} />
                <p>Accessing camera…</p>
              </div>
            )}

            {!loading && !videoAvailable && (
              <div className={styles.noCamera}>
                <VideocamOffIcon style={{ fontSize: 48, color: '#334455' }} />
                <p>No camera found</p>
              </div>
            )}

            {/* Actual preview — always rendered, hidden while loading */}
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              className={`${styles.preview} ${(!videoOn || !videoAvailable) ? styles.previewHidden : ''}`}
            />

            {/* Camera off overlay */}
            {!loading && videoAvailable && !videoOn && (
              <div className={styles.camOffOverlay}>
                <div className={styles.camOffAvatar}>
                  {username ? username[0].toUpperCase() : '?'}
                </div>
                <p className={styles.camOffText}>Camera is off</p>
              </div>
            )}

            {/* ── Toggle buttons on top of preview ── */}
            {!loading && (
              <div className={styles.previewControls}>
                <button
                  className={`${styles.toggleBtn} ${!videoOn ? styles.toggleBtnOff : ''}`}
                  onClick={() => setVideoOn(v => !v)}
                  disabled={!videoAvailable}
                  title={videoOn ? 'Turn off camera' : 'Turn on camera'}
                >
                  {videoOn
                    ? <VideocamIcon style={{ fontSize: 20 }} />
                    : <VideocamOffIcon style={{ fontSize: 20 }} />}
                </button>

                <button
                  className={`${styles.toggleBtn} ${!audioOn ? styles.toggleBtnOff : ''}`}
                  onClick={() => setAudioOn(a => !a)}
                  disabled={!audioAvailable}
                  title={audioOn ? 'Mute' : 'Unmute'}
                >
                  {audioOn
                    ? <MicIcon style={{ fontSize: 20 }} />
                    : <MicOffIcon style={{ fontSize: 20 }} />}
                </button>
              </div>
            )}

            {/* Status badges */}
            {!loading && (
              <div className={styles.statusBadges}>
                <span className={`${styles.badge} ${videoOn && videoAvailable ? styles.badgeOn : styles.badgeOff}`}>
                  {videoOn && videoAvailable ? '● Camera on' : '● Camera off'}
                </span>
                <span className={`${styles.badge} ${audioOn && audioAvailable ? styles.badgeOn : styles.badgeOff}`}>
                  {audioOn && audioAvailable ? '● Mic on' : '● Mic off'}
                </span>
              </div>
            )}
          </div>

          {/* ── Right panel ── */}
          <div className={styles.rightPanel}>

            {/* Mic level meter */}
            {audioAvailable && audioOn && (
              <div className={styles.micMeter}>
                <span className={styles.micMeterLabel}>🎤 Mic level</span>
                <div className={styles.micMeterTrack}>
                  <div
                    className={styles.micMeterFill}
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>
            )}

            {/* Username input */}
            <div className={styles.field}>
              <label className={styles.label}>Your display name</label>
              <input
                className={styles.input}
                placeholder="Enter your name…"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                autoFocus
              />
            </div>

            {/* Device status summary */}
            <div className={styles.deviceSummary}>
              <div className={`${styles.deviceRow} ${videoAvailable ? '' : styles.deviceUnavailable}`}>
                {videoOn && videoAvailable
                  ? <VideocamIcon style={{ fontSize: 16, color: '#00c474' }} />
                  : <VideocamOffIcon style={{ fontSize: 16, color: videoAvailable ? '#ff5252' : '#334455' }} />}
                <span>{!videoAvailable ? 'Camera unavailable' : videoOn ? 'Camera ready' : 'Camera off — click to enable'}</span>
              </div>
              <div className={`${styles.deviceRow} ${audioAvailable ? '' : styles.deviceUnavailable}`}>
                {audioOn && audioAvailable
                  ? <MicIcon style={{ fontSize: 16, color: '#00c474' }} />
                  : <MicOffIcon style={{ fontSize: 16, color: audioAvailable ? '#ff5252' : '#334455' }} />}
                <span>{!audioAvailable ? 'Microphone unavailable' : audioOn ? 'Microphone ready' : 'Mic off — click to enable'}</span>
              </div>
            </div>

            {/* Join button */}
            <button
              className={styles.joinBtn}
              onClick={handleJoin}
              disabled={!username.trim() || loading}
            >
              {loading ? <span className={styles.joinSpinner} /> : 'Join Now →'}
            </button>

            <p className={styles.hint}>
              You can change camera and mic settings during the call too.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
