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
//controller for changing the password
const changeCurrentPassword=asyncHandler(async(req,res)=>{
    const{oldPassword,newPassword}=req.body
    const user=await User.findById(req.user?._id)
    //to check the password is correct
    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)
    //check if it is satisfying the condition and throw error if it fails
    if (!isPasswordCorrect){
        throw new ApiError(400,"invalid old password")
    }
    user.password=newPassword
    //save this password
    await user.save({validateBeforeSave:false})
    return res.status(200).json(new ApiResponse(
        200, {}, "password changed successfully"
    ))
})
//getting the currentUser
const getCurrentUser=asyncHandler(async(req,res)=>{
    return res.status(200).json(200,req.user,"Current user fetched successfully")
})
const updateAccountDetails=asyncHandler(async(req,res)=>{
    const {fullName,email}=req.body
    if(!fullName||!email){
        throw new ApiError(400,"all fields are required")
    }
    const user=await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                fullName:fullName,
                email:email
            }
        },
        {new:true}
    ).select("-password")
    return res.status(200).json(new ApiResponse(200,user,"Account details updated Successfully"))
})
// for the updation of files
//multer middleware also plays a  role in this
const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path
    if (!coverImageLocalPath) {
        throw new ApiError(400, "cover Image file is missing")
    }
    //upload on cloudinary
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!coverImage.url) {
        throw new ApiError(400, "error while uploading the coverImage")
    }
    //update the user field
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")
    return res.status(200).json(200, {}, "cover image updated successfully")
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params
    if (!username?.trim()) {
        throw new ApiError(400, "username is missing ")
    }
    //got the username from the url
    //write the channel aggregation pipeplines
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [
                                req.user?._id,
                                "$subscribers.subscriber"
                            ]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project:{
                fullName:1,
                username:1,
                subscriberCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ])
    if (!channel.length){
        throw new ApiError(404,"channel does not exist")
    }
    return res.status(200).json(new ApiResponse(200,channel[0],"user channel fetched successfully"))
})
export { registerUser ,
     loginUser ,
      logoutUser,
      refreshAccessToken ,
       getCurrentUser,
       changeCurrentPassword ,
       updateAccountDetails,
       updateUserAvatar,
       updateUserCoverImage,getUserChannelProfile} 