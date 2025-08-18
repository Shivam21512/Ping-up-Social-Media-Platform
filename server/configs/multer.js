import multer from "multer";
import { upload } from "../middlewares/upload.js";

const storage = multer.diskStorage({})

export const upload = multer({storage})