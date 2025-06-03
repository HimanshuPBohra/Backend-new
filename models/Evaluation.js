import mongoose from "mongoose";

const EvaluationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.ObjectId,
            required: true,
        },
        evaluatorId: {
            type: mongoose.Schema.ObjectId,
            required: true,
        },
        evaluation: {
            type: Object,
            required: true,
        },
        isCompleted: {
            type: Boolean,
            required: true,
            default: false,
        },
        hasErrors: {
            type: Boolean,
            required: true,
            default: false,
        },
        errorLog: {
            type: String,
            required: false,
            default: "",
        },
        aiResponse: { //to record AI response that the time of error
            type: String,
            required: false,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

const Evaluation = mongoose.model("Evaluation", EvaluationSchema);

export default Evaluation;