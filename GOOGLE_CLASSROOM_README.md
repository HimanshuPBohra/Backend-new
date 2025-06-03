# Google Classroom Integration README

This document outlines the integration of Google Classroom into the application, enabling teachers to sync their classes, import assignments, and leverage the app's grading features.

## Prerequisites

1.  **Google Cloud Project**: Ensure you have a Google Cloud Project set up.
2.  **OAuth 2.0 Credentials**: You must have OAuth 2.0 client ID and client secret. Make sure to add the correct redirect URIs. For development, this is typically `http://localhost:YOUR_PORT/users/auth/google/callback` (replace `YOUR_PORT` with your backend's port, e.g., 5000 or 8000).
3.  **Enable Google Classroom API**: In your Google Cloud Project, enable the "Google Classroom API".

## Environment Variables

Update your `.env` file with the Google OAuth credentials:

```
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
FRONTEND_URL=http://localhost:3000 # Or your frontend's URL
```

## Authentication Flow

1.  The user initiates Google Sign-In.
2.  The application requests access to Google profile, email, and Google Classroom scopes (courses, coursework, rosters).
3.  Upon successful authentication and authorization, Google redirects the user to `/users/auth/google/callback`.
4.  The backend exchanges the authorization code for an access token and a refresh token.
5.  These tokens are stored in the `User` model (`googleAccessToken`, `googleRefreshToken`).
6.  The user is then redirected to the frontend with a JWT token for session management.

## User Model Changes

The `User` model in `models/User.js` has been updated to include:

*   `googleAccessToken`: (String) Stores the Google API access token.
*   `googleRefreshToken`: (String) Stores the Google API refresh token (used to obtain new access tokens when the current one expires).

## API Endpoints for Google Classroom

All Google Classroom related endpoints are prefixed with `/api/classroom` and require authentication.

1.  **GET `/api/classroom/courses`**
    *   **Description**: Fetches a list of Google Classroom courses for the authenticated user (where the user is a teacher).
    *   **Access**: Private
    *   **Response**: Array of course objects from Google Classroom.
    *   **Error Handling**:
        *   `401 Unauthorized`: If the user is not authenticated or if there's an issue with Google Classroom linking/tokens (e.g., `access token missing`).
        *   `401 Unauthorized` (Google API specific): If Google API authentication fails (e.g., token expired/revoked). The response will include a message like "Google API authentication failed. Please try re-linking your Google account."
        *   `500 Internal Server Error`: For other server-side issues or unexpected errors from the Google API.

2.  **GET `/api/classroom/courses/:courseId/work`**
    *   **Description**: Fetches the coursework (assignments, materials) for a specific course.
    *   **Parameters**: `courseId` (String) - The ID of the Google Classroom course.
    *   **Access**: Private
    *   **Response**: Array of coursework objects from Google Classroom.
    *   **Error Handling**: Similar to `/api/classroom/courses`, with specific messages for coursework fetching errors.

3.  **GET `/api/classroom/courses/:courseId/students`**
    *   **Description**: Fetches the list of students (roster) for a specific course.
    *   **Parameters**: `courseId` (String) - The ID of the Google Classroom course.
    *   **Access**: Private
    *   **Response**: Array of student profile objects from Google Classroom.
    *   **Error Handling**: Similar to `/api/classroom/courses`, with specific messages for student fetching errors.

## Utility Functions

*   `utils/googleClassroom.js`:
    *   `getClassroomClient(userId)`: This function takes a `userId`, retrieves the user's Google access and refresh tokens from the database, and returns an authenticated Google Classroom API client. It also handles automatic token refreshing if an access token expires.

## Frontend Integration (Guidance)

1.  **Link Google Account**: Provide a button or link for users (teachers) to connect their Google account. This should initiate the OAuth flow by redirecting the user to `/users/auth/google` on the backend.
2.  **Fetch and Display Courses**: After successful authentication, the frontend can call `/api/classroom/courses` to display a list of the teacher's Google Classroom courses.
3.  **Select Course and View Details**: Allow teachers to select a course. Upon selection, the frontend can make requests to:
    *   `/api/classroom/courses/:courseId/work` to fetch and display assignments.
    *   `/api/classroom/courses/:courseId/students` to fetch and display the student roster.
4.  **Importing Work**: To import assignments for grading:
    *   The frontend will need to present the fetched coursework to the teacher.
    *   When a teacher selects an assignment to import, the frontend should send the relevant assignment details (e.g., `id`, `title`, `description`, `dueDate`, `maxPoints`) to a new backend endpoint (to be created) that saves this assignment information into your application's database, linking it to the user and the corresponding Google Classroom course/assignment ID.
5.  **Syncing Grades**: (Future Enhancement)
    *   After grading an imported assignment within your application, you would need functionality to push these grades back to Google Classroom. This would involve using the `courses.courseWork.studentSubmissions.patch` or `courses.courseWork.studentSubmissions.turnIn` (and then patch grade) methods of the Google Classroom API.
    *   This requires `https://www.googleapis.com/auth/classroom.coursework.students` scope (for grades) and potentially `https://www.googleapis.com/auth/classroom.courseworkmaterials` if you plan to create/modify coursework directly.

## Error Handling Notes

*   The Google Classroom API can return various errors. The backend routes attempt to catch common errors (like authentication failures or token issues) and return meaningful JSON responses.
*   Pay attention to `401` errors from these endpoints. They might indicate that the user needs to re-authenticate with Google or that their tokens have been revoked.
*   The `getClassroomClient` utility includes basic token refresh logic. If a refresh token is also invalid, the user will need to go through the OAuth flow again.

## Next Steps & Future Enhancements

*   **Implement Assignment Import**: Create backend endpoints and database models to store imported Google Classroom assignments within your application.
*   **Grade Syncing**: Develop functionality to push grades from your app back to Google Classroom.
*   **Create Tests/Assignments**: Allow teachers to create new assignments/tests within your app and optionally publish them to Google Classroom.
*   **Deeper UI Integration**: Enhance the UI to seamlessly display and manage Google Classroom data.
*   **Robust Error Handling and Logging**: Add more comprehensive error handling and logging for Google API interactions.