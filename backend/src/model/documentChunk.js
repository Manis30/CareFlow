import mongoose from "mongoose";

const documentChunkSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "patient",
        required: true,
        index: true
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "organization",
        required: true,
        index: true
    },
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "medicalRecord",
        required: false,
        index: true
    },
    documentType: {
        type: String,
        enum: ["prescription", "lab_report", "medical_record", "document"],
        default: "document"
    },
    sourceId: {
        type: String,
        default: null
    },
    chunkIndex: {
        type: Number,
        default: 0
    },
    text: {
        type: String,
        required: false
    },
    textContent: {
        type: String,
        required: true
    },
    embedding: {
        type: [Number],
        required: true
    },
    ocrConfidence: {
        type: Number,
        default: 100
    },
    isLowConfidence: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for tenant and patient scoped vector search matching Atlas vector search index definition
documentChunkSchema.index({ patientId: 1, organizationId: 1 });

const DocumentChunkModel = mongoose.model("documentChunk", documentChunkSchema);
export default DocumentChunkModel;
