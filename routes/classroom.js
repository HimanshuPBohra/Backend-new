import express from 'express';
const router = express.Router();
import passport from 'passport';
import { getClassroomClient, createCourse, addStudentsToCourse, getStudentsFromCourse } from '../utils/googleClassroom.js';
import User from '../models/User.js';
import Class from '../models/Class.js';
import Limits from '../models/Limits.js';

// Middleware to ensure user is authenticated
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'User not authenticated' });
};

// @route   GET /api/classroom/courses
// @desc    Get a list of the user's Google Classroom courses
// @access  Private
router.get('/courses', ensureAuthenticated, async (req, res) => {
    try {
        const classroom = await getClassroomClient(req.user.id);
        const response = await classroom.courses.list({
            teacherId: 'me', // or studentId: 'me'
        });
        res.json(response.data.courses || []);
    } catch (error) {
        console.error('Error fetching courses:', error.message);
        if (error.message.includes('access token missing')) {
            return res.status(401).json({ message: 'Google Classroom not linked or token issue.' });
        }
        if (error.response && error.response.data && error.response.data.error) {
            const googleError = error.response.data.error;
            // Check for specific Google API errors
            if (googleError.code === 401 && googleError.status === 'UNAUTHENTICATED') {
                // This could mean the access token is expired or revoked
                // Attempt to refresh or prompt re-authentication
                // For now, just inform the user
                return res.status(401).json({ 
                    message: 'Google API authentication failed. Please try re-linking your Google account.',
                    details: googleError.message
                });
            }
            return res.status(googleError.code || 500).json({ 
                message: 'Error fetching courses from Google Classroom.',
                details: googleError.message 
            });
        }
        res.status(500).json({ message: 'Server error while fetching courses.' });
    }
});

// @route   GET /api/classroom/courses/:courseId/work
// @desc    Get coursework for a specific course
// @access  Private
router.get('/courses/:courseId/work', ensureAuthenticated, async (req, res) => {
    try {
        const { courseId } = req.params;
        const classroom = await getClassroomClient(req.user.id);
        const response = await classroom.courses.courseWork.list({
            courseId: courseId,
        });
        res.json(response.data.courseWork || []);
    } catch (error) {
        console.error('Error fetching coursework:', error.message);
        if (error.message.includes('access token missing')) {
            return res.status(401).json({ message: 'Google Classroom not linked or token issue.' });
        }
        if (error.response && error.response.data && error.response.data.error) {
            const googleError = error.response.data.error;
            return res.status(googleError.code || 500).json({ 
                message: 'Error fetching coursework from Google Classroom.',
                details: googleError.message 
            });
        }
        res.status(500).json({ message: 'Server error while fetching coursework.' });
    }
});

// @route   GET /api/classroom/courses/:courseId/students
// @desc    Get students for a specific course (roster)
// @access  Private
router.get('/courses/:courseId/students', ensureAuthenticated, async (req, res) => {
    try {
        const { courseId } = req.params;
        const classroom = await getClassroomClient(req.user.id);
        const response = await classroom.courses.students.list({
            courseId: courseId,
        });
        res.json(response.data.students || []);
    } catch (error) {
        console.error('Error fetching students:', error.message);
        if (error.message.includes('access token missing')) {
            return res.status(401).json({ message: 'Google Classroom not linked or token issue.' });
        }
        if (error.response && error.response.data && error.response.data.error) {
            const googleError = error.response.data.error;
            return res.status(googleError.code || 500).json({ 
                message: 'Error fetching students from Google Classroom.',
                details: googleError.message 
            });
        }
        res.status(500).json({ message: 'Server error while fetching students.' });
    }
});

