import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js"
import {User} from "../models/user.model.js"
import { ApiResponse } from "../utils/ApiResponse.js"
const registerUser=asyncHandler(async (req,res)=>{
    const {fullName,email,username,password}=req.body
    console.log("email",email)
    if ([fullName,email,username,password].some((field)=>field?.trim()==="")){
        throw new ApiError(400,"fullName is required")
    }
    const exitedUser=User.findOne({
        $or:[{username},{email}]
    })
    if (exitedUser){
        throw new ApiError(409,"Username or email already exists")
    }
    const avatarLocalPath=req.files?.avatar[0]?.path
    const coverImageLocalPath=req.files?.avatar[0]?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"avatar image is required")
    }
    const avatar=await uploadOnCloudinary(avatarLocalPath)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar){
        throw new ApiError(400,"avatar image is required")
    }
    const user=await User.create({
        username:username.toLowerCase(),
        avatar:avatar.url,
        coverImage:coverImage?.url,
        email,
        password,
        fullName

    })
    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser){
        throw new ApiError(500,"something went wrong while registering the user") 
    }
    return res.status(201).json(
        new ApiResponse(201,createdUser,"user created successfully")
    )
})
export {registerUser}