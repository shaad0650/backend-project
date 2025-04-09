import {v2 as cloudinary}from "cloudinary"
import fs from "fs"
cloudinary.config({ 
    cloud_name:process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_CLOUD_NAME, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});
const uploadOnCloudinary=async(localFilePath)=>{
    try{
        if (!localFilePath)return null
        const response=await cloudinary.upload(localFilePath,{resource_type:'auto'})
        console.log('file uploaded successfully on cloudinary')
        return response

    }catch(error){
        fs.unlinkSync(localFilePath)
        return null
    }
}
cloudinary.v2.uploader.upload()
export {uploadOnCloudinary}