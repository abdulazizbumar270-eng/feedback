import React from 'react'
import FeedbackForm from '../components/FeedbackForm'

const FeedbackPage = () => {
  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h1>Feedback & Support</h1>
      <p>If you have a suggestion, complaint or question please send it here.</p>
      <FeedbackForm />
    </div>
  )
}

export default FeedbackPage
