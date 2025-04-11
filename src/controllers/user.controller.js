import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import jwt from "jsonwebtoken"

const generateAccessRefreshTokens=async(userId)=>{
    try{
        const user=await User.findOne(userId)
        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshToken()
        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})
        return {accessToken,refreshToken}
    }catch(error){
        throw new ApiError(500,"something went wrong while generating and accessing refresh tokens")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password } = req.body
    console.log("email", email)
    
    if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "fullName is required")
    }
    
    const exitedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    
    if (exitedUser) {
        throw new ApiError(409, "Username or email already exists")
    }
    
    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage?.[0]?.path
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage)&& req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage[0].path
    }    
    
    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar image is required")
    }
    
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    
    if (!avatar) {
        throw new ApiError(400, "avatar image is required")
    }
    
    const user = await User.create({
        username: username.toLowerCase(),
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        fullName
    })
    
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    
    if (!createdUser) {
        throw new ApiError(500, "something went wrong while registering the user") 
    }
    
    return res.status(201).json(
        new ApiResponse(201, createdUser, "user created successfully")
    )
})
const loginUser=asyncHandler(async(req,res)=>{
    const {email,username,password}=req.body
    if(!username&&!email){
        throw new ApiError(400,'username or email is required')
    }
    const user=await User.findOne({
        $or:[{username},{email}]
    })
    if(!user){
        throw new ApiError(404,"user not found")
    }
    const isPasswordValid=await user.isPasswordCorrect(password)
    if (!isPasswordValid){
        throw new ApiError(401,"invalid user credentials")
    }
    const {accessToken,refreshToken}=await generateAccessRefreshTokens(user._id)
    const loggedInUser=await User.findById(user._id).select("-password -refreshToken")


    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(200).cookie("accessToken",accessToken,options).
    cookie("refreshToken",refreshToken,options)
    .json(
         new ApiResponse(
            200,{
                user:loggedInUser,
                accessToken,
                refreshToken
            },"user loggedIn successfully"
        )
    )
})
const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }
    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logged out"))
})

// Add a new function to encapsulate the refresh token code
const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorised request")
    }
    
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.Refresh_Token_Secret)
        const user = await User.findById(decodedToken?._id)
        
        if (!user) {
            throw new ApiError(401, "invalid refreshToken")
        }
        
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "refreshToken is expired or used")
        }
        
        const {accessToken, refreshToken: newRefreshToken} = await generateAccessRefreshTokens(user._id)
        
        const options = {
            httpOnly: true,
            secure: true
        }
        
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "accessToken refreshed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, "unauthorised request")
    }
})

export { registerUser , loginUser , logoutUser,refreshAccessToken} 