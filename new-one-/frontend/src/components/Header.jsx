import React from 'react'
import './Header.css'

function Header() {
  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🤖</span>
            <div className="logo-text">
              <h1>AI Risk Assessment System</h1>
              <p>Child Social Media Addiction Analysis</p>
            </div>
          </div>
          <div className="header-badge">
            <span className="badge">v2.1</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header

