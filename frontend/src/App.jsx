import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  BookOpen,
  Users,
  GraduationCap,
  CalendarCheck,
  ClipboardList,
  FileText,
  Megaphone,
  BarChart3,
  Building2,
  LogOut,
  LayoutDashboard,
  Menu,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

import ModulePage from './ModulePage';
import './App.css';

const API =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ======================================
// ROLE-BASED MENUS
// ======================================

const menus = {
  ADMIN: [
    ['Dashboard', LayoutDashboard],
    ['Students', GraduationCap],
    ['Staff', Users],
    ['Departments', Building2],
    ['Subjects', BookOpen],
    ['Enrollments', Users],
    ['Attendance', CalendarCheck],
    ['Examinations', ClipboardList],
    ['Marks', BarChart3],
    ['Assignments', FileText],
    ['Submissions', ClipboardList],
    ['Study Materials', BookOpen],
    ['Announcements', Megaphone],
    ['Reports', BarChart3]
  ],

  STAFF: [
    ['Dashboard', LayoutDashboard],
    ['Attendance', CalendarCheck],
    ['Examinations', ClipboardList],
    ['Marks', BarChart3],
    ['Assignments', FileText],
    ['Submissions', ClipboardList],
    ['Study Materials', BookOpen],
    ['Announcements', Megaphone],
    ['Reports', BarChart3]
  ],

  STUDENT: [
    ['Dashboard', LayoutDashboard],
    ['My Attendance', CalendarCheck],
    ['My Marks', BarChart3],
    ['Assignments', FileText],
    ['My Submissions', ClipboardList],
    ['Study Materials', BookOpen],
    ['Announcements', Megaphone],
    ['Reports', BarChart3]
  ]
};

// ======================================
// DASHBOARD STATISTICS
// ======================================

const statsByRole = {
  ADMIN: [
    ['Total Students', 'totalStudents', GraduationCap],
    ['Staff Members', 'totalStaff', Users],
    ['Departments', 'totalDepartments', Building2],
    ['Subjects', 'totalSubjects', BookOpen],
    ['Assignments', 'totalAssignments', FileText],
    ['Attendance Records', 'totalAttendanceRecords', CalendarCheck]
  ],

  STAFF: [
    ['Assigned Subjects', 'assignedSubjects', BookOpen],
    ['Created Assignments', 'createdAssignments', FileText],
    ['Attendance Records', 'attendanceRecords', CalendarCheck],
    ['Study Materials', 'uploadedMaterials', GraduationCap]
  ],

  STUDENT: [
    ['Attendance Records', 'attendanceRecords', CalendarCheck],
    ['Present Records', 'presentRecords', CalendarCheck],
    ['Assignments', 'totalAssignments', FileText],
    ['Submissions', 'submittedAssignments', ClipboardList],
    ['Academic Score', 'academicPercentage', BarChart3]
  ]
};

// ======================================
// MAIN APPLICATION
// ======================================

