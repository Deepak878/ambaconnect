// Input validation and sanitization utilities
export const ValidationRules = {
  phone: {
    pattern: /^[\+]?[1-9][\d]{0,15}$/,
    message: 'Please enter a valid phone number',
    sanitize: (value) => value.replace(/[^\d\+]/g, ''),
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address',
    sanitize: (value) => value.toLowerCase().trim(),
  },
  name: {
    pattern: /^[a-zA-Z\s]{2,50}$/,
    message: 'Name should be 2-50 characters and contain only letters',
    sanitize: (value) => value.trim().replace(/\s+/g, ' '),
  },
  salary: {
    pattern: /^\d+(\.\d{1,2})?$/,
    message: 'Please enter a valid salary amount',
    sanitize: (value) => value.replace(/[^\d\.]/g, ''),
  },
  description: {
    maxLength: 500,
    message: 'Description should not exceed 500 characters',
    sanitize: (value) => value.trim(),
  },
  jobTitle: {
    pattern: /^[a-zA-Z0-9\s\-\(\)]{3,100}$/,
    message: 'Job title should be 3-100 characters',
    sanitize: (value) => value.trim(),
  }
};

export const validateField = (field, value, rules = ValidationRules) => {
  if (!value || value.trim() === '') {
    return { isValid: false, message: `${field} is required` };
  }

  const rule = rules[field];
  if (!rule) {
    return { isValid: true, message: '' };
  }

  const sanitizedValue = rule.sanitize ? rule.sanitize(value) : value;

  if (rule.pattern && !rule.pattern.test(sanitizedValue)) {
    return { isValid: false, message: rule.message };
  }

  if (rule.maxLength && sanitizedValue.length > rule.maxLength) {
    return { isValid: false, message: rule.message };
  }

  return { isValid: true, message: '', sanitizedValue };
};

export const validateForm = (formData, requiredFields = []) => {
  const errors = {};
  let isFormValid = true;

  requiredFields.forEach(field => {
    const validation = validateField(field, formData[field]);
    if (!validation.isValid) {
      errors[field] = validation.message;
      isFormValid = false;
    }
  });

  return { isValid: isFormValid, errors };
};

// Rate limiting utility
class RateLimit {
  constructor() {
    this.requests = new Map();
  }

  canMakeRequest(identifier, maxRequests = 5, timeWindow = 60000) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the time window
    const recentRequests = userRequests.filter(time => now - time < timeWindow);
    
    if (recentRequests.length >= maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    return true;
  }

  getRemainingTime(identifier, timeWindow = 60000) {
    const userRequests = this.requests.get(identifier) || [];
    if (userRequests.length === 0) return 0;
    
    const oldestRequest = Math.min(...userRequests);
    const remainingTime = timeWindow - (Date.now() - oldestRequest);
    return Math.max(0, remainingTime);
  }
}

export const rateLimiter = new RateLimit();

// Sanitize user input to prevent XSS
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Mask sensitive information
export const maskPhoneNumber = (phone) => {
  if (!phone || phone.length < 6) return phone;
  const visible = phone.slice(-4);
  const masked = '*'.repeat(phone.length - 4);
  return masked + visible;
};

export const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  const [username, domain] = email.split('@');
  const maskedUsername = username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1);
  return maskedUsername + '@' + domain;
};

// Privacy settings
export const PrivacySettings = {
  CONTACT_HIDDEN: 'hidden',
  CONTACT_REGISTERED_ONLY: 'registered',
  CONTACT_PUBLIC: 'public',
};

// Secure storage helpers
export const SecureStorage = {
  // Hash sensitive data before storing
  hashData: async (data) => {
    // For React Native, you might want to use a crypto library
    // This is a simple implementation for demo purposes
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  },
  
  // Encrypt sensitive data (you'd use a proper encryption library)
  encrypt: (data, key) => {
    // Placeholder for actual encryption
    return btoa(data); // Base64 encoding for demo
  },
  
  decrypt: (encryptedData, key) => {
    // Placeholder for actual decryption
    try {
      return atob(encryptedData); // Base64 decoding for demo
    } catch (e) {
      return null;
    }
  }
};

// Content filtering
export const ContentFilter = {
  // List of inappropriate words/phrases
  bannedWords: [
    // Add your banned words here
    'spam', 'scam', 'fake', 'illegal'
  ],
  
  containsInappropriateContent: (text) => {
    const lowerText = text.toLowerCase();
    return ContentFilter.bannedWords.some(word => lowerText.includes(word));
  },
  
  filterContent: (text) => {
    let filtered = text;
    ContentFilter.bannedWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '*'.repeat(word.length));
    });
    return filtered;
  }
};

// GDPR compliance helpers
export const GDPRHelpers = {
  // Generate consent record
  generateConsentRecord: (userId, consentType) => {
    return {
      userId,
      consentType,
      timestamp: new Date().toISOString(),
      ipAddress: 'hidden', // You'd get this from your backend
      userAgent: 'mobile-app',
    };
  },
  
  // Data retention periods (in days)
  retentionPeriods: {
    userProfiles: 365 * 3, // 3 years
    jobPosts: 365, // 1 year
    messages: 365, // 1 year
    analytics: 365 * 2, // 2 years
  },
  
  // Check if data should be deleted
  shouldDeleteData: (createdAt, dataType) => {
    const retentionPeriod = GDPRHelpers.retentionPeriods[dataType] || 365;
    const createdDate = new Date(createdAt);
    const expiryDate = new Date(createdDate.getTime() + (retentionPeriod * 24 * 60 * 60 * 1000));
    return new Date() > expiryDate;
  }
};