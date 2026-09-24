import { createDepartmentRepository,getAllDepartmentRepo,getDepartmentRepo,updatedepartmentRepo,deleteDepartmentRepo } from "../repository/department.js";
export const createDepartmentService=async(data)=>{
    const department=await createDepartmentRepository(data);
    return department;
}
export const getAllDepartmentService=async(id,page,limit)=>{
    return await getAllDepartmentRepo(id,page,limit);
}
export const getDepartmentService=async(id,orgId)=>{
    return await getDepartmentRepo(id,orgId);
}
export const  updateDepartmentService=async(id,orgId,data)=>{
    return await updatedepartmentRepo(id,orgId,data);
}
export const deleteDepartmentService=async(id,orgId)=>{
    return await deleteDepartmentRepo(id,orgId,{isActive:'false'});
}