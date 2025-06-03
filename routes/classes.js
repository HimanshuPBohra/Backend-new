import express from "express";
import { validate } from "../middlewares/validate.js";
import Limits from "../models/Limits.js";
import Class from "../models/Class.js";
import joi from "joi";
import Evaluator from "../models/Evaluator.js";

const router = express.Router();

router.get("/", validate, async (req, res) => {
    const limits = await Limits.findOne({ userId: req.user._id });

    const classes = await Class.find({ userId: req.user._id }).lean();
    return res.send({ classes, limit: limits.classesLimit });
});

router.post("/by-id", validate, async (req, res) => {
    const schema = joi.object({
        classId: joi.string().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        const classData = await Class.findOne({ _id: data.classId, userId: req.user._id });
        return res.send(classData);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/new", validate, async (req, res) => {
    const schema = joi.object({
        name: joi.string().required(),
        section: joi.string().required(),
        subject: joi.string().required(),
        createInGoogleClassroom: joi.boolean().default(false),
    });

    try {
        const data = await schema.validateAsync(req.body);
        const classes = await Class.find({ userId: req.user._id });

        const limits = await Limits.findOne({ userId: req.user._id });

        if (classes.length >= limits.classesLimit) {
            return res.status(400).send("You have reached the limit of classes you can create. Please upgrade your plan to create more classes.");
        }

        const newClass = new Class({
            userId: req.user._id,
            name: data.name,
            section: data.section,
            subject: data.subject,
            students: [],
            isGoogleClassroom: false,
        });

        // If user wants to create this class in Google Classroom as well
        if (data.createInGoogleClassroom) {
            try {
                // Import the createCourse function
                const { createCourse } = await import('../utils/googleClassroom.js');
                
                // Create course in Google Classroom
                const courseData = {
                    name: data.name,
                    section: data.section,
                    subject: data.subject
                };
                
                const course = await createCourse(req.user.id, courseData);
                
                // Update class with Google Classroom info
                newClass.googleCourseId = course.id;
                newClass.isGoogleClassroom = true;
                newClass.lastSyncedWithGoogle = new Date();
            } catch (googleError) {
                console.error('Error creating Google Classroom course:', googleError);
                // Continue creating the class locally even if Google Classroom creation fails
            }
        }

        await newClass.save();
        return res.send(newClass);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/save", validate, async (req, res) => {
    const schema = joi.object({
        classId: joi.string().required(),
        name: joi.string().required(),
        section: joi.string().required(),
        subject: joi.string().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        const classData = await Class.findOneAndUpdate({ _id: data.classId, userId: req.user._id }, {
            name: data.name,
            section: data.section,
            subject: data.subject,
        }, { new: true });

        return res.send(classData);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/delete", validate, async (req, res) => {
    const schema = joi.object({
        classId: joi.string().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        await Class.findOneAndDelete({ _id: data.classId, userId: req.user._id });
        await Evaluator.deleteMany({ classId: data.classId });
        return res.send("Deleted");
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/add-student", validate, async (req, res) => {
    const schema = joi.object({
        classId: joi.string().required(),
        name: joi.string().required(),
        email: joi.string().email().required(),
        rollNo: joi.number().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        const classData = await Class.findOne({ _id: data.classId, userId: req.user._id }).lean();

        if (!classData) return res.status(400).send("Invalid Class");

        const student = {
            name: data.name,
            email: data.email,
            rollNo: data.rollNo,
        };

        classData.students.push(student);

        await Class.updateOne({ _id: data.classId, userId: req.user._id }, { students: classData.students });
        return res.send(classData.students);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/edit-student", validate, async (req, res) => {
    const schema = joi.object({
        classId: joi.string().required(),
        name: joi.string().required(),
        email: joi.string().email().required(),
        rollNo: joi.number().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        const classData = await Class.findOne({ _id: data.classId, userId: req.user._id }).lean();

        if (!classData) return res.status(400).send("Invalid Class");

        const student = {
            name: data.name,
            email: data.email,
            rollNo: data.rollNo,
        };

        const studentIndex = classData.students.findIndex((student) => student.rollNo === data.rollNo);
        classData.students[studentIndex] = student;

        await Class.updateOne({ _id: data.classId, userId: req.user._id }, { students: classData.students });

        return res.send(classData.students);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/delete-student", validate, async (req, res) => {
    const schema = joi.object({
        classId: joi.string().required(),
        rollNo: joi.number().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        const classData = await Class.findOne({ _id: data.classId, userId: req.user._id }).lean();

        if (!classData) return res.status(400).send("Invalid Class");

        const studentIndex = classData.students.findIndex((student) => student.rollNo === data.rollNo);
        classData.students.splice(studentIndex, 1);

        await Class.updateOne({ _id: data.classId, userId: req.user._id }, { students: classData.students });

        return res.send(classData.students);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/import-students", validate, async (req, res) => {
    const schema = joi.object({
        classId: joi.string().required(),
        students: joi.array().items(joi.object({
            rollNo: joi.number().required(),
            name: joi.string().required(),
            email: joi.string().required(),
        })).required(),
        addToGoogleClassroom: joi.boolean().default(false),
    });

    try {
        const data = await schema.validateAsync(req.body);
        const classData = await Class.findOne({ _id: data.classId, userId: req.user._id });

        if (!classData) {
            return res.status(404).send("Class not found");
        }

        // Create a map of existing students by rollNo for quick lookup
        const existingStudentsMap = new Map();
        classData.students.forEach(student => {
            existingStudentsMap.set(student.rollNo, student);
        });

        // Merge new students with existing ones, overwriting if rollNo matches
        data.students.forEach(newStudent => {
            existingStudentsMap.set(newStudent.rollNo, newStudent);
        });

        // Convert map back to array
        classData.students = Array.from(existingStudentsMap.values());

        // If this is a Google Classroom class and user wants to add students to Google Classroom
        if (classData.isGoogleClassroom && classData.googleCourseId && data.addToGoogleClassroom) {
            try {
                // Import the addStudentsToCourse function
                const { addStudentsToCourse } = await import('../utils/googleClassroom.js');
                
                // Add students to Google Classroom
                await addStudentsToCourse(req.user.id, classData.googleCourseId, data.students);
                
                // Update last synced timestamp
                classData.lastSyncedWithGoogle = new Date();
            } catch (googleError) {
                console.error('Error adding students to Google Classroom:', googleError);
                // Continue saving students locally even if Google Classroom addition fails
            }
        }

        await classData.save();
        return res.send(classData);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});


export default router;