import dotenv from "dotenv"

import connectDB from "./db/index.js"
dotenv.config({
    path:'./env'
})


connectDB()









// import express from 'express'
// const app=express()
// (async()=>{
//     try{
//         await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//         app.on("error",(error)=>{
//             console.log("ERR:",error)
//         })
//         app.listen(process.env.PORT,()=>{
//             console.log('Listening on the port')
//         })
//     }catch{
//         console.error("ERROR: ",error)
//         throw error
//     }
// })()