import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './AnalysisResults.css'

const MINDGUARD_URL = ''  // Uses Vite proxy /mgapi -> localhost:3000/api

function AnalysisResults({ results, onDownload, onReset, onViewReports }) {
  const { analysis, text_report } = results

  // ─── Doctor Booking State ───
  const [doctors, setDoctors] = useState([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)
  const [doctorsError, setDoctorsError] = useState(null)
  const [showAllDoctors, setShowAllDoctors] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [bookingForm, setBookingForm] = useState({
    patientName: '', patientEmail: '', patientPhone: '', date: '', notes: ''
  })
  const [bookingStatus, setBookingStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ─── Determine recommended specialty based on risk ───
  const getRecommendedSpecialty = (score) => {
    if (score >= 70) return { specialty: 'Psychiatr', label: 'Psychiatrist', urgency: 'Urgent' }
    if (score >= 40) return { specialty: 'Psycho', label: 'Psychologist', urgency: 'Recommended' }
    return { specialty: '', label: 'Counselor', urgency: 'Optional' }
  }

  const riskScore = analysis.unified_risk_score
  const recommendation = riskScore !== null ? getRecommendedSpecialty(riskScore) : null

  // ─── Fetch doctors from MindGuard API ───
  useEffect(() => {
    setDoctorsLoading(true)
    setDoctorsError(null)
    axios.get('/mgapi/doctors')
      .then(res => {
        if (res.data.success) {
          setDoctors(res.data.doctors)
        } else {
          setDoctorsError('Failed to load doctors')
        }
      })
      .catch(() => {
        setDoctorsError('Could not connect to MindGuard server. Make sure it is running on port 3000.')
      })
      .finally(() => setDoctorsLoading(false))
  }, [])

  // ─── Check if a doctor matches the recommendation ───
  const isRecommended = (doctor) => {
    if (!recommendation || !recommendation.specialty) return false
    return doctor.specialty.toLowerCase().includes(recommendation.specialty.toLowerCase())
  }

  // ─── Sort doctors: recommended first ───
  const sortedDoctors = [...doctors].sort((a, b) => {
    const aRec = isRecommended(a) ? 0 : 1
    const bRec = isRecommended(b) ? 0 : 1
    return aRec - bRec
  })

  // Show recommended doctors by default, or all if toggled
  const visibleDoctors = showAllDoctors
    ? sortedDoctors
    : sortedDoctors.filter(d => isRecommended(d))

  // If no recommended doctors, show all by default
  const displayDoctors = visibleDoctors.length > 0 ? visibleDoctors : sortedDoctors

  // ─── Available dates for selected doctor ───
  const doctorAvailDates = selectedDoctor
    ? [...new Set(
      (selectedDoctor.timeSlots || [])
        .filter(s => !s.isBooked)
        .map(s => s.date.split('T')[0])
    )].sort()
    : []

  const slotsForDate = selectedDoctor?.timeSlots?.filter(
    s => s.date.split('T')[0] === bookingForm.date
  ) || []
  const remainingSlots = slotsForDate.filter(s => !s.isBooked).length
  const totalSlots = slotsForDate.length

  // ─── Handle Booking ───
  const handleBooking = async (e) => {
    e.preventDefault()
    if (!selectedDoctor) return
    setIsSubmitting(true)
    setBookingStatus(null)
    try {
      const res = await axios.post('/mgapi/appointments', {
        ...bookingForm,
        doctorId: selectedDoctor.id,
        notes: bookingForm.notes
          ? `[AI Risk Assessment - Score: ${riskScore ?? 'N/A'}] ${bookingForm.notes}`
          : `[AI Risk Assessment - Score: ${riskScore ?? 'N/A'}]`
      })
      if (res.data.success) {
        setBookingStatus({
          type: 'success',
          message: `Booking #${res.data.bookingNumber} confirmed with ${selectedDoctor.name}! Time: ${res.data.assignedTime} | Room: ${res.data.assignedRoom}`
        })
        setBookingForm({ patientName: '', patientEmail: '', patientPhone: '', date: '', notes: '' })
        // Refresh doctors
        axios.get('/mgapi/doctors').then(r => {
          if (r.data.success) {
            setDoctors(r.data.doctors)
            setSelectedDoctor(r.data.doctors.find(d => d.id === selectedDoctor.id) || null)
          }
        })
      } else {
        setBookingStatus({ type: 'error', message: res.data.error || 'Failed to book.' })
      }
    } catch (err) {
      setBookingStatus({
        type: 'error',
        message: err.response?.data?.error || 'Failed to book appointment. Please try again.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Risk helpers ───
  const getRiskClass = (score) => {
    if (score >= 70) return 'risk-high'
    if (score >= 40) return 'risk-medium'
    return 'risk-low'
  }

  const getRiskLabel = (score) => {
    if (score >= 70) return 'High Risk'
    if (score >= 40) return 'Medium Risk'
    return 'Low Risk'
  }

  const getConflictColor = (conflictType) => {
    switch (conflictType) {
      case 'Consistent': return '#48bb78'
      case 'Partial Inconsistency': return '#ed8936'
      case 'High Inconsistency': return '#f56565'
      default: return '#a0aec0'
    }
  }

  return (
    <div className="analysis-results">
      <div className="card results-header">
        <div className="success-icon">✅</div>
        <h2>Analysis Complete</h2>
        <p>AI has successfully analyzed both reports and generated the final decision report.</p>
      </div>

      <div className="card">
        <h3>📊 Risk Assessment Summary</h3>

        <div className="result-grid">
          <div className="result-item">
            <div className="result-label">Media Risk Score</div>
            <div className="result-value">
              {analysis.media_risk_score}/100
            </div>
            <span className={`risk-badge ${getRiskClass(analysis.media_risk_score)}`}>
              {getRiskLabel(analysis.media_risk_score)}
            </span>
          </div>

          <div className="result-item">
            <div className="result-label">Complaint Risk Score</div>
            <div className="result-value">
              {analysis.complaint_risk_score}/100
            </div>
            <span className={`risk-badge ${getRiskClass(analysis.complaint_risk_score)}`}>
              {getRiskLabel(analysis.complaint_risk_score)}
            </span>
          </div>

          <div className="result-item">
            <div className="result-label">Risk Gap</div>
            <div className="result-value">
              {analysis.risk_gap}
            </div>
            <div className="result-sublabel">Difference between scores</div>
          </div>

          {analysis.unified_risk_score !== null ? (
            <div className="result-item highlight">
              <div className="result-label">Unified Risk Score</div>
              <div className="result-value">
                {analysis.unified_risk_score}/100
              </div>
              <span className={`risk-badge ${getRiskClass(analysis.unified_risk_score)}`}>
                {getRiskLabel(analysis.unified_risk_score)}
              </span>
            </div>
          ) : (
            <div className="result-item highlight suspended">
              <div className="result-label">Status</div>
              <div className="result-value suspended-text">
                SUSPENDED
              </div>
              <span className="risk-badge risk-uncertain">
                Manual Review Required
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>⚖️ Conflict Analysis</h3>

        <div className="conflict-info">
          <div className="conflict-badge" style={{ borderColor: getConflictColor(analysis.conflict_type) }}>
            <div className="conflict-label">Conflict Type</div>
            <div className="conflict-value" style={{ color: getConflictColor(analysis.conflict_type) }}>
              {analysis.conflict_type}
            </div>
          </div>

          <div className="confidence-meter">
            <div className="confidence-label">
              Confidence Level: {(analysis.confidence_level * 100).toFixed(1)}%
            </div>
            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{
                  width: `${analysis.confidence_level * 100}%`,
                  background: analysis.confidence_level >= 0.7
                    ? '#48bb78'
                    : analysis.confidence_level >= 0.4
                      ? '#ed8936'
                      : '#f56565'
                }}
              ></div>
            </div>
          </div>
        </div>

        {analysis.requires_manual_review && (
          <div className="alert alert-error">
            <strong>⚠️ Manual Review Required</strong>
            <p>
              High inconsistency detected between reports. This case requires expert evaluation
              before making final decisions.
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h3>🤖 AI Analysis Summary</h3>
        <div className="summary-text">
          {analysis.summary}
        </div>
      </div>

      {/* ═══ DOCTOR BOOKING SECTION ═══ */}
      <div className="card doctor-booking-section">
        <div className="doctor-booking-header">
          <div>
            <h3>🩺 Book a Doctor</h3>
            <p className="doctor-booking-subtitle">
              {recommendation && riskScore >= 40
                ? `Based on the risk score of ${riskScore}/100, we recommend consulting a ${recommendation.label}.`
                : 'You can book a consultation with any of our available specialists.'
              }
            </p>
          </div>
          {recommendation && riskScore >= 40 && (
            <span className={`urgency-badge urgency-${recommendation.urgency.toLowerCase()}`}>
              {recommendation.urgency}
            </span>
          )}
        </div>

        {doctorsLoading && (
          <div className="doctors-loading">
            <div className="spinner-doc"></div>
            <p>Loading available doctors...</p>
          </div>
        )}

        {doctorsError && (
          <div className="alert alert-error">
            <strong>⚠️ Connection Error</strong>
            <p>{doctorsError}</p>
          </div>
        )}

        {!doctorsLoading && !doctorsError && doctors.length > 0 && (
          <>
            {/* Filter toggle */}
            <div className="doctor-filter-bar">
              <span className="doctor-count">
                {displayDoctors.length} doctor{displayDoctors.length !== 1 ? 's' : ''} available
              </span>
              {doctors.some(d => isRecommended(d)) && (
                <button
                  className="btn-toggle-doctors"
                  onClick={() => setShowAllDoctors(!showAllDoctors)}
                >
                  {showAllDoctors ? '🎯 Show Recommended' : '👥 Browse All Doctors'}
                </button>
              )}
            </div>

            {/* Doctor Cards */}
            <div className="doctor-cards-grid">
              {displayDoctors.map(doctor => (
                <div
                  key={doctor.id}
                  className={`doctor-card ${selectedDoctor?.id === doctor.id ? 'doctor-card-selected' : ''}`}
                  onClick={() => {
                    setSelectedDoctor(doctor)
                    setBookingStatus(null)
                    setBookingForm(prev => ({ ...prev, date: '' }))
                  }}
                >
                  {isRecommended(doctor) && (
                    <div className="recommended-badge">⭐ Recommended</div>
                  )}
                  <div className="doctor-card-top">
                    <div className="doctor-avatar">
                      {doctor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="doctor-info">
                      <h4>{doctor.name}</h4>
                      <p className="doctor-specialty">{doctor.specialty}</p>
                      <div className="doctor-rating">
                        {'★'.repeat(Math.round(doctor.rating))}{'☆'.repeat(5 - Math.round(doctor.rating))}
                        <span>{doctor.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="doctor-card-details">
                    <span>🕐 {doctor.timeSlots?.filter(s => !s.isBooked).length || 0} slots available</span>
                    <span>📋 {doctor.experience} yrs exp.</span>
                    <span className="doctor-fee">Rs. {doctor.consultFee?.toLocaleString()}</span>
                  </div>
                  {doctor.bio && <p className="doctor-bio">{doctor.bio}</p>}
                </div>
              ))}
            </div>

            {/* Inline Booking Form */}
            {selectedDoctor && (
              <div className="booking-form-section">
                <div className="booking-form-header">
                  <h4>📅 Book with {selectedDoctor.name}</h4>
                  <button className="btn-close-booking" onClick={() => setSelectedDoctor(null)}>✕</button>
                </div>
                <form onSubmit={handleBooking} className="booking-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        required
                        value={bookingForm.patientName}
                        onChange={(e) => setBookingForm({ ...bookingForm, patientName: e.target.value })}
                        placeholder="Enter your full name"
                      />
                    </div>
                  </div>
                  <div className="form-row form-row-2col">
                    <div className="form-group">
                      <label>Email *</label>
                      <input
                        type="email"
                        required
                        value={bookingForm.patientEmail}
                        onChange={(e) => setBookingForm({ ...bookingForm, patientEmail: e.target.value })}
                        placeholder="your@email.com"
                      />
                    </div>
                    <div className="form-group">
                      <label>Phone</label>
                      <input
                        type="tel"
                        value={bookingForm.patientPhone}
                        onChange={(e) => setBookingForm({ ...bookingForm, patientPhone: e.target.value })}
                        placeholder="+94 7X XXX XXXX"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Available Date *</label>
                      <select
                        required
                        value={bookingForm.date}
                        onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                      >
                        <option value="">Select date</option>
                        {doctorAvailDates.map(d => {
                          const dt = new Date(d + 'T12:00:00')
                          const slotsLeft = selectedDoctor?.timeSlots?.filter(
                            s => !s.isBooked && s.date.split('T')[0] === d
                          ).length || 0
                          return (
                            <option key={d} value={d}>
                              {dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} — {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left
                            </option>
                          )
                        })}
                      </select>
                      {doctorAvailDates.length === 0 && (
                        <p className="field-warning">No dates available yet</p>
                      )}
                      {bookingForm.date && (
                        <div className="slots-indicator">
                          <span className="slots-count">{remainingSlots}</span>
                          <span className="slots-label">of {totalSlots} bookings remaining</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Notes (optional)</label>
                      <textarea
                        value={bookingForm.notes}
                        onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                        rows={2}
                        placeholder="Describe your concern..."
                      ></textarea>
                    </div>
                  </div>

                  {/* Fee display */}
                  <div className="booking-fee-row">
                    <span>Consultation Fee</span>
                    <strong>Rs. {selectedDoctor.consultFee?.toLocaleString()}</strong>
                  </div>

                  {/* Status */}
                  {bookingStatus && (
                    <div className={`booking-alert booking-alert-${bookingStatus.type}`}>
                      {bookingStatus.type === 'success' ? '✅' : '❌'} {bookingStatus.message}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-book"
                    disabled={isSubmitting || (bookingForm.date !== '' && remainingSlots === 0)}
                  >
                    {isSubmitting ? (
                      <><span className="spinner"></span> Booking...</>
                    ) : (
                      <>✓ Confirm Appointment</>
                    )}
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        {!doctorsLoading && !doctorsError && doctors.length === 0 && (
          <div className="no-doctors">
            <p>No doctors available at the moment.</p>
            <a href="http://localhost:3000#doctors" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              Visit MindGuard to book
            </a>
          </div>
        )}
      </div>

      <div className="card">
        <h3>📄 Final Report</h3>
        <div className="report-text">
          <pre>{text_report}</pre>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => navigator.clipboard.writeText(text_report)}
        >
          📋 Copy Report
        </button>
      </div>

      <div className="card actions-card">
        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={onDownload}
          >
            📥 Download Full Report (PDF)
          </button>
          <button
            className="btn btn-secondary"
            onClick={onViewReports}
          >
            📋 View All Reports
          </button>
          <button
            className="btn btn-secondary"
            onClick={onReset}
          >
            🔄 Analyze New Reports
          </button>
        </div>
      </div>
    </div>
  )
}

export default AnalysisResults
