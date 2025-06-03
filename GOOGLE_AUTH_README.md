# Google Authentication Integration Guide

## Overview

This document provides instructions on how to set up and use Google OAuth authentication in the application.

## Setup Instructions

### 1. Create Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Select "Web application" as the application type
6. Add a name for your OAuth client
7. Add authorized JavaScript origins:
   - `http://localhost:8080` (for development)
   - Your production URL when deployed
8. Add authorized redirect URIs:
   - `http://localhost:8080/users/auth/google/callback` (for development)
   - Your production callback URL when deployed
9. Click "Create"
10. Note your Client ID and Client Secret

### 2. Update Environment Variables

Add the following variables to your `.env` file:

```
GOOGLE_CLIENT_ID=<your_client_id>
GOOGLE_CLIENT_SECRET=<your_client_secret>
FRONTEND_URL=<your_frontend_url> # e.g., http://localhost:3000
```

## How It Works

### Authentication Flow

1. User clicks "Sign in with Google" button on the frontend
2. User is redirected to `/users/auth/google` endpoint
3. Google OAuth consent screen is displayed
4. After user grants permission, Google redirects to `/users/auth/google/callback`
5. The server creates or updates the user account and generates a JWT token
6. User is redirected to the frontend with the token
7. Frontend stores the token and uses it for authenticated requests

### User Model Changes

The User model has been updated with the following fields to support Google authentication:

- `googleId`: Stores the Google user ID
- `profilePicture`: Stores the user's Google profile picture URL
- `authType`: Indicates whether the user authenticated via "local" or "google"

### API Endpoints

- `GET /users/auth/google`: Initiates Google OAuth flow
- `GET /users/auth/google/callback`: Handles Google OAuth callback
- `GET /users/auth/google/user`: Verifies a Google-authenticated user's token

## Frontend Integration

Add a "Sign in with Google" button to your login page that redirects to `/users/auth/google`.

Create a route in your frontend application to handle the OAuth callback:

```
/auth/google/success?token=<jwt_token>
```

This route should:
1. Extract the token from the URL
2. Store it in localStorage or your auth state management
3. Redirect to the dashboard or home page

## Error Handling

If authentication fails, the user will be redirected to:

```
/login?error=auth_failed
```

Your frontend should handle this error parameter and display an appropriate message.

## Security Considerations

- Always use HTTPS in production
- Keep your Google Client Secret secure
- Validate JWT tokens on both frontend and backend
- Set appropriate session and cookie security options