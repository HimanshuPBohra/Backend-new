import { google } from 'googleapis';
import User from '../models/User.js';

/**
 * Get an authenticated Google Classroom client for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<any>} - The authenticated Google Classroom client
 */
const getClassroomClient = async (userId) => {
  const user = await User.findById(userId);

  if (!user || !user.googleAccessToken) {
    throw new Error('Google access token missing');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );

  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
  });

  // Listen for token refresh and update in DB
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token) {
      user.googleRefreshToken = tokens.refresh_token;
    }
    if (tokens.access_token) {
      user.googleAccessToken = tokens.access_token;
      await user.save();
    }
  });

  return google.classroom({ version: 'v1', auth: oauth2Client });
};

/**
 * Create a new course in Google Classroom
 * @param {string} userId - User ID
 * @param {Object} courseData - Course data (name, section, description)
 * @returns {Promise<Object>} - Created course object
 */
const createCourse = async (userId, courseData) => {
  const classroom = await getClassroomClient(userId);

  const course = {
    name: courseData.name,
    section: courseData.section,
    description: courseData.subject,
    ownerId: 'me',
    courseState: 'ACTIVE',
  };

  const response = await classroom.courses.create({
    requestBody: course,
  });

  return response.data;
};

/**
 * Add students to a Google Classroom course
 * @param {string} userId - User ID
 * @param {string} courseId - Google Classroom course ID
 * @param {Array} students - Array of student objects with email and name
 * @returns {Promise<Array>} - Array of invitation objects
 */
const addStudentsToCourse = async (userId, courseId, students) => {
  const classroom = await getClassroomClient(userId);
  const invitations = [];

  for (const student of students) {
    if (!student.email) continue;

    try {
      const invitation = {
        courseId: courseId,
        role: 'STUDENT',
        userId: student.email,
      };

      const response = await classroom.invitations.create({
        requestBody: invitation,
      });

      invitations.push(response.data);
    } catch (error) {
      console.error(`Error inviting student ${student.email}:`, error.message || error);
    }
  }

  return invitations;
};

/**
 * Get students from a Google Classroom course
 * @param {string} userId - User ID
 * @param {string} courseId - Google Classroom course ID
 * @returns {Promise<Array>} - Array of student objects
 */
const getStudentsFromCourse = async (userId, courseId) => {
  const classroom = await getClassroomClient(userId);

  const response = await classroom.courses.students.list({
    courseId,
  });

  const students = response.data.students || [];
  const formattedStudents = [];

  for (const student of students) {
    try {
      const profileResponse = await classroom.userProfiles.get({
        userId: student.userId,
      });

      const profile = profileResponse.data;

      if (profile.emailAddress) {
        formattedStudents.push({
          name: profile.name.fullName,
          email: profile.emailAddress,
          googleId: student.userId,
          profile,
        });
      }
    } catch (error) {
      console.error(`Error fetching student profile:`, error.message || error);
    }
  }

  return formattedStudents;
};

export {
  getClassroomClient,
  createCourse,
  addStudentsToCourse,
  getStudentsFromCourse,
};
