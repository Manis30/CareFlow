import cloudinary from "../config/cloudinary.js";

const deleteFromCloudinary = async (publicId, options = {}) => {
    if (!publicId) return null;
    return new Promise((resolve, reject) => {
        const resourceType = options.resourceType === "raw" ? "raw" : (options.resourceType || "image");
        const destroyOptions = {
            resource_type: resourceType,
            ...options
        };
        cloudinary.uploader.destroy(publicId, destroyOptions, (error, result) => {
            if (error) {
                return reject(error);
            }
            resolve(result);
        });
    });
};

export default deleteFromCloudinary;
