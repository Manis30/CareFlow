import jwt from 'jsonwebtoken';
import crypto from 'crypto'
export const createToken=(payload,secret,expiry)=>{
    return jwt.sign(payload,secret,{expiresIn:expiry});
}
export const verifyToken=(token,secret)=>{
    return jwt.verify(token,secret);
}
export const tokenHash=(token)=>{
    return crypto.createHash('sha256').update(token).digest('hex')
}