import React, { useRef, useState } from 'react'
import './FileUpload.css'

function FileUpload({ label, file, onFileSelect, accept, icon }) {
  const fileInputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type === 'application/pdf') {
        onFileSelect(droppedFile)
      }
    }
  }

  const handleChange = (e) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0])
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemove = (e) => {
    e.stopPropagation()
    onFileSelect(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="file-upload-wrapper">
      <label className="file-upload-label">{label}</label>
      
      <div
        className={`upload-zone ${dragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
        onClick={handleClick}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          style={{ display: 'none' }}
        />

        {file ? (
          <div className="file-info">
            <div className="file-icon-large">{icon}</div>
            <div className="file-name">{file.name}</div>
            <div className="file-size">
              {(file.size / 1024).toFixed(2)} KB
            </div>
            <button
              className="btn-remove"
              onClick={handleRemove}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="upload-icon">{icon}</div>
            <p className="upload-text">
              <strong>Click to upload</strong> or drag and drop
            </p>
            <p className="upload-subtext">PDF files only (max 16MB)</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default FileUpload