// @route   POST /api/classroom/import-course
// @desc    Import a Google Classroom course into the application
// @access  Private
router.post('/import-course', ensureAuthenticated, async (req, res) => {
    try {
        const { courseId } = req.body;
        
        if (!courseId) {
            return res.status(400).json({ message: 'Course ID is required' });
        }
        
        // Check if user has reached class limit
        const limits = await Limits.findOne({ userId: req.user._id });
        const classes = await Class.find({ userId: req.user._id });
        
        if (classes.length >= limits.classesLimit) {
            return res.status(400).json({ 
                message: 'You have reached the limit of classes you can create. Please upgrade your plan to create more classes.'
            });
        }
        
        // Check if course already imported
        const existingClass = await Class.findOne({ 
            userId: req.user._id, 
            googleCourseId: courseId 
        });
        
        if (existingClass) {
            return res.status(400).json({ message: 'This Google Classroom course has already been imported' });
        }
        
        // Get course details
        const classroom = await getClassroomClient(req.user.id);
        const courseResponse = await classroom.courses.get({ id: courseId });
        const course = courseResponse.data;
        
        // Get students
        const studentsResponse = await classroom.courses.students.list({ courseId });
        const googleStudents = studentsResponse.data.students || [];
        
        // Format students for our application
        const students = [];
        let rollNo = 1;
        
        for (const googleStudent of googleStudents) {
            // Get student profile
            const profileResponse = await classroom.userProfiles.get({ userId: googleStudent.userId });
            const profile = profileResponse.data;
            
            if (profile.emailAddress) {
                students.push({
                    rollNo: rollNo++,
                    name: profile.name.fullName,
                    email: profile.emailAddress
                });
            }
        }
        
        // Create new class
        const newClass = new Class({
            userId: req.user._id,
            name: course.name,
            section: course.section || 'Imported',
            subject: course.description || 'Imported from Google Classroom',
            students,
            googleCourseId: courseId,
            isGoogleClassroom: true,
            lastSyncedWithGoogle: new Date()
        });
        
        await newClass.save();
        
        res.json({
            message: 'Google Classroom course imported successfully',
            class: newClass
        });
    } catch (error) {
        console.error('Error importing Google Classroom course:', error);
        if (error.message.includes('access token missing')) {
            return res.status(401).json({ message: 'Google Classroom not linked or token issue.' });
        }
        if (error.response && error.response.data && error.response.data.error) {
            const googleError = error.response.data.error;
            return res.status(googleError.code || 500).json({ 
                message: 'Error importing course from Google Classroom.',
                details: googleError.message 
            });
        }
        res.status(500).json({ message: 'Server error while importing course.' });
    }
});

// @route   POST /api/classroom/sync-students
// @desc    Sync students from Google Classroom to an existing class
// @access  Private
router.post('/sync-students', ensureAuthenticated, async (req, res) => {
    try {
        const { classId } = req.body;
        
        if (!classId) {
            return res.status(400).json({ message: 'Class ID is required' });
        }
        
        // Find the class
        const classData = await Class.findOne({ 
            _id: classId, 
            userId: req.user._id,
            isGoogleClassroom: true
        });
        
        if (!classData) {
            return res.status(404).json({ message: 'Class not found or not a Google Classroom class' });
        }
        
        // Get students from Google Classroom
        const classroom = await getClassroomClient(req.user.id);
        const studentsResponse = await classroom.courses.students.list({ 
            courseId: classData.googleCourseId 
        });
        const googleStudents = studentsResponse.data.students || [];
        
        // Format students for our application
        const students = [];
        let rollNo = 1;
        
        for (const googleStudent of googleStudents) {
            // Get student profile
            const profileResponse = await classroom.userProfiles.get({ userId: googleStudent.userId });
            const profile = profileResponse.data;
            
            if (profile.emailAddress) {
                students.push({
                    rollNo: rollNo++,
                    name: profile.name.fullName,
                    email: profile.emailAddress
                });
            }
        }
        
        // Update class with new students
        classData.students = students;
        classData.lastSyncedWithGoogle = new Date();
        await classData.save();
        
        res.json({
            message: 'Students synced successfully from Google Classroom',
            students: classData.students
        });
    } catch (error) {
        console.error('Error syncing students from Google Classroom:', error);
        if (error.message.includes('access token missing')) {
            return res.status(401).json({ message: 'Google Classroom not linked or token issue.' });
        }
        if (error.response && error.response.data && error.response.data.error) {
            const googleError = error.response.data.error;
            return res.status(googleError.code || 500).json({ 
                message: 'Error syncing students from Google Classroom.',
                details: googleError.message 
            });
        }
        res.status(500).json({ message: 'Server error while syncing students.' });
    }
});

