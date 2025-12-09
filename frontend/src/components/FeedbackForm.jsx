import React, { useState } from 'react'
import { submitFeedback } from '../api'
import '../styles/AuthForm.css'

const FeedbackForm = ({ onSuccess }) => {
  const [type, setType] = useState('feedback')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      await submitFeedback({ type, subject, message })
      setSuccess('Feedback submitted. Thank you!')
      setSubject('')
      setMessage('')
      setType('feedback')
      if (onSuccess) onSuccess()
    } catch (err) {
      setError(err?.response?.data || 'Could not submit feedback')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-form-container">
      <div className="auth-form-wrapper">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Submit Feedback</h2>
          <p className="info-text">Send suggestions, complaints or questions to the team. We'll respond as soon as possible.</p>

          <div className="form-group">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="feedback">Feedback</option>
              <option value="complain">Complain</option>
              <option value="question">Question</option>
            </select>
          </div>

          <div className="form-group">
            <label>Subject</label>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short subject"
            />
          </div>

          <div className="form-group">
            <label>Message</label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your feedback or question"
              rows={6}
            />
          </div>

          {error && <div className="error">{JSON.stringify(error)}</div>}
          {success && <div className="success">{success}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="primary" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FeedbackForm
