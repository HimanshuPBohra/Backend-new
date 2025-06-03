import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));

const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.rosters',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.profile.photos',
  'https://www.googleapis.com/auth/classroom.coursework.me',
];


const getOAuthClient = () => {
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
};


const getAuthUrl = () => {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
};


const getTokenFromCode = async (code) => {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

const listCourses = async (accessToken) => {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client });
  const res = await classroom.courses.list();
  return res.data.courses || [];
};

export {
  getOAuthClient,
  getAuthUrl,
  getTokenFromCode,
  listCourses,
};
