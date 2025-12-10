import React, { useEffect, useState } from 'react'
import { listFeedbacks, updateFeedback, getCurrentUser } from '../api'
import '../styles/AuthForm.css'

const FeedbackAdmin = () => {
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [reply, setReply] = useState('')
  const [status, setStatus] = useState('open')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const me = await getCurrentUser()
        if (!me.is_staff && !me.is_superuser) {
          setError('Forbidden: Admins only')
          setIsAdmin(false)
          setLoading(false)
          return
        }
        setIsAdmin(true)
        const data = await listFeedbacks()
        setFeedbacks(data)
      } catch (err) {
        setError(err?.response?.data || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const openEditor = (fb) => {
    setEditing(fb)
    setReply(fb.admin_response || '')
    setStatus(fb.status || 'open')
  }

  const saveReply = async () => {
    if (!editing) return
    try {
      const updated = await updateFeedback(editing.id, { admin_response: reply, status })
      setFeedbacks((prev) => prev.map(f => (f.id === updated.id ? updated : f)))
      setEditing(null)
    } catch (err) {
      const serverMsg = err?.response?.data || err?.message || 'Unable to save response'
      setError(typeof serverMsg === 'string' ? serverMsg : JSON.stringify(serverMsg))
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>
  if (error) return <div style={{ padding: 24, color: 'red' }}>{error}</div>
  if (!isAdmin) return <div style={{ padding: 24 }}>Forbidden</div>

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h1>Admin Feedback Inbox</h1>
      <p>Here are recent feedback submissions. Click a row to respond.</p>

      <div style={{ marginTop: 12 }}>
        {feedbacks.length === 0 && <div>No feedback yet.</div>}

        {feedbacks.map((f) => (
          <div key={f.id} style={{ border: '1px solid #e6e6e6', padding: 12, marginBottom: 10, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{f.subject}</strong>
                <div style={{ color: '#666' }}>{f.type} • from {f.user?.username || f.name} • {new Date(f.created_at).toLocaleString()}</div>
              </div>
              <div>
                <span style={{ marginRight: 8 }}>{f.status}</span>
                <button onClick={() => openEditor(f)} className="primary">Respond</button>
              </div>
            </div>
            <div style={{ marginTop: 8, color: '#222' }}>{f.message}</div>
            {f.admin_response && (
              <div style={{ marginTop: 8, background: '#f6fff6', padding: 8, borderRadius: 6, border: '1px solid #e6f3ea' }}>
                <strong>Admin response:</strong>
                <div>{f.admin_response}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div style={{ position: 'fixed', right: 24, top: 80, width: 420, background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
          <h3>Respond to: {editing.subject}</h3>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Response</label>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={6} style={{ width: '100%', padding: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(null)} className="form-button">Cancel</button>
            <button onClick={saveReply} className="primary">Save</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FeedbackAdmin
