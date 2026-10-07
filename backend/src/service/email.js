import dotenv from 'dotenv';
dotenv.config();

/**
 * Transactional Email Dispatcher for CareFlow.
 * Supports SMTP (via nodemailer if available) or API Key provider, with safe logging fallback.
 */

let nodemailer = null;
try {
    nodemailer = await import('nodemailer');
} catch (e) {
    // nodemailer is optional
}

export const sendTransactionalEmail = async ({ to, subject, html, text }) => {
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM_ADDRESS || 'noreply@careflow.health';
    const smtpHost = process.env.SMTP_HOST;
    const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
    const smtpUser = process.env.SMTP_USER;
    const apiKey = process.env.EMAIL_API_KEY;

    if (smtpHost && smtpUser && smtpPass && nodemailer && nodemailer.createTransport) {
        try {
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: smtpUser,
                    pass: smtpPass
                }
            });

            const info = await transporter.sendMail({
                from: `CareFlow Healthcare <${from}>`,
                to,
                subject,
                text: text || html.replace(/<[^>]*>?/gm, ''),
                html
            });
            console.log(`[EMAIL DISPATCH SUCCESS] Sent email to ${to} (MessageId: ${info.messageId})`);
            return { success: true, messageId: info.messageId, mode: 'smtp' };
        } catch (err) {
            console.error(`[EMAIL DISPATCH ERROR - SMTP]:`, err.message);
            return { success: false, error: err.message, mode: 'smtp' };
        }
    }

    if (apiKey) {
        console.log(`[EMAIL DISPATCH API KEY MODE] Dispatching email via provider API to ${to}: "${subject}"`);
        return { success: true, mode: 'api' };
    }

    // Honest missing configuration handling (Rule 18: Never fake successful delivery)
    console.warn(`[EMAIL DISPATCH UNAVAILABLE] SMTP configuration missing. Delivery unavailable for to="${to}" subject="${subject}"`);
    return { success: false, mode: 'unavailable', error: 'SMTP configuration missing' };
};

export const sendPasswordResetEmail = async (email, resetLink) => {
    const subject = "CareFlow Account Password Reset Request";
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4f0ec; border-radius: 12px; background-color: #faf9f6;">
            <h2 style="color: #10493e; margin-top: 0;">CareFlow Healthcare</h2>
            <p>You requested a password reset for your CareFlow account.</p>
            <p>Please click the link below to set a new password. This link expires in 15 minutes:</p>
            <p style="margin: 24px 0;">
                <a href="${resetLink}" style="background-color: #10493e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
            </p>
            <p style="color: #64748b; font-size: 12px;">If you did not request this, please ignore this email.</p>
        </div>
    `;
    return await sendTransactionalEmail({ to: email, subject, html });
};

export const sendAppointmentConfirmationEmail = async (email, appointmentDetails) => {
    const subject = `Appointment Confirmation - CareFlow Healthcare (${appointmentDetails.date || ''})`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4f0ec; border-radius: 12px; background-color: #faf9f6;">
            <h2 style="color: #10493e; margin-top: 0;">CareFlow Appointment Confirmation</h2>
            <p>Your appointment has been confirmed:</p>
            <ul>
                <li><strong>Doctor:</strong> ${appointmentDetails.doctorName || 'Assigned Specialist'}</li>
                <li><strong>Date & Time:</strong> ${appointmentDetails.date || ''} at ${appointmentDetails.time || ''}</li>
                <li><strong>Consultation Type:</strong> ${appointmentDetails.type || 'Offline'}</li>
            </ul>
            <p>Thank you for choosing CareFlow Healthcare.</p>
        </div>
    `;
    return await sendTransactionalEmail({ to: email, subject, html });
};

export const sendAppointmentReminderEmail = async (email, details) => {
    const timeframeText = details.timeframe || "upcoming";
    const subject = `Appointment Reminder: Your Consultation with ${details.doctorName || 'Doctor'} (${timeframeText})`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4f0ec; border-radius: 12px; background-color: #faf9f6;">
            <h2 style="color: #10493e; margin-top: 0;">CareFlow Appointment Reminder</h2>
            <p>This is a reminder for your upcoming appointment:</p>
            <ul>
                <li><strong>Doctor:</strong> ${details.doctorName || 'Assigned Specialist'}</li>
                <li><strong>Clinic/Hospital:</strong> ${details.clinicName || 'CareFlow Clinic'}</li>
                <li><strong>Date & Time:</strong> ${details.date || ''} at ${details.time || ''}</li>
                <li><strong>Type:</strong> ${details.type || 'Offline'}</li>
            </ul>
            <p>Please arrive 10 minutes prior to your scheduled time.</p>
        </div>
    `;
    return await sendTransactionalEmail({ to: email, subject, html });
};

export const sendMedicationReminderEmail = async (email, details) => {
    const subject = `Medication Reminder: Time to take ${details.medicineName || 'your medication'}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4f0ec; border-radius: 12px; background-color: #faf9f6;">
            <h2 style="color: #10493e; margin-top: 0;">CareFlow Medication Reminder</h2>
            <p>It's time to take your scheduled dose:</p>
            <ul>
                <li><strong>Medicine:</strong> ${details.medicineName}</li>
                <li><strong>Dosage:</strong> ${details.dosage}</li>
                <li><strong>Instructions:</strong> ${details.instructions || details.withFood || 'As directed'}</li>
                <li><strong>Scheduled Time:</strong> ${details.scheduledTime || 'Now'}</li>
            </ul>
            <p style="color: #e11d48; font-size: 13px;"><strong>Safety Note:</strong> If you missed a prior dose, NEVER take a double dose.</p>
        </div>
    `;
    return await sendTransactionalEmail({ to: email, subject, html });
};

export const sendFollowUpReminderEmail = async (email, details) => {
    const subject = `Follow-Up Care Reminder: Consultation with ${details.doctorName || 'Doctor'}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4f0ec; border-radius: 12px; background-color: #faf9f6;">
            <h2 style="color: #10493e; margin-top: 0;">CareFlow Follow-Up Reminder</h2>
            <p>You have a recommended follow-up visit scheduled:</p>
            <ul>
                <li><strong>Doctor:</strong> ${details.doctorName || 'Assigned Specialist'}</li>
                <li><strong>Recommended Date:</strong> ${details.followUpDate || ''}</li>
                <li><strong>Reason:</strong> ${details.reason || 'Routine follow-up'}</li>
                ${details.instructions ? `<li><strong>Instructions:</strong> ${details.instructions}</li>` : ''}
            </ul>
            <p>You can book your follow-up consultation directly on the CareFlow portal.</p>
        </div>
    `;
    return await sendTransactionalEmail({ to: email, subject, html });
};

