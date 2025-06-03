# Google Classroom Integration

This document outlines the integration between our application and Google Classroom, allowing users to import courses, sync students, and create new courses in Google Classroom.

## Features

- Import existing Google Classroom courses into the application
- Sync student rosters from Google Classroom to the application
- Create new courses in Google Classroom from the application
- Add students to Google Classroom courses from the application

## API Endpoints

### Google Classroom API

#### GET /classroom/courses
- Description: Get a list of the user's Google Classroom courses
- Authentication: Required
- Response: Array of Google Classroom courses

#### GET /classroom/courses/:courseId/work
- Description: Get coursework for a specific Google Classroom course
- Authentication: Required
- Parameters: courseId (path)
- Response: Array of coursework items

#### GET /classroom/courses/:courseId/students
- Description: Get students for a specific Google Classroom course
- Authentication: Required
- Parameters: courseId (path)
- Response: Array of student objects

### Integration API

#### POST /classroom/import-course
- Description: Import a Google Classroom course into the application
- Authentication: Required
- Request Body: 
  ```json
  {
    "courseId": "string" // Google Classroom course ID
  }
  ```
- Response: Newly created class object

#### POST /classroom/sync-students
- Description: Sync students from Google Classroom to an existing class
- Authentication: Required
- Request Body: 
  ```json
  {
    "classId": "string" // Application class ID
  }
  ```
- Response: Updated class with synced students

#### POST /classroom/create-course
- Description: Create a new Google Classroom course and import it
- Authentication: Required
- Request Body: 
  ```json
  {
    "name": "string",
    "section": "string",
    "subject": "string"
  }
  ```
- Response: Newly created class and Google Classroom course

#### POST /classroom/add-students
- Description: Add students to a Google Classroom course
- Authentication: Required
- Request Body: 
  ```json
  {
    "classId": "string", // Application class ID
    "students": [
      {
        "name": "string",
        "email": "string"
      }
    ]
  }
  ```
- Response: Updated class with added students

## Class Creation Integration

When creating a new class in the application, users can now choose to also create the class in Google Classroom by setting the `createInGoogleClassroom` flag to `true` in the request body:

```json
{
  "name": "string",
  "section": "string",
  "subject": "string",
  "createInGoogleClassroom": true
}
```

## Student Import Integration

When importing students to a class, users can now choose to also add the students to the corresponding Google Classroom course by setting the `addToGoogleClassroom` flag to `true` in the request body:

```json
{
  "classId": "string",
  "students": [
    {
      "rollNo": 1,
      "name": "string",
      "email": "string"
    }
  ],
  "addToGoogleClassroom": true
}
```

## Authentication

The integration uses OAuth 2.0 for authentication with Google Classroom. The following scopes are requested:

- `https://www.googleapis.com/auth/classroom.courses` - Full access to manage courses
- `https://www.googleapis.com/auth/classroom.coursework.me` - Access to coursework
- `https://www.googleapis.com/auth/classroom.rosters` - Access to manage class rosters
- `https://www.googleapis.com/auth/classroom.profile.emails` - Access to user email addresses
- `https://www.googleapis.com/auth/classroom.profile.photos` - Access to user profile photos

## Data Model

The `Class` model has been extended with the following fields to support Google Classroom integration:

- `googleCourseId`: The ID of the corresponding Google Classroom course
- `isGoogleClassroom`: Boolean flag indicating if the class is linked to Google Classroom
- `lastSyncedWithGoogle`: Timestamp of the last synchronization with Google Classroom

## Future Enhancements

- Sync assignments and coursework from Google Classroom
- Push grades from the application to Google Classroom
- Real-time synchronization of student roster changes
- Support for Google Classroom announcements