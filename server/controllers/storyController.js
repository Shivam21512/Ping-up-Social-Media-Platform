import express from "express";
import imagekit from "../configs/imageKit.js";
import fs from 'fs';
import User from "../models/User.js";
import Story from "../models/Story.js";
import { inngest } from "../inngest/index.js";

// Add User Story
export const addUserStory = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { content, media_type, background_color } = req.body;
    const media = req.file;
    let media_url = '';

    // ✅ 1. User अस्तित्वात आहे का check कर
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found in DB"
      });
    }

    // ✅ 2. Media upload handle कर
    if (media && (media_type === 'image' || media_type === 'video')) {
      const fileBuffer = fs.readFileSync(media.path);
      const response = await imagekit.upload({
        file: fileBuffer,
        fileName: media.originalname,
      });
      media_url = response.url;
    }

    // ✅ 3. Story तयार कर
    const story = await Story.create({
      user: userId,  // Clerk ID as string
      content,
      media_url,
      media_type,
      background_color
    });

    // Delete job
    await inngest.send({
      name: 'app/story.delete',
      data: { storyId: story._id },
      delay: "24h"
    });

    res.json({
      success: true,
      message: "Story added successfully"
    });

  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: error.message
    });
  }
};


// Get User Stories
export const getStories = async(req,res)=>{
    try{
        const {userId} = req.auth();
        const user = await User.findById(userId)

        // User connections and followings
        const userIds = [userId, ...user.connections, ...user.following]

        const stories = await Story.find({
            user:{$in: userIds}
        }).populate('user').sort({createdAt: -1});

        res.json({
            success:true,
            stories
        });   
    }
    catch (error) {
        console.log(error);
        res.json({
            success: false,
            message: error.message
        });
    }
}






// import express from "express";
// import imagekit from "../configs/imageKit.js";
// import fs from 'fs';
// import User from "../models/User.js";
// import Story from "../models/Story.js";
// import { inngest } from "../inngest/index.js";

// // Add User Story
// export const addUserStory = async (req, res) => {
//     try {
//         const { userId } = req.auth();
//         const { content, media_type, background_color } = req.body;
//         const media = req.file;
//         let media_url = '';

//         // Upload media to imagekit if type is image or video
//         if (media && (media_type === 'image' || media_type === 'video')) {
//             const fileBuffer = fs.readFileSync(media.path);
//             const response = await imagekit.upload({
//                 file: fileBuffer,
//                 fileName: media.originalname,
//             });
//             media_url = response.url;
//         }

//         // Create story
//        const story =  await Story.create({
//             user: userId,
//             content,
//             media_url,
//             media_type,
//             background_color
//         });

//         // After creating the story
//         await inngest.send({
//             name: 'app/story.delete',
//             data: { storyId: story._id },
//             delay: "24h" // Inngest runs the delete function automatically after 24 hours
//         });


//         res.json({
//             success: true,
//             message: "Story added successfully"
//         });

//     } catch (error) {
//         console.log(error);
//         res.json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// // Get User Stories
// export const getStories = async(req,res)=>{
//     try{
//         const {userId} = req.auth();
//         const user = await User.findById(userId)

//         // User connections and followings
//         const userIds = [userId, ...user.connections, ...user.following]

//         const stories = await Story.find({
//             user:{$in: userIds}
//         }).populate('user').sort({createdAt: -1});

//         res.json({
//             success:true,
//             stories
//         });   
//     }
//     catch (error) {
//         console.log(error);
//         res.json({
//             success: false,
//             message: error.message
//         });
//     }
// }