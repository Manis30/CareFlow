import mongoose from "mongoose";
const departmentSchema=mongoose.Schema({
    name:{type:String,required:true,trim:true},
    description:{type:String,required:true,trim:true},
    isActive:{type:Boolean,default:true},
    isDefault:{type:Boolean,default:false},
    organizationId:{type:mongoose.Schema.Types.ObjectId,ref:'organization'}
},{
    timeStampes:true
})
const DepartmentModel=mongoose.model('department',departmentSchema);
export default DepartmentModel;