/**
 * Reusable utility helpers for Jarir's Music Station
 * (DRY Principle Compliance)
 */

// Changed on 2026-05-23 19:19:00

/**
 * Validate audio files for type and size constraints (limit to 10MB)
 * @param {File} file 
 * @returns {string|null} Error message or null if valid
 */
export function validateAudioFile(file) {
  if (!file) return 'No file selected.'
  
  const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-m4a']
  if (!validTypes.includes(file.type) && !file.name.endsWith('.mp3')) {
    return 'Invalid audio format. Please upload an MP3, WAV, or OGG file.'
  }
  
  const maxSize = 10 * 1024 * 1024 // 10MB limit
  if (file.size > maxSize) {
    return 'Audio file is too large. Maximum limit is 10MB.'
  }
  
  return null
}

/**
 * Validate image files for cover artworks (limit to 3MB)
 * @param {File} file 
 * @returns {string|null} Error message or null if valid
 */
export function validateImageFile(file) {
  if (!file) return 'No file selected.'
  
  const validTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!validTypes.includes(file.type)) {
    return 'Invalid image format. Please upload a JPEG, PNG, or WebP image.'
  }
  
  const maxSize = 3 * 1024 * 1024 // 3MB limit
  if (file.size > maxSize) {
    return 'Cover image is too large. Maximum limit is 3MB.'
  }
  
  return null
}

/**
 * Generate a cryptographically secure-looking unique share token for private tracks
 * @returns {string} Unique token string
 */
export function generateShareToken() {
  const parts = [
    Math.random().toString(36).substring(2, 10),
    Math.random().toString(36).substring(2, 10),
    Date.now().toString(36).substring(4)
  ]
  return `sec_tok_${parts.join('')}`
}

/**
 * Copy text to clipboard and trigger optional success callback
 * @param {string} text 
 * @param {Function} onSuccess 
 */
export function copyToClipboard(text, onSuccess) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => {
        if (onSuccess) onSuccess()
      })
      .catch(err => {
        console.error("Clipboard copy failed:", err)
      })
  } else {
    // Fallback for older browsers
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error("Fallback copy failed:", err)
    }
    document.body.removeChild(textArea)
  }
}
