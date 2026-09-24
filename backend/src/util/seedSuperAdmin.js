import dotenv from "dotenv";
import dbconnection from "../config/db.js";
import UserModel from "../model/user.js";
import { hashPassword } from "./bcrypt.js";

dotenv.config();

export const seedSuperAdmin = async () => {
    try {
        await dbconnection();

        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "superadmin@careflow.com";
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@123";
        const superAdminName = process.env.SUPER_ADMIN_NAME || "Super Admin";

        const existingSuperAdmin = await UserModel.findOne({
            $or: [
                { email: superAdminEmail },
                { role: "super_admin" },
                { role: "superadmin" }
            ]
        });

        if (existingSuperAdmin) {
            console.log("Super Admin already exists:", existingSuperAdmin.email);
            process.exit(0);
        }

        const passwordHash = await hashPassword(superAdminPassword);

        const newSuperAdmin = await UserModel.create({
            name: superAdminName,
            email: superAdminEmail,
            passwordHash,
            role: "super_admin",
            mustResetPassword: false,
            organizationId: null
        });

        console.log("Super Admin created successfully:", newSuperAdmin.email);
        process.exit(0);
    } catch (error) {
        console.error("Error seeding Super Admin:", error.message);
        process.exit(1);
    }
};

seedSuperAdmin();
