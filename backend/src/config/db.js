import mongoose from "mongoose";
const  dbconnection=async()=>{
    try {
       await mongoose.connect(process.env.DB_URL);
        console.log("DB connected");
    } catch (error) {
        console.log(error.message)
    }
}
export default dbconnection;