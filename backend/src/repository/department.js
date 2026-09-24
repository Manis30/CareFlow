import DepartmentModel from "../model/department.js";
export const createDepartmentRepository=async(data)=>{
    return await DepartmentModel.create(data)
}
export const getAllDepartmentRepo=async(id,page,limit)=>{
    const filter = { isActive: { $ne: false } };
    if (id && id !== 'undefined' && id !== 'null') {
        filter.organizationId = id;
    }
    let query = DepartmentModel.find(filter);
    if (page && limit) {
        const skip = (page - 1) * limit;
        query = query.skip(skip).limit(limit);
    }
    return await query;
}
export const getDepartmentRepo=async(id,orgId)=>{
    return await DepartmentModel.findOne({_id:id,organizationId:orgId});
}
export const  updatedepartmentRepo=async(id,orgId,data)=>{
    return await DepartmentModel.findOneAndUpdate({_id:id,organizationId:orgId},data,{returnDocument:'after'})
}
export const deleteDepartmentRepo=async(id,orgId)=>{
    return await DepartmentModel.findOneAndUpdate({_id:id,isActive:{$ne:false},organizationId:orgId},{isActive:false},{returnDocument:'after'})
}

export const getOrCreateGeneralDepartment = async (organizationId) => {
    if (!organizationId) return null;

    let generalDept = await DepartmentModel.findOne({
        organizationId,
        $or: [
            { isDefault: true },
            { name: { $regex: /^general$/i } }
        ],
        isActive: { $ne: false }
    });

    if (generalDept) {
        return generalDept;
    }

    try {
        generalDept = await DepartmentModel.findOneAndUpdate(
            {
                organizationId,
                name: "General"
            },
            {
                $setOnInsert: {
                    name: "General",
                    description: "Default General Practice & Consultation Department",
                    organizationId,
                    isDefault: true,
                    isActive: true
                }
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );
    } catch (err) {
        generalDept = await DepartmentModel.findOne({
            organizationId,
            name: { $regex: /^general$/i }
        });
    }

    return generalDept;
};