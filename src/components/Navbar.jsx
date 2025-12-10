import React, { useState, useEffect } from "react";
import "../styles/Navbar.css";
import { useAuthentication } from "../auth";
import { Link } from "react-router-dom";
import { getCurrentUser } from '../api'

const Navbar = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, logout } = useAuthentication();
  const handleLogout = () => {
    logout();
    setSidebarOpen(false); // Close menu after logout
  };

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let mounted = true
    const fetchMe = async () => {
      if (!isAuthenticated) return setIsAdmin(false)
      try {
        const me = await getCurrentUser()
        if (mounted) setIsAdmin(Boolean(me.is_staff || me.is_superuser))
      } catch (err) {
        if (mounted) setIsAdmin(false)
      }
    }
    fetchMe()
    return () => { mounted = false }
  }, [isAuthenticated])
  


  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to='/'  className="navbar-logo-text"><h2>SUGGESTION BOX</h2></Link>

        <div className="navbar-icon" onClick={toggleSidebar}>
          ☰
        </div>
        {isSidebarOpen && (
          <div className="sidebar">
            <button className="close-btn" onClick={toggleSidebar}>
              ✖
            </button>
            <ul className="sidebar-menu">
              {isAuthenticated ? (
                <>
                  <li>
                    <Link to="#" onClick={handleLogout} className="button-link">
                      Logout
                    </Link>
                  </li>
                  <li>
                    <Link to="/chats" className="button-link">
                      Chats
                    </Link>
                  </li>
                  <li>
                    <Link to="/feedback" className="button-link">
                      Feedback
                    </Link>
                  </li>
                  <li>
                    <Link to="/feedback/inbox" className="button-link">My Inbox</Link>
                  </li>
                  {isAdmin && (
                    <li>
                      <Link to="/admin/feedback" className="button-link">Admin Inbox</Link>
                    </li>
                  )}
                </>
              ) : (
                <>
                  <li>
                    <a href="/login">Login</a>
                  </li>
                  <li>
                    <a href="/register">Register</a>
                  </li>
                </>
              )}
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;