export default function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem('token')
  );

  const [role, setRole] = useState(
    () => sessionStorage.getItem('role')
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [activePage, setActivePage] = useState('Dashboard');
  const [dashboard, setDashboard] = useState({});
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ======================================
  // THEME SETTINGS
  // ======================================

  const [theme, setTheme] = useState(
    () => localStorage.getItem('uit-theme') || 'system'
  );

  useEffect(() => {
    const media = window.matchMedia(
      '(prefers-color-scheme: dark)'
    );

    const applyTheme = () => {
      const selectedTheme =
        theme === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : theme;

      document.documentElement.setAttribute(
        'data-theme',
        selectedTheme
      );
    };

    applyTheme();

    localStorage.setItem('uit-theme', theme);

    media.addEventListener('change', applyTheme);

    return () => {
      media.removeEventListener('change', applyTheme);
    };
  }, [theme]);

  // ======================================
  // AXIOS API INSTANCE
  // ======================================

  const api = useMemo(
    () =>
      axios.create({
        baseURL: API,
        headers: token
          ? {
              Authorization: `Bearer ${token}`
            }
          : {}
      }),
    [token]
  );

  // ======================================
  // LOGIN
  // ======================================

  async function login(e) {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        `${API}/auth/login`,
        {
          email: email.trim(),
          password
        }
      );

      const newToken = response.data.token;

      if (!newToken) {
        throw new Error('Authentication token missing.');
      }

      const encoded = newToken
        .split('.')[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const payload = JSON.parse(
        atob(
          encoded +
            '='.repeat((4 - (encoded.length % 4)) % 4)
        )
      );

      const userRole = payload.role?.toUpperCase();

      if (!['ADMIN', 'STAFF', 'STUDENT'].includes(userRole)) {
        throw new Error('This account role is not supported.');
      }

      sessionStorage.setItem('token', newToken);
      sessionStorage.setItem('role', userRole);

      setToken(newToken);
      setRole(userRole);
      setActivePage('Dashboard');
      setPassword('');
      setError('');

    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Unable to sign in. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  // ======================================
  // LOGOUT
  // ======================================

  const logout = useCallback(() => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');

    setToken(null);
    setRole(null);
    setDashboard({});
    setProfile(null);
    setEmail('');
    setPassword('');
    setActivePage('Dashboard');
    setSidebarOpen(false);
    setError('');
  }, []);

  // ======================================
  // LOAD DASHBOARD AND PROFILE
  // ======================================

  const loadDashboard = useCallback(async () => {
    try {
      const [report, user] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/auth/me')
      ]);

      setDashboard(report.data?.data || {});

      setProfile(
        user.data?.user ||
          user.data?.data ||
          user.data ||
          null
      );

      setError('');

    } catch (err) {
      if (err.response?.status === 401) {
        logout();
      } else {
        setError(
          err.response?.data?.message ||
            'Dashboard information could not be loaded.'
        );
      }
    }
  }, [api, logout]);

  useEffect(() => {
    if (token && role) {
      loadDashboard();
    }
  }, [token, role, loadDashboard]);

  // ======================================
  // LOGIN PAGE
  // ======================================

  if (!token || !role) {
    return (
      <div className="login-page">

        <section className="login-brand-panel">

          <div className="uit-brand">
            <span className="uit-mark">U</span>

            <span>
              UNITED INSTITUTE OF TECHNOLOGY
              <small>COLLEGE MANAGEMENT PORTAL</small>
            </span>
          </div>

          <div className="brand-message">

            <span className="eyebrow">
              SMART CAMPUS • CONNECTED LEARNING
            </span>

            <h1>
              One campus.
              <br />
              <em>One connected</em>
              <br />
              experience.
            </h1>

            <p>
              A unified workspace for academic operations,
              student services and campus communication.
            </p>

            <div className="brand-points">
              <span>✓ Student & staff services</span>
              <span>✓ Academic records & attendance</span>
              <span>✓ Assignments & learning resources</span>
            </div>

          </div>

          <small className="brand-footer">
            COMPUTER SCIENCE & ENGINEERING • CSE
          </small>

        </section>

        <section className="login-form-panel">

          <div className="login-theme-control">

            {theme === 'light' ? (
              <Sun size={17} />
            ) : theme === 'dark' ? (
              <Moon size={17} />
            ) : (
              <Monitor size={17} />
            )}

            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="theme-select"
              aria-label="Choose theme"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>

          </div>

          <form className="login-card" onSubmit={login}>

            <div className="login-emblem">
              <GraduationCap size={28} />
            </div>

            <span className="eyebrow">WELCOME BACK</span>

            <h2>Sign in to UIT</h2>

            <p className="muted">
              Use your institutional account to continue.
            </p>

            <label htmlFor="login-email">
              Email address
            </label>

            <input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="name@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="login-password">
              Password
            </label>

            <div className="password-field">

              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                aria-label={
                  showPassword ? 'Hide password' : 'Show password'
                }
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>

            </div>

            {error && (
              <div className="alert error-alert" role="alert">
                {error}
              </div>
            )}

            <button
              className="sign-in-button"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in securely'}
              <span>→</span>
            </button>

            <p className="login-note">
              Secure role-based access for administrators,
              staff and students.
            </p>

          </form>

          <footer>
            © {new Date().getFullYear()} United Institute of Technology
          </footer>

        </section>

      </div>
    );
  }

  // ======================================
  // AUTHENTICATED APPLICATION
  // ======================================

  const menu = menus[role] || menus.STUDENT;
  const stats = statsByRole[role] || [];

  return (
    <div className="app-layout">

      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`sidebar ${
          sidebarOpen ? 'sidebar-open' : ''
        }`}
      >

        <div className="sidebar-brand">

          <span className="uit-mark">U</span>

          <span>
            UIT
            <small>COLLEGE PORTAL</small>
          </span>

          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </button>

        </div>

        <div className="department-chip">
          COMPUTER SCIENCE & ENGINEERING
        </div>

        <p className="menu-heading">WORKSPACE</p>

        <nav>
          {menu.map(([name, Icon]) => (
            <button
              key={name}
              className={`nav-item ${
                activePage === name ? 'active' : ''
              }`}
              onClick={() => {
                setActivePage(name);
                setSidebarOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">

          <div className="sidebar-user">

            <div className="avatar">
              {(profile?.name || role)[0]?.toUpperCase()}
            </div>

            <div>
              <strong>{profile?.name || role}</strong>
              <small>{role}</small>
            </div>

          </div>

          <button
            className="logout-button"
            onClick={logout}
          >
            <LogOut size={17} />
            Sign out
          </button>

        </div>

      </aside>

      {/* MAIN CONTENT */}

      <main className="main-content">

        {/* TOPBAR */}

        <header className="topbar">

          <div className="topbar-title">

            <button
              className="mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu />
            </button>

            <div>
              <span className="breadcrumb">
                UIT / CSE / {activePage}
              </span>

              <h2>{activePage}</h2>
            </div>

          </div>

          <div className="topbar-right">

            <div className="theme-control">

              {theme === 'light' ? (
                <Sun size={17} />
              ) : theme === 'dark' ? (
                <Moon size={17} />
              ) : (
                <Monitor size={17} />
              )}

              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="theme-select"
                aria-label="Choose theme"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>

            </div>

            <span className="role-pill">{role}</span>

            <div className="topbar-avatar">
              {(profile?.name || role)[0]?.toUpperCase()}
            </div>

          </div>

        </header>

        {/* ERROR MESSAGE */}

        {error && (
          <div
            className="alert error-alert page-alert"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* DASHBOARD OR MODULE */}

        {activePage === 'Dashboard' ? (

          <div className="dashboard-page">

            <section className="welcome-banner">

              <div>

                <span className="eyebrow">
                  UNITED INSTITUTE OF TECHNOLOGY
                </span>

                <h1>
                  Welcome,{' '}
                  {profile?.name?.split(' ')[0] ||
                    role.toLowerCase()}
                  .
                </h1>

                <p>
                  Your academic workspace at a glance.
                </p>

              </div>

              <div className="banner-art">
                <GraduationCap size={58} />
              </div>

            </section>

            {/* DASHBOARD SUMMARY */}

            <div className="section-heading">

              <div>
                <span className="eyebrow">OVERVIEW</span>
                <h3>Dashboard summary</h3>
              </div>

              <button
                className="refresh-button"
                onClick={loadDashboard}
              >
                <RefreshCw size={16} />
                Refresh
              </button>

            </div>

            <section className="stats-grid">

              {stats.map(([label, key, Icon]) => (
                <article
                  className="stat-card"
                  key={key}
                >

                  <div className="stat-top">

                    <span>{label}</span>

                    <span className="stat-icon">
                      <Icon size={19} />
                    </span>

                  </div>

                  <strong>
                    {dashboard[key] ?? '—'}
                    {key === 'academicPercentage' ? '%' : ''}
                  </strong>

                  {key === 'academicPercentage' && (
                    <small>
                      Overall academic percentage
                    </small>
                  )}

                </article>
              ))}

            </section>

            {/* QUICK ACCESS */}

            <section className="quick-panel">

              <div className="section-heading">

                <div>
                  <span className="eyebrow">GET THINGS DONE</span>
                  <h3>Quick access</h3>
                </div>

              </div>

              <div className="quick-grid">

                {menu
                  .filter(([name]) => name !== 'Dashboard')
                  .slice(0, 8)
                  .map(([name, Icon]) => (
                    <button
                      key={name}
                      onClick={() => setActivePage(name)}
                    >

                      <span className="quick-icon">
                        <Icon size={19} />
                      </span>

                      <span>{name}</span>

                      <b>→</b>

                    </button>
                  ))}

              </div>

            </section>

          </div>

        ) : (

          <ModulePage
            page={activePage}
            api={api}
            role={role}
            profile={profile}
          />

        )}

        {/* FOOTER */}

        <footer className="app-footer">
          UNITED INSTITUTE OF TECHNOLOGY
          <span>•</span>
          COMPUTER SCIENCE & ENGINEERING
        </footer>

      </main>

    </div>
  );
}