// @route   POST /api/classroom/create-course
// @desc    Create a new Google Classroom course and import it
// @access  Private
router.post('/create-course', ensureAuthenticated, async (req, res) => {
    try {
        const { name, section, subject } = req.body;
        
        if (!name || !section || !subject) {
            return res.status(400).json({ message: 'Name, section, and subject are required' });
        }
        
        // Check if user has reached class limit
        const limits = await Limits.findOne({ userId: req.user._id });
        const classes = await Class.find({ userId: req.user._id });
        
        if (classes.length >= limits.classesLimit) {
            return res.status(400).json({ 
                message: 'You have reached the limit of classes you can create. Please upgrade your plan to create more classes.'
            });
        }
        
        // Create course in Google Classroom
        const courseData = {
            name,
            section,
            subject
        };
        
        const course = await createCourse(req.user.id, courseData);
        
        // Create class in our application
        const newClass = new Class({
            userId: req.user._id,
            name,
            section,
            subject,
            students: [],
            googleCourseId: course.id,
            isGoogleClassroom: true,
            lastSyncedWithGoogle: new Date()
        });
        
        await newClass.save();
        
        res.json({
            message: 'Google Classroom course created and imported successfully',
            class: newClass,
            googleCourse: course
        });
    } catch (error) {
        console.error('Error creating Google Classroom course:', error);
        if (error.message.includes('access token missing')) {
            return res.status(401).json({ message: 'Google Classroom not linked or token issue.' });
        }
        if (error.response && error.response.data && error.response.data.error) {
            const googleError = error.response.data.error;
            return res.status(googleError.code || 500).json({ 
                message: 'Error creating course in Google Classroom.',
                details: googleError.message 
            });
        }
        res.status(500).json({ message: 'Server error while creating course.' });
    }
});

// @route   POST /api/classroom/add-students
// @desc    Add students to a Google Classroom course
// @access  Private
router.post('/add-students', ensureAuthenticated, async (req, res) => {
    try {
        const { classId, students } = req.body;
        
        if (!classId || !students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ message: 'Class ID and students array are required' });
        }
        
        // Find the class
        const classData = await Class.findOne({ 
            _id: classId, 
            userId: req.user._id,
            isGoogleClassroom: true
        });
        
        if (!classData) {
            return res.status(404).json({ message: 'Class not found or not a Google Classroom class' });
        }
        
        // Add students to Google Classroom
        await addStudentsToCourse(req.user.id, classData.googleCourseId, students);
        
        // Update local class with new students
        const existingEmails = new Set(classData.students.map(s => s.email));
        let maxRollNo = 0;
        
        classData.students.forEach(s => {
            if (s.rollNo > maxRollNo) maxRollNo = s.rollNo;
        });
        
        const newStudents = [];
        
        for (const student of students) {
            if (!existingEmails.has(student.email)) {
                newStudents.push({
                    rollNo: ++maxRollNo,
                    name: student.name,
                    email: student.email
                });
                existingEmails.add(student.email);
            }
        }
        
        classData.students = [...classData.students, ...newStudents];
        classData.lastSyncedWithGoogle = new Date();
        await classData.save();
        
        res.json({
            message: 'Students added successfully to Google Classroom',
            students: classData.students
        });
    } catch (error) {
        console.error('Error adding students to Google Classroom:', error);
        if (error.message.includes('access token missing')) {
            return res.status(401).json({ message: 'Google Classroom not linked or token issue.' });
        }
        if (error.response && error.response.data && error.response.data.error) {
            const googleError = error.response.data.error;
            return res.status(googleError.code || 500).json({ 
                message: 'Error adding students to Google Classroom.',
                details: googleError.message 
            });
        }
        res.status(500).json({ message: 'Server error while adding students.' });
    }
});

export default router;