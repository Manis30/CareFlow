import { AppError } from "../middleware/errorHandler.js";
import { createDepartmentService,getAllDepartmentService,getDepartmentService,updateDepartmentService,deleteDepartmentService } from "../service/department.js";
export const createDepartmentController=async(req,res)=>{
    const id=req.user.organizationId
    let data=req.body;
    data={...data,organizationId:id}
    const result=await createDepartmentService(data);
    res.status(201).json({success:true,message:"Department created successfully",data:result})
}
export const getAllDepartmentController=async(req,res)=>{
    const page=req.query.page ? parseInt(req.query.page) : null;
    const limit=req.query.limit ? parseInt(req.query.limit) : null;
    const orgId=req.user?.organizationId || req.query?.organizationId || req.query?.orgId;
    const result =await getAllDepartmentService(orgId,page,limit);
    res.status(200).json({success:true,message:"Departments fetched successfully",data:result})
}
export const getDepartmentController=async(req,res)=>{
    const orgId=req.user.organizationId
    const {id}=req.params;
    if(!id){
        throw new AppError(400,'Department ID required')
    }
    const department=await getDepartmentService(id,orgId)
    res.status(200).json({success:true,message:"Department data fetched successfully",data:department})
}
export  const updateDepartmentController=async(req,res)=>{
    const data=req.body;
    const {id}=req.params
    const orgId=req.user.organizationId
    console.log(id,data,'check data')
    const result=await updateDepartmentService(id,orgId,data);
    if(!result){
        throw new AppError(404,"Department not found");
        
    }
    console.log("working or not")
    res.status(200).json({success:true,message:"Department data updated successfully",data:result})
}
export const  deleteDepartmentController=async(req,res)=>{
    const {id}=req.params
    const orgId=req.user.organizationId
    const result=await deleteDepartmentService(id,orgId);
    if(!result){
        throw new AppError(404,'Department not found')
    }
    res.status(200).json({success:true,message:"Department deleted successfully"})
}