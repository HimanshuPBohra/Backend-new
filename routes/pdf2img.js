import express from "express";
import { fromBuffer } from "pdf2pic";
import { readFileSync } from "fs";
const router = express.Router();

router.post("/convert", async (req, res) => {
    try {
        const file = req.files.file;
        console.log("Uploaded file:", file);
        
        const pdfBuffer = file.data;

        const baseOptions = {
            width: 2550 / 2,
            height: 3300 / 2,
            density: 330 / 2,
        };

        const convert = fromBuffer(pdfBuffer, baseOptions);

        const images = await convert.bulk(-1);

        if (images.length === 0) {
            return res.status(400).send("No images were generated from the provided PDF.");
        }

        const imageFiles = images.map(img => {
            const imgPath = img.path;
            const fileBuffer = readFileSync(imgPath);
            return Array.from(fileBuffer);
          });
          return res.send(imageFiles);
    } catch (err) {
        console.error("Error during PDF conversion:", err);
        return res.status(500).send(err);
    }
});


export default router;