import multer from "multer";
const storage=multer.memoryStorage()
const upload=multer({
    storage,
    limits:{
        fileSize:5*1024*1024
    },
    fileFilter:(req,file,cb)=>{
        const allowedTypes=['image/png','image/webp','image/jpeg','image/jpg','application/pdf'];
        if(allowedTypes.includes(file.mimetype)){
            cb(null,true);
        }
        else{
            cb(new Error("Only jpeg, png, webp, jpg images and pdf documents are allowed"))
        }
    }
})
export default upload;