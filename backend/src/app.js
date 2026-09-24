import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import userRoute from './route/user.js';
import organizationRoute from './route/organization.js';
import departmentRoute from './route/department.js';
import doctorRoute from './route/doctor.js';
import patientRoute from './route/patient.js';
import AppointmentRoute from './route/appointment.js';
import paymentRoute from './route/payment.js';
import superAdminRoute from './route/superAdmin.js';
import medicalRecordRoute from './route/medicalRecord.js';
import prescriptionRoute from './route/prescription.js';
import chatRoute from './route/chat.js';
import aiRoute from './route/ai.js';
import notificationRoute from './route/notification.js';
import errorHandler from './middleware/errorHandler.js';
const app=express()
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(morgan('dev'))
app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(cookieParser())
app.get("/health",(req,res)=>{
    res.status(200).json({
          status: 'ok',
        service: 'careflow-api'
    })
})
app.use('/api/v1/auth',userRoute)
app.use('/api/v1/organization',organizationRoute)
app.use('/api/v1/department',departmentRoute)
app.use('/api/v1/doctor',doctorRoute);
app.use('/api/v1/patient',patientRoute);
app.use('/api/v1/appointment',AppointmentRoute);
app.use('/api/v1/payment',paymentRoute);
app.use('/api/v1/super-admin',superAdminRoute);
app.use('/api/v1/medical-record',medicalRecordRoute);
app.use('/api/v1/prescription',prescriptionRoute);
app.use('/api/v1/chat',chatRoute);
app.use('/api/v1/ai',aiRoute);
app.use('/api/v1/notification',notificationRoute);
app.use(errorHandler)
export default app;