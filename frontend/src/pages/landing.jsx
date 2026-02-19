import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/landing.module.css';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.root}>

      {/* ── Navbar ── */}
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <span className={styles.navLogo}>⬡</span>
          <span className={styles.navName}>NexMeet</span>
        </div>
        <div className={styles.navLinks}>
          <button className={styles.navBtn} onClick={() => navigate('/auth')}>Sign in</button>
          <button className={styles.navBtnPrimary} onClick={() => navigate('/auth')}>Get started</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>✦ Free &amp; open source</div>
          <h1 className={styles.heroTitle}>
            Video meetings,<br />
            <span className={styles.heroAccent}>beautifully simple.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Crystal-clear video calls, real-time chat, screen sharing and
            emoji reactions — all in your browser. No downloads, no fees.
          </p>
          <div className={styles.heroBtns}>
            <button className={styles.heroBtnPrimary} onClick={() => navigate('/auth')}>
              Start for free →
            </button>
            <button className={styles.heroBtnSecondary} onClick={() => navigate('/auth')}>
              Join a meeting
            </button>
          </div>
        </div>

        {/* Decorative glow orbs */}
        <div className={styles.orb1} />
        <div className={styles.orb2} />
      </section>

      {/* ── Features ── */}
      <section className={styles.features}>
        {FEATURES.map((f) => (
          <div key={f.title} className={styles.featureCard}>
            <span className={styles.featureIcon}>{f.icon}</span>
            <h3 className={styles.featureTitle}>{f.title}</h3>
            <p className={styles.featureText}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* ── CTA ── */}
      <section className={styles.cta}>
        <h2 className={styles.ctaTitle}>Ready to meet?</h2>
        <p className={styles.ctaText}>Create your free account and start a call in seconds.</p>
        <button className={styles.heroBtnPrimary} onClick={() => navigate('/auth')}>
          Create free account
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <span className={styles.navLogo}>⬡</span>
        <span style={{ color: '#445566', fontSize: 13 }}>© {new Date().getFullYear()} NexMeet. All rights reserved.</span>
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: '📹', title: 'HD Video', desc: 'Crystal-clear 1080p video with adaptive bitrate for any connection.' },
  { icon: '🔒', title: 'Secure by default', desc: 'End-to-end encrypted signalling and peer-to-peer WebRTC streams.' },
  { icon: '💬', title: 'In-call chat', desc: 'Real-time chat with timestamped message bubbles for every participant.' },
  { icon: '🖥️', title: 'Screen sharing', desc: 'Share your entire screen or a single window with one click.' },
  { icon: '😂', title: 'Reactions', desc: 'Send live emoji reactions that float over your video tile.' },
  { icon: '🕐', title: 'Meeting history', desc: 'Every call is logged with duration, participant count, and a rejoin link.' },
];
