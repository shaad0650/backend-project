import { Router } from "express";
import { loginUser, logoutUser, registerUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middlware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { refreshAccessToken } from "../controllers/user.controller.js";
const router=Router()
router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser
)
router.route("/login").post(loginUser)
//secure routes
router.route("/logout").post(verifyJWT,logoutUser)
//defining the refreshToken router in this 
router.route("/refresh-token").post(refreshAccessToken)
export default router