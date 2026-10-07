import mongoose from "mongoose";

const scheduleLockSchema = new mongoose.Schema(
    {
        lockKey: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        lockedUntil: {
            type: Date,
            required: true
        },
        lockedBy: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

scheduleLockSchema.index({ lockedUntil: 1 });

const ScheduleLockModel = mongoose.model("scheduleLock", scheduleLockSchema);
export default ScheduleLockModel;
