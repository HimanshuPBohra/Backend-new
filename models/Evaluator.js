import mongoose from "mongoose";

const EvaluatorSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.ObjectId,
            required: true,
        },
        classId: {
            type: mongoose.Schema.ObjectId,
            required: true,
            ref: "Class",
        },
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: false,
            default: "",
        },
        questionPapers: {
            type: Array,
            required: true,
        },
        answerKeys: {
            type: Array,
            required: true,
        },
        answerSheets: [
            {
                rollNo: {
                    type: Number,
                    required: true,
                },
                answerSheets: {
                    type: Array,
                    required: true,
                },
            },
        ],
        extraPrompt: {
            type: String,
            required: false,
            default: "",
        },
        totalMarks: {
            type: Number,
            required: true,
            default: 100,
        },
    },
    {
        timestamps: true,
    }
);

const Evaluator = mongoose.model("Evaluator", EvaluatorSchema);

export default Evaluator;