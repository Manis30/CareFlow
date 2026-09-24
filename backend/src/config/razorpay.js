import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();

const keyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY;
const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;

let razorpay = null;
if (keyId && keySecret) {
    razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret
    });
} else {
    console.warn("WARNING: Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) not set.");
}

export default razorpay;