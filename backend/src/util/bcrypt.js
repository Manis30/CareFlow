import bcrypt from 'bcrypt';
export const hashPassword=async(text)=>{
    return await bcrypt.hash(text,10);
}
export const comparePassword=async (plain,hashValue) => {
    return await bcrypt.compare(plain,hashValue);
}