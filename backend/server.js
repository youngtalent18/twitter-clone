import express from 'express';
import cors from "cors";
import cookieParser from 'cookie-parser';

import authRoute from "./routes/authRoute.js"
import userRoute from "./routes/userRoute.js"

import dotenv from "dotenv"
import { connectDB } from "./config/db.js"


dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());// I am parsing request.body
app.use(cors());
app.use(express.urlencoded({ extended: true }));  // I am parsing form data(urlencoded)
app.use(cookieParser());

app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);


connectDB().then(()=>{
    app.listen(8000,()=>{
        console.log(`Server is running on port ${port}`);
    });
})