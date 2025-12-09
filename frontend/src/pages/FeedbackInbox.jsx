import React, { useEffect, useState } from 'react'
import { listFeedbacks, getCurrentUser } from '../api'
import '../styles/FeedbackInbox.css'

const FeedbackInbox = () => {
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [me, setMe] = useState(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        const data = await listFeedbacks()
        if (!mounted) return
        setFeedbacks(data)
        try {
          const user = await getCurrentUser()
          if (mounted) setMe(user)
        } catch (e) {}
      } catch (err) {
        setError(err?.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
    // setup notifications websocket for realtime admin responses
    let ws
    const token = localStorage.getItem('ACCESS_TOKEN')
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      let host = import.meta.env.VITE_API_WS_HOST
      if (!host) {
        const hostname = window.location.hostname || 'localhost'
        host = `${hostname}:8000`
      }
      const wsUrl = `${protocol}://${host}/ws/notifications/?token=${token}`
      ws = new WebSocket(wsUrl)
      ws.onopen = () => {
        // console.log('Notifications socket open')
      }
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'feedback_update' && data.feedback) {
            const fb = data.feedback
            setFeedbacks((prev) => {
              const idx = prev.findIndex((p) => p.id === fb.id)
              if (idx !== -1) {
                const next = [...prev]
                next[idx] = { ...next[idx], ...fb }
                return next
              }
              // new feedback (unlikely) - add to top
              return [fb, ...prev]
            })
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore websocket failures silently
    }

    return () => { mounted = false; try { ws && ws.close() } catch (e) {} }
  }, [])

  return (
    <div className="feedback-inbox-page">
      <h1>My Inbox</h1>
      <p>Here you can see responses from admins regarding your submissions.</p>

      {loading && <div>Loading...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && feedbacks.length === 0 && (
        <div className="empty">You have not submitted any feedback yet.</div>
      )}

      <div className="feedback-list">
        {feedbacks.map((f) => (
          <div key={f.id} className={`feedback-row ${f.status || ''}`}>
            <div className="feedback-summary" onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}>
              <div className="left">
                <div className="type">{f.type}</div>
                <div className="subject">{f.subject}</div>
              </div>
              <div className="right">
                <div className="status">{f.status || 'open'}</div>
                <div className="time">{new Date(f.created_at).toLocaleString()}</div>
              </div>
            </div>

            {expandedId === f.id && (
              <div className="feedback-body">
                <div className="message">
                  <strong>Your message:</strong>
                  <p>{f.message}</p>
                </div>

                <div className="admin-response">
                  <strong>Admin response:</strong>
                  <p>{f.admin_response || 'No response yet.'}</p>
                </div>

                <div className="meta">
                  <small>Submitted by: {f.name || (me && me.username) || 'You'}</small>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default FeedbackInbox
