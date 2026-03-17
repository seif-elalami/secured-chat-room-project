import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/Auth.css';

const AuthLayout = ({ children, title, subtitle, mode }) => {
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [cursorGlow, setCursorGlow] = useState({ x: '50%', y: '50%' });

  const shellStyle = useMemo(
    () => ({
      '--cursor-x': cursorGlow.x,
      '--cursor-y': cursorGlow.y,
    }),
    [cursorGlow]
  );

  const handlePointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = `${((event.clientX - bounds.left) / bounds.width) * 100}%`;
    const y = `${((event.clientY - bounds.top) / bounds.height) * 100}%`;

    setCursorGlow({ x, y });
  };

  return (
    <div
      className={`auth-shell ${isPoweredOn ? 'is-powered' : 'is-dormant'}`}
      style={shellStyle}
      onMouseMove={handlePointerMove}
    >
      <div className="auth-background-grid" />
      <div className="auth-orb auth-orb-left" />
      <div className="auth-orb auth-orb-right" />

      <div className="auth-stage">
        <section className="auth-hero">
          <p className="auth-eyebrow">Secured Chat Room</p>
          <h1 className="auth-hero-title">
            Private collaboration should feel alive, fast, and cinematic.
          </h1>
          <p className="auth-hero-copy">
            Step into a protected workspace built for teams, rooms, files, and
            focused communication. Power on the panel to enter the network.
          </p>

          <div className="auth-hero-metrics">
            <div className="hero-metric">
              <span className="hero-metric-value">Live</span>
              <span className="hero-metric-label">Room-based experience</span>
            </div>
            <div className="hero-metric">
              <span className="hero-metric-value">Secure</span>
              <span className="hero-metric-label">Token-backed auth flow</span>
            </div>
            <div className="hero-metric">
              <span className="hero-metric-value">Ready</span>
              <span className="hero-metric-label">Frontend and API ports mapped</span>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-panel-topbar">
            <div>
              <p className="auth-panel-label">Access Console</p>
              <h2 className="auth-panel-title">{title}</h2>
            </div>

            <button
              type="button"
              className={`lamp-switch ${isPoweredOn ? 'is-on' : 'is-off'}`}
              onClick={() => setIsPoweredOn((current) => !current)}
              aria-pressed={isPoweredOn}
              aria-label={isPoweredOn ? 'Turn form off' : 'Turn form on'}
            >
              <span className="lamp-switch-track" />
              <span className="lamp-switch-core" />
              <span className="lamp-switch-text">
                {isPoweredOn ? 'Lamp On' : 'Lamp Off'}
              </span>
            </button>
          </div>

          <div className="auth-route-tabs" role="tablist" aria-label="Authentication pages">
            <Link
              to="/login"
              className={`auth-route-tab ${mode === 'login' ? 'is-active' : ''}`}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className={`auth-route-tab ${mode === 'register' ? 'is-active' : ''}`}
            >
              Sign Up
            </Link>
          </div>

          <p className="auth-subtitle">{subtitle}</p>

          <div className={`auth-panel-content ${isPoweredOn ? 'is-visible' : 'is-hidden'}`}>
            {children}
          </div>

          {!isPoweredOn && (
            <div className="auth-dormant-state">
              <p className="auth-dormant-title">Console offline</p>
              <p className="auth-dormant-copy">
                Turn the lamp button back on to reveal the {mode === 'login' ? 'sign in' : 'sign up'} form.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AuthLayout;
