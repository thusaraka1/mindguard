import React, { useState } from 'react'
import axios from 'axios'
import FileUpload from './components/FileUpload'
import AnalysisResults from './components/AnalysisResults'
import Header from './components/Header'
import './App.css'

function App() {
  const [mediaReport, setMediaReport] = useState(null)
  const [complaintReport, setComplaintReport] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [allReports, setAllReports] = useState(null)
  const [loadingReports, setLoadingReports] = useState(false)
  const [view, setView] = useState('upload') // 'upload' or 'reports'
  const [reports, setReports] = useState([])

  const handleAnalyze = async () => {
    if (!mediaReport || !complaintReport) {
      setError('Please upload both reports before analyzing')
      return
    }

    setAnalyzing(true)
    setError(null)
    setResults(null)

    const formData = new FormData()
    formData.append('media_report', mediaReport)
    formData.append('complaint_report', complaintReport)

    try {
      const response = await axios.post('http://localhost:5004/api/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setResults(response.data)
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'An error occurred during analysis. Please try again.'
      )
      console.error('Analysis error:', err)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleReset = () => {
    setMediaReport(null)
    setComplaintReport(null)
    setResults(null)
    setError(null)
  }

  const handleDownloadReport = () => {
    if (results?.report_url) {
      window.open(`http://localhost:5004${results.report_url}`, '_blank')
    }
  }

  const handleViewAllReports = async () => {
    setLoadingReports(true)
    try {
      const response = await axios.get('http://localhost:5004/api/reports')
      setReports(response.data.reports)
      setView('reports')
    } catch (err) {
      setError('Failed to load reports')
      console.error('Reports error:', err)
    } finally {
      setLoadingReports(false)
    }
  }

  const handleViewReports = async () => {
    try {
      const response = await axios.get('http://localhost:5004/api/reports')
      setReports(response.data.reports)
      setView('reports')
    } catch (err) {
      setError('Failed to load reports')
      console.error('Reports error:', err)
    }
  }

  return (
    <div className="app">
      <Header />

      <div className="container">
        {error && (
          <div className="alert alert-error fade-in">
            <strong>Error:</strong> {error}
          </div>
        )}

        {!results ? (
          <div className="upload-section fade-in">
            <div className="card">
              <h2>📄 Upload Reports</h2>
              <p className="subtitle">
                Upload both reports to begin AI-powered risk assessment analysis
              </p>

              <div className="upload-grid">
                <FileUpload
                  label="Report 1: Media Analysis"
                  file={mediaReport}
                  onFileSelect={setMediaReport}
                  accept=".pdf"
                  icon="📱"
                />

                <FileUpload
                  label="Report 2: Complaint Analysis"
                  file={complaintReport}
                  onFileSelect={setComplaintReport}
                  accept=".pdf"
                  icon="📋"
                />
              </div>

              <div className="actions">
                <button
                  className="btn btn-primary"
                  onClick={handleAnalyze}
                  disabled={!mediaReport || !complaintReport || analyzing}
                >
                  {analyzing ? (
                    <>
                      <span className="spinner"></span>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      🤖 Analyze Reports
                    </>
                  )}
                </button>
              </div>

              {analyzing && (
                <div className="analyzing-status fade-in">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: '100%' }}></div>
                  </div>
                  <p className="analyzing-text">
                    AI is analyzing the reports... This may take a moment.
                  </p>
                </div>
              )}
            </div>

            <div className="info-cards">
              <div className="info-card">
                <div className="info-icon">🎯</div>
                <h3>Intelligent Analysis</h3>
                <p>Advanced AI algorithms detect conflicts and inconsistencies between reports</p>
              </div>
              <div className="info-card">
                <div className="info-icon">⚡</div>
                <h3>Fast Processing</h3>
                <p>Get comprehensive risk assessment results in seconds</p>
              </div>
              <div className="info-card">
                <div className="info-icon">🔒</div>
                <h3>Secure & Private</h3>
                <p>Your data is processed securely and never stored permanently</p>
              </div>
              <div className="info-card">
                <div className="info-icon">📋</div>
                <h3>View Reports</h3>
                <p>Access all previously generated reports</p>
                <button className="btn btn-secondary" onClick={handleViewReports}>
                  View All Reports
                </button>
              </div>
            </div>
          </div>
        ) : view === 'reports' ? (
          <div className="reports-section fade-in">
            <div className="card">
              <div className="reports-header">
                <h2>📋 All Reports</h2>
                <button className="btn btn-secondary" onClick={() => setView('upload')}>
                  ← Back to Upload
                </button>
              </div>
              {reports.length === 0 ? (
                <p>No reports found.</p>
              ) : (
                <div className="reports-list">
                  {reports.map((report) => (
                    <div key={report.id} className="report-item">
                      <h3>Report #{report.id}</h3>
                      <p><strong>Filename:</strong> {report.filename}</p>
                      <p><strong>Risk Score:</strong> {report.risk_score}</p>
                      <p><strong>Conflict Level:</strong> {report.conflict_level}</p>
                      <p><strong>Created:</strong> {new Date(report.created_at).toLocaleString()}</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => window.open(`http://localhost:5004/api/download/${report.filename}`, '_blank')}
                      >
                        📥 Download PDF
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="results-section fade-in">
            <AnalysisResults
              results={results}
              onDownload={handleDownloadReport}
              onReset={handleReset}
              onViewReports={handleViewReports}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default App

