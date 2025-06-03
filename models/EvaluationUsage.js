import mongoose from "mongoose";

const EvaluationUsageSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.ObjectId,
            required: true,
        },
        isCompleted: {
            type: Boolean,
            required: true,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

const EvaluationUsage = mongoose.model("EvaluationUsage", EvaluationUsageSchema);

export default EvaluationUsage;