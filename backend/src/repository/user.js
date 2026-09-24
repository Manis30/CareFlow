import mongoose from "mongoose";
import UserModel from "../model/user.js";

export const register = async (data) => {
    return await UserModel.create(data);
};

export const getUserByEmail = async (email) => {
    return await UserModel.findOne({ email }).populate("organizationId", "name email phone address workingHours organizationLogo logo");
};

export const getUserById = async (id) => {
    return await UserModel.findById(id).populate("organizationId", "name email phone address workingHours organizationLogo logo");
};

export const findUserById = getUserById;

export const updateUser = async (id, data) => {
    return await UserModel.findByIdAndUpdate(id, data, { returnDocument: 'after' }).populate("organizationId", "name email phone address workingHours organizationLogo logo");
};

export const findUserByField = async (field) => {
    return await UserModel.findOne(field).populate("organizationId", "name email phone address workingHours organizationLogo logo");
};

export const deactivateUser = async (id) => {
    return await UserModel.findOneAndUpdate({ _id: id, isActive: { $ne: false } }, { isActive: false }, { returnDocument: 'after' });
};