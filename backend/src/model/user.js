import mongoose from "mongoose";
export const userSchema=mongoose.Schema({
    name:{
        type:String,required:true,trim:true
    },
    email:{
        type:String,required:true,trim:true
    },
    phone:{
        type:String
    },
    passwordHash:{
        type:String
    },
    organizationId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'organization',
        default:null
    },
    role:{
        type:String,enum:['super_admin','organization_admin','admin','receptionist','doctor','patient']
    },
    refreshTokenHash:{
        type:String
    },
    mustResetPassword:{
        type:Boolean,default:false
    }
    ,
    resetTokenHash:{
        type:String
    },
    resetTokenExpiry:{
        type:Date
    }
    ,
     profileImage: {
        url:{
            type:String,default:null
        },
        publicId:{
            type:String,default:null
        }
    },
    isActive:{
        type:Boolean,default:true
    }
},{
    timestamps:true
})
const UserModel=mongoose.model('user',userSchema)
export default UserModel