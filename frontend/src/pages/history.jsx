import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/history.module.css';
import VideocamIcon from '@mui/icons-material/Videocam';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import GroupIcon from '@mui/icons-material/Group';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { IconButton, Tooltip, Snackbar, Alert } from '@mui/material';

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const saveMeetingToHistory = ({ roomUrl, username, duration, participants }) => {
  try {
    const existing = JSON.parse(localStorage.getItem('nexmeet_history') || '[]');
    const newEntry = {
      id: Date.now().toString(),
      roomUrl,
      username,
      duration,           // seconds
      participants,       // number
      date: new Date().toISOString(),
    };
    const updated = [newEntry, ...existing].slice(0, 50); // keep last 50
    localStorage.setItem('nexmeet_history', JSON.stringify(updated));
  } catch (_) { }
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 1) return '< 1 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatDate = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const getInitials = (url = '') => {
  const parts = url.replace(/https?:\/\//, '').split('/').filter(Boolean);
  const code = parts[parts.length - 1] || 'RM';
  return code.slice(0, 2).toUpperCase();
};

const AVATAR_COLORS = [
  'linear-gradient(135deg,#1668dc,#0e4fa8)',
  'linear-gradient(135deg,#7c3aed,#5b21b6)',
  'linear-gradient(135deg,#0891b2,#0e7490)',
  'linear-gradient(135deg,#059669,#047857)',
  'linear-gradient(135deg,#d97706,#b45309)',
  'linear-gradient(135deg,#dc2626,#b91c1c)',
];

const avatarColor = (id) => AVATAR_COLORS[parseInt(id, 36) % AVATAR_COLORS.length];

