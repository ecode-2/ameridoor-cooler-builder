/**
 * API Configuration
 *
 * This file manages the API URL for different environments.
 * Set API_BASE_URL in Netlify environment variables to override.
 */

// Get API URL from environment variable or use default
// For local development, it will use localhost
// For production, set this in Netlify environment variables
const getApiUrl = () => {
  // Check if running in browser with environment variable
  if (typeof window !== 'undefined' && window.ENV && window.ENV.API_URL) {
    return window.ENV.API_URL;
  }

  // Check if we're in local development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }

  // Production: Use Railway backend URL
  // REPLACE THIS WITH YOUR ACTUAL RAILWAY URL
  return 'https://your-backend.railway.app';
};

export const API_BASE_URL = getApiUrl();

// Helper function to make API calls
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    return response;
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
};
