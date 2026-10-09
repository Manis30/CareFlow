import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import User from "../src/model/user.js";

async function updatePasswords() {
    await mongoose.connect(process.env.DB_URL);
    const hash = "$2b$10$UH1G/ciX7FeT4T7cyJKmguNUgFOr.WvUPh27/lYkFxTK82RePULsW"; // "Password123!"

    const emails = [
        "dr.rkarthikeyan.cmhi@demo-careflow.in",
        "karthik.raj.02@demo-careflow.in",
        "dr.ksenthilkumar.cauvery-medical@demo-careflow.in",
        "arun.kumar.01@demo-careflow.in"
    ];

    const res = await User.updateMany(
        { email: { $in: emails } },
        { passwordHash: hash, mustResetPassword: false }
    );

    console.log(`Updated passwords for demo users: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
    await mongoose.disconnect();
}

updatePasswords().catch(console.error);
