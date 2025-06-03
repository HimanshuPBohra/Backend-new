import mongoose from "mongoose";

const ClassSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.ObjectId,
            required: true,
        },
        name: {
            type: String,
            required: true
        },
        section: {
            type: String,
            required: true
        },
        subject: {
            type: String,
            required: true
        },
        students: [
            {
                rollNo: {
                    type: Number
                },
                name: {
                    type: String
                },
                email: {
                    type: String
                }
            }
        ],
        googleCourseId: {
            type: String,
            default: null
        },
        isGoogleClassroom: {
            type: Boolean,
            default: false
        },
        lastSyncedWithGoogle: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
    }
);

const Class = mongoose.model("Class", ClassSchema);

export default Class;