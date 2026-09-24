import { Router } from "express";
import { createDepartmentController, getAllDepartmentController, getDepartmentController, updateDepartmentController, deleteDepartmentController } from "../controller/department.js";
import authentication from '../middleware/authentication.js';
import authorization from '../middleware/authorization.js';

const route = Router();

route.post('/', authentication, authorization('organization_admin', 'admin'), createDepartmentController);
route.get('/', authentication, authorization('organization_admin', 'admin', 'patient', 'super_admin'), getAllDepartmentController);
route.get('/:id', authentication, authorization('organization_admin', 'admin', 'super_admin'), getDepartmentController);
route.patch('/:id', authentication, authorization('organization_admin', 'admin'), updateDepartmentController);
route.delete('/:id', authentication, authorization('organization_admin', 'admin'), deleteDepartmentController);

export default route;