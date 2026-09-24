import mongoose from "mongoose";
const doctorSchema=mongoose.Schema({
    businessId: { type: String, unique: true, sparse: true, index: true },
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"user",required:true},
    organizationId:{type:mongoose.Schema.Types.ObjectId,ref:"organization",required:true},
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "department", default: null },
    departmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "department" }],
    departments: [{ type: String, trim: true }],
    gender: { type: String, enum: ['Male', 'Female', 'Prefer not to say', 'Not specified'], default: 'Not specified' },
    specialization:{type:String,required:true},
    qualification:{type:String,required:true},
    consultationFee:{type:Number,required:true},
    available:[
        {
            day:{type:String,enum:['monday','tuesday','wednesday','thursday','friday','saturday','sunday']},
            isAvailable:{type:Boolean,default:true},
            open:{type:String,default:null},
            close:{type:String,default:null}
        }
    ],
    // Section 6: Doctor leave/time-off periods
    leave: [
        {
            startDate: { type: Date, required: true },
            endDate: { type: Date, required: true },
            reason: { type: String, trim: true, default: null }
        }
    ]
},{
    timeStamps:true
})
const DoctorModel=mongoose.model('doctor',doctorSchema);
export default DoctorModel;