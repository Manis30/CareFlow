import OrganizationModel from "../model/organization.js";
export const createOrganizationRepository=async(data)=>{
    return await OrganizationModel.create(data)
}
export const getAllOrganizationRepo=async(page,limit)=>{
    const skip=(page-1)*limit;
    return await OrganizationModel.find().skip(skip).limit(limit);
}
export const getOrganizationRepo=async(id)=>{
    return await OrganizationModel.findById(id);
}
export const  updateOrganizationRepo=async(id,data)=>{
    return await OrganizationModel.findByIdAndUpdate(id,data,{returnDocument:'after'})
}
export const deleteOrganizationRepo=async(id)=>{
    return await OrganizationModel.findOneAndUpdate({_id:id,status:{$ne:"suspended"}},{status:'suspended'},{returnDocument:'after'})
}

export const getDistinctCitiesRepo = async () => {
    const orgs = await OrganizationModel.find({ status: { $ne: "suspended" } }).select("address.city").lean();
    const citiesSet = new Set();
    orgs.forEach((org) => {
        const c = org.address?.city;
        if (c && typeof c === 'string' && c.trim()) {
            citiesSet.add(c.trim());
        }
    });
    return Array.from(citiesSet).sort();
};

export const getActiveOrganizationsRepo = async (filter = {}) => {
    const query = { status: { $ne: "suspended" } };
    if (filter.city) {
        query["address.city"] = new RegExp(`^${filter.city.trim()}$`, "i");
    }
    return await OrganizationModel.find(query).sort({ name: 1 }).lean();
};