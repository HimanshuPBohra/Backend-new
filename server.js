import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import session from "express-session";
import userRouter from "./routes/users.js";
import evaluatorRouter from "./routes/evaluators.js";
import classRouter from "./routes/classes.js";
import adminRouter from "./routes/admin.js";
import shopRouter from "./routes/shop.js";
import pdfImgRouter from "./routes/pdf2img.js";
import classroomRouter from "./routes/classroom.js";
import { appName } from "./utils/config.js";
import fileUpload from "express-fileupload";
import passport from "./utils/passport.js";
import { setupPassport } from "./utils/passport.js";
import ocrUrlRouter from './routes/ocrUrlRouter.js';

dotenv.config();
const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(cors());
app.use(fileUpload());

// Set up session middleware
app.use(session({
  secret: process.env.TOKEN_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());
setupPassport();

const port = process.env.PORT || 8080;

app.get("/", (req, res) => {
    res.send(appName);
});

mongoose
    .connect(process.env.DB_URL)
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((error) => {
        console.error("Error connecting to MongoDB:", error);
    });

app.use("/users", userRouter);
app.use("/evaluators", evaluatorRouter);
app.use("/classes", classRouter);
app.use("/admin", adminRouter);
app.use("/shop", shopRouter);
app.use("/pdf2img", pdfImgRouter);
app.use("/classroom", classroomRouter); 
app.use("/api", ocrUrlRouter);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