// ─── Component ────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | today | week
  const [copied, setCopied] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    try {
      const data = JSON.parse(localStorage.getItem('nexmeet_history') || '[]');
      setHistory(data);
    } catch (_) {
      setHistory([]);
    }
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const confirmDelete = () => {
    const updated = history.filter((h) => h.id !== deleteId);
    setHistory(updated);
    localStorage.setItem('nexmeet_history', JSON.stringify(updated));
    setShowConfirm(false);
    setDeleteId(null);
  };

  const clearAll = () => {
    setHistory([]);
    localStorage.removeItem('nexmeet_history');
  };

  const copyLink = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
  };

  const rejoinMeeting = (url) => {
    window.location.href = url;
  };

  const newMeeting = () => {
    const id = Math.random().toString(36).slice(2, 8);
    navigate(`/room/${id}`);
  };

  // ─── Filter ────────────────────────────────────────────────
  const filtered = history.filter((item) => {
    const q = search.toLowerCase();
    const matchSearch = item.roomUrl?.toLowerCase().includes(q) || item.username?.toLowerCase().includes(q);

    const d = new Date(item.date);
    const now = new Date();
    const diff = now - d;

    const matchFilter =
      filter === 'all' ? true :
        filter === 'today' ? diff < 86400000 :
          filter === 'week' ? diff < 604800000 : true;

    return matchSearch && matchFilter;
  });

  // ─── Stats ─────────────────────────────────────────────────
  const totalMeetings = history.length;
  const totalDuration = history.reduce((a, h) => a + (h.duration || 0), 0);
  const avgParticipants = history.length
    ? Math.round(history.reduce((a, h) => a + (h.participants || 1), 0) / history.length)
    : 0;

  // ════════════════════════════════════════════════════════════
  return (
    <div className={styles.root}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <span className={styles.sideLogoMark}>⬡</span>
          <span className={styles.sideBrand}>NexMeet</span>
        </div>

        <nav className={styles.sideNav}>
          <button className={styles.navItem} onClick={() => navigate('/')}>
            <VideocamIcon fontSize="small" />
            <span>New Meeting</span>
          </button>
          <button className={`${styles.navItem} ${styles.navItemActive}`}>
            <HistoryIcon fontSize="small" />
            <span>History</span>
          </button>
        </nav>

        {/* Mini stats */}
        <div className={styles.sideStats}>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{totalMeetings}</span>
            <span className={styles.statLabel}>Meetings</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{formatDuration(totalDuration)}</span>
            <span className={styles.statLabel}>Total time</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{avgParticipants || '—'}</span>
            <span className={styles.statLabel}>Avg. people</span>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────── */}
      <main className={styles.main}>

        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Meeting History</h1>
            <p className={styles.pageSubtitle}>All your past meetings in one place</p>
          </div>
          <button className={styles.newMeetBtn} onClick={newMeeting}>
            <AddIcon fontSize="small" />
            New meeting
          </button>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <SearchIcon className={styles.searchIcon} fontSize="small" />
            <input
              className={styles.searchInput}
              placeholder="Search by room or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            {['all', 'today', 'week'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
              >
                {f === 'all' ? 'All time' : f === 'today' ? 'Today' : 'This week'}
              </button>
            ))}
          </div>

          {history.length > 0 && (
            <Tooltip title="Clear all history">
              <button className={styles.clearBtn} onClick={clearAll}>
                <DeleteOutlineIcon fontSize="small" /> Clear all
              </button>
            </Tooltip>
          )}
        </div>

        {/* ── Empty state ── */}
        {filtered.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⬡</div>
            <h2 className={styles.emptyTitle}>
              {history.length === 0 ? 'No meetings yet' : 'No results found'}
            </h2>
            <p className={styles.emptyText}>
              {history.length === 0
                ? 'Your completed meetings will appear here automatically.'
                : 'Try a different search term or filter.'}
            </p>
            {history.length === 0 && (
              <button className={styles.newMeetBtn} onClick={newMeeting}>
                <AddIcon fontSize="small" /> Start your first meeting
              </button>
            )}
          </div>
        )}

        {/* ── Meeting cards ── */}
        {filtered.length > 0 && (
          <div className={styles.cardGrid}>
            {filtered.map((item) => (
              <div key={item.id} className={styles.card}>

                {/* Card header */}
                <div className={styles.cardHeader}>
                  <div
                    className={styles.roomAvatar}
                    style={{ background: avatarColor(item.id) }}
                  >
                    {getInitials(item.roomUrl)}
                  </div>
                  <div className={styles.cardMeta}>
                    <p className={styles.cardRoomUrl} title={item.roomUrl}>
                      {item.roomUrl?.replace(/https?:\/\//, '').slice(0, 40) || 'Unknown room'}
                      {(item.roomUrl?.replace(/https?:\/\//, '').length || 0) > 40 ? '…' : ''}
                    </p>
                    <p className={styles.cardDate}>{formatDate(item.date)}</p>
                  </div>
                  <div className={styles.cardActions}>
                    <Tooltip title="Copy link">
                      <IconButton size="small" onClick={() => copyLink(item.roomUrl)} style={{ color: '#556677' }}>
                        <ContentCopyIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDelete(item.id)} style={{ color: '#556677' }}>
                        <DeleteOutlineIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>

                {/* Divider */}
                <div className={styles.cardDivider} />

                {/* Stats row */}
                <div className={styles.cardStats}>
                  <div className={styles.cardStat}>
                    <AccessTimeIcon style={{ fontSize: 14, color: '#4fc3f7' }} />
                    <span>{formatDuration(item.duration)}</span>
                  </div>
                  <div className={styles.cardStat}>
                    <GroupIcon style={{ fontSize: 14, color: '#a78bfa' }} />
                    <span>{item.participants || 1} participant{item.participants !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={styles.cardStat}>
                    <VideocamIcon style={{ fontSize: 14, color: '#00c474' }} />
                    <span>{item.username || 'Unknown'}</span>
                  </div>
                </div>

                {/* Rejoin button */}
                <button className={styles.rejoinBtn} onClick={() => rejoinMeeting(item.roomUrl)}>
                  Rejoin →
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Delete confirm modal ── */}
      {showConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Delete this meeting?</h3>
            <p className={styles.modalText}>This will remove it from your history permanently.</p>
            <div className={styles.modalBtns}>
              <button className={styles.modalCancel} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className={styles.modalDelete} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" sx={{ background: '#1e2a3a', color: '#fff', border: '1px solid #00c474' }}>
          Meeting link copied!
        </Alert>
      </Snackbar>
    </div>
  );
}
