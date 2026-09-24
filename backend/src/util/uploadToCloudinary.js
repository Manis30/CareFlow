import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";
const uploadToCloudinary=(fileBuffer,folder,options={})=>{
    return new Promise(
        (resolve,reject)=>{
        const uploadOptions = {
            folder,
            resource_type: options.resourceType || 'auto',
            ...options
        };
        const uploadStream=cloudinary.uploader.upload_stream(uploadOptions,(error,result)=>{
            if(error){
               return reject(error)
            }
            resolve({
                url:result.secure_url,
                publicId:result.public_id,
                resourceType: result.resource_type
            })
        });
        streamifier.createReadStream(fileBuffer).pipe(uploadStream)
    }
    )
} 
export default uploadToCloudinary;