import fs from 'fs';
import imagekit from '../configs/imageKit.js';
import User from '../models/User.js';
import Post from '../models/Post.js';

// Add Post
export const addPost = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { content, post_type } = req.body;
    const images = req.files;

    let image_urls = [];

    if (images && images.length > 0) {
      image_urls = await Promise.all(
        images.map(async (image) => {
          const fileBuffer = fs.readFileSync(image.path);
          const response = await imagekit.upload({
            file: fileBuffer,
            fileName: image.originalname,
            folder: "posts",
          });

          return imagekit.url({
            path: response.filePath,
            transformation: [
              { quality: "auto" },
              { format: "webp" },
              { width: "1280" },
            ],
          });
        })
      );
    }

    await Post.create({
      user: userId,
      content,
      image_urls,
      post_type,
    });

    return res.json({
      success: true,
      message: "Post created successfully",
    });
  } catch (error) {
    console.error("Error in addPost:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// Get Posts
export const getFeedPosts = async(req,res) => {
    try{
        const {userId} = req.auth()
        const user = await User.findById(userId)

        // User connections and followings
        const userIds = [userId, ...user.connections, ...user.following]
        const posts = await Post.find({user: {$in: userIds}}).populate('user').sort({createdAt: -1});

        res.json({
            success:true,
            posts
        })
    }
    catch(error){
        console.log(error);
        res.json({
            success: false,
            message:error.message
        });
    }
}

// Like Post 
export const likePost = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { postId } = req.body;

    const post = await Post.findById(postId);

    if (!post) {
      return res.json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.likes_count.includes(userId)) {
      // unlike
      post.likes_count = post.likes_count.filter((user) => user !== userId);
      await post.save();
      res.json({
        success: true,
        message: "Post Unliked",
        updatedLikes: post.likes_count, // ✅ return updated likes
      });
    } else {
      // like
      post.likes_count.push(userId);
      await post.save();
      res.json({
        success: true,
        message: "Post Liked",
        updatedLikes: post.likes_count, // ✅ return updated likes
      });
    }
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};





// import fs from 'fs';
// import imagekit from '../configs/imageKit.js';
// import User from '../models/User.js';
// import Post from '../models/Post.js';

// // Add Post
// export const addPost = async (req, res) => {
//   try {
//     const { userId } = req.auth();
//     const { content, post_type } = req.body;
//     const images = req.files;

//     let image_urls = [];

//     if (images && images.length > 0) {
//       image_urls = await Promise.all(
//         images.map(async (image) => {
//           const fileBuffer = fs.readFileSync(image.path);
//           const response = await imagekit.upload({
//             file: fileBuffer,
//             fileName: image.originalname,
//             folder: "posts",
//           });

//           return imagekit.url({
//             path: response.filePath,
//             transformation: [
//               { quality: "auto" },
//               { format: "webp" },
//               { width: "1280" },
//             ],
//           });
//         })
//       );
//     }

//     await Post.create({
//       user: userId,
//       content,
//       image_urls,
//       post_type,
//     });

//     return res.json({
//       success: true,
//       message: "Post created successfully",
//     });
//   } catch (error) {
//     console.error("Error in addPost:", error.message);
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


// // Get Posts
// export const getFeedPosts = async(req,res) => {
//     try{
//         const {userId} = req.auth()
//         const user = await User.findById(userId)

//         // User connections and followings
//         const userIds = [userId, ...user.connections, ...user.following]
//         const posts = await Post.find({user: {$in: userIds}}).populate('user').sort({createdAt: -1});

//         res.json({
//             success:true,
//             posts
//         })
//     }
//     catch(error){
//         console.log(error);
//         res.json({
//             success: false,
//             message:error.message
//         });
//     }
// }

// // Like Post 
// export const likePost = async (req, res) => {
//   try {
//     const { userId } = req.auth();
//     const { postId } = req.body;

//     const post = await Post.findById(postId);

//     if (!post) {
//       return res.json({
//         success: false,
//         message: "Post not found",
//       });
//     }

//     if (post.likes_count.includes(userId)) {
//       // unlike
//       post.likes_count = post.likes_count.filter((user) => user !== userId);
//       await post.save();
//       res.json({
//         success: true,
//         message: "Post Unliked",
//         updatedLikes: post.likes_count, // ✅ return updated likes
//       });
//     } else {
//       // like
//       post.likes_count.push(userId);
//       await post.save();
//       res.json({
//         success: true,
//         message: "Post Liked",
//         updatedLikes: post.likes_count, // ✅ return updated likes
//       });
//     }
//   } catch (error) {
//     console.log(error);
//     res.json({
//       success: false,
//       message: error.message,
//     });
//   }
// };
