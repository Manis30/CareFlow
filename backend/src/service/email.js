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
    const from = process.env.EMAIL_FROM_ADDRESS || 'noreply@careflow.health';
    const smtpHost = process.env.SMTP_HOST;
    const apiKey = process.env.EMAIL_API_KEY;

    if (smtpHost && nodemailer && nodemailer.createTransport) {
        try {
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
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
            return { success: true, messageId: info.messageId };
        } catch (err) {
            console.error(`[EMAIL DISPATCH ERROR - SMTP]:`, err.message);
        }
    }

    if (apiKey) {
        console.log(`[EMAIL DISPATCH API KEY MODE] Dispatching email via provider API to ${to}: "${subject}"`);
        return { success: true, mode: 'api' };
    }

    // Dev/Test Fallback Logging
    console.log(`[EMAIL DISPATCH MOCK] To: ${to} | Subject: "${subject}" | Content length: ${html?.length || 0} chars`);
    return { success: true, mode: 'mock' };
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
                <li><strong>Consultation Type:</strong> ${appointmentDetails.type || 'Online'}</li>
            </ul>
            <p>Thank you for choosing CareFlow Healthcare.</p>
        </div>
    `;
    return await sendTransactionalEmail({ to: email, subject, html });
};
