import { Router } from "express";
import {
    registerController,
    loginController,
    refreshController,
    logoutController,
    test,
    forgotPasswordController,
    resetPasswordController,
    forceResetPasswordController,
    updateProfileImageController,
    getMeController,
    updateProfileController
} from "../controller/user.js";
import authentication from "../middleware/authentication.js";
import authorization from "../middleware/authorization.js";
import upload from '../middleware/upload.js';

import { authRateLimiter } from "../middleware/rateLimiter.js";
import { validateRequest } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../validator/index.js";

const route = Router();

route.post('/', validateRequest(registerSchema), registerController);
route.post('/login', authRateLimiter, validateRequest(loginSchema), loginController);
route.post('/refresh', refreshController);
route.post('/logout', logoutController);
route.post('/forgot-password', forgotPasswordController);
route.post('/reset-password', resetPasswordController);
route.post('/force-reset-password', authentication, forceResetPasswordController);
route.post('/check', authentication, authorization('superadmin'), test);
route.get('/me', authentication, getMeController);
route.patch('/me', authentication, updateProfileController);
route.patch('/me/profile-image', authentication, upload.single('profileImage'), updateProfileImageController);

export default route;