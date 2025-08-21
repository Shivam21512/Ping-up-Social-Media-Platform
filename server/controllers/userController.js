import { connections } from "mongoose"
import imagekit from "../configs/imageKit.js"
import Connection from "../models/Connection.js"
import User from "../models/User.js"
import fs from 'fs'
import userRouter from "../routes/userRoute.js"
import { inngest } from "../inngest/index.js"
import Post from "../models/Post.js"


// Get User data using userID
export const getUserData = async(req, res)=> {
    try{
        const {userId} = req.auth()
        const user = await User.findById(userId)

        if(!user){
            return res.json({
                success:false, 
                message:"User not found"
            })
        }
        res.json({
            success:true,
            user
        })
    }
    catch(error){
        console.log(error);
        res.json({
            success:false,
            message:error.message
        })

    }
}

// Update User Data
export const updateUserData = async (req, res) => {
  try {
    const { userId } = req.auth();
    let { username, bio, location, full_name } = req.body;

    const tempUser = await User.findById(userId);
    if (!tempUser) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    // Keep old username if none provided
    if (!username) username = tempUser.username;

    // Check if new username is already taken (case-insensitive)
    if (tempUser.username.toLowerCase() !== username.toLowerCase()) {
      const existingUser = await User.findOne({
        username: new RegExp(`^${username}$`, "i"),
      });
      if (existingUser) {
        username = tempUser.username; // revert if taken
      }
    }

    const updateData = {
      username,
      bio,
      location,
      full_name,
    };

    // Handle uploaded files
    const profile = req.files?.profile?.[0];
    const cover = req.files?.cover?.[0];

    if (profile) {
      const buffer = fs.readFileSync(profile.path);
      const response = await imagekit.upload({
        file: buffer,
        fileName: profile.originalname,
      });

      const url = imagekit.url({
        path: response.filePath,
        transformation: [
          { quality: "auto" },
          { format: "webp" },
          { width: "512" },
        ],
      });

      updateData.profile_picture = url;
    }

    if (cover) {
      const buffer = fs.readFileSync(cover.path);
      const response = await imagekit.upload({
        file: buffer,
        fileName: cover.originalname,
      });

      const url = imagekit.url({
        path: response.filePath,
        transformation: [
          { quality: "auto" },
          { format: "webp" },
          { width: "1280" },
        ],
      });

      updateData.cover_photo = url;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });

    res.json({
      success: true,
      user: updatedUser,
      message: "Profile Updated Successfully",
    });
  } catch (error) {
    console.error(error);
    res.json({
      success: false,
      message: error.message,
    });
  }
}; 

// Find Users using username, email, location, name
export const discoverUsers = async (req,res)=> {
    try{
        const {userId} = req.auth()
        const {input} = req.body;

        const allUsers = await User.find(
            {
                $or: [
                    {username: new RegExp(input, 'i')},
                    {email: new RegExp(input, 'i')},
                    {full_name: new RegExp(input, 'i')},
                    {location: new RegExp(input, 'i')},

                ]
            }
        )
          const filteredUsers = allUsers.filter(user => user._id.toString() !== userId);

        res.json({
            success:true,
            users:filteredUsers
        })

    }
    catch(error){
        console.log(error);
        res.json({
            success:false,
            message:error.message
        })

    }
}

// Follow User
export const followUser = async(req,res)=> {
    try{
        const {userId} = req.auth()
        const {id} = req.body;

        const user = await User.findById(userId)

        if(user.following.includes(id)){
            return res.json({
                success:false,
                message: 'You are already following this user'
            })
        }

        user.following.push(id);
        await user.save();

        const toUser = await User.findById(id);
        toUser.followers.push(userId)
        await toUser.save();

        res.json({
            success:true,
            message:'Now you are following this user'
        })
    }
    catch(error){
        console.log(error);
        res.json({
            success:false,
            message:error.message
        })

    }
}

// Unfollow User + Remove Connection
export const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { id } = req.body;

    const user = await User.findById(userId);
    const toUser = await User.findById(id);

    if (!user || !toUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 1. Remove from following/followers
    user.following = user.following.filter(u => u.toString() !== id);
    toUser.followers = toUser.followers.filter(u => u.toString() !== userId);

    // 2. Remove from connections (both sides)
    user.connections = user.connections.filter(u => u.toString() !== id);
    toUser.connections = toUser.connections.filter(u => u.toString() !== userId);

    await user.save();
    await toUser.save();

    // 3. Remove any Connection document (pending/accepted)
    await Connection.deleteMany({
      $or: [
        { from_user_id: userId, to_user_id: id },
        { from_user_id: id, to_user_id: userId }
      ]
    });

    res.json({
      success: true,
      message: "Unfollowed and disconnected successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};





// Send Connection Request
export const sendConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { id } = req.body;

    if (userId === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot connect with yourself",
      });
    }

    // 1. Check if already in connections collection
    const existing = await Connection.findOne({
      $or: [
        { from_user_id: userId, to_user_id: id },
        { from_user_id: id, to_user_id: userId }
      ]
    });

    if (existing) {
      if (existing.status === "pending") {
        return res.json({
          success: false,
          message: "Connection request already sent",
        });
      } else if (existing.status === "accepted") {
        return res.json({
          success: false,
          message: "You are already connected with this user",
        });
      }
    }

    // 2. Create new pending request
    const connection = new Connection({
      from_user_id: userId,
      to_user_id: id,
      status: "pending"
    });
    await connection.save();

    res.json({
      success: true,
      message: "Connection request sent",
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// Get User Connections
export const getUserConnections = async (req, res) => {
  try {
    const { userId } = req.auth();

    const user = await User.findById(userId).populate(
      "connections followers following"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Remove duplicates using Map (unique by _id)
    const uniqueConnections = [
      ...new Map(user.connections.map(u => [u._id.toString(), u])).values()
    ];
    const uniqueFollowers = [
      ...new Map(user.followers.map(u => [u._id.toString(), u])).values()
    ];
    const uniqueFollowing = [
      ...new Map(user.following.map(u => [u._id.toString(), u])).values()
    ];

    const pendingConnections = (
      await Connection.find({
        to_user_id: userId,
        status: "pending",
      }).populate("from_user_id")
    ).map((connection) => connection.from_user_id);

    res.json({
      success: true,
      connections: uniqueConnections,
      followers: uniqueFollowers,
      following: uniqueFollowing,
      pendingConnections,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// Accept Connection Request
// Accept Connection Request
export const acceptConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { id } = req.body;

    // Find the pending connection request
    const connection = await Connection.findOne({
      from_user_id: id,
      to_user_id: userId,
      status: "pending",
    });

    if (!connection) {
      return res.json({
        success: false,
        message: "Pending connection request not found",
      });
    }

    // ✅ Add each user to the other's connections list (safe push)
    const user = await User.findById(userId);
    if (!user.connections.includes(id)) {
      user.connections.push(id);
    }
    await user.save();

    const otherUser = await User.findById(id);
    if (!otherUser.connections.includes(userId)) {
      otherUser.connections.push(userId);
    }
    await otherUser.save();

    // ✅ Mark the connection as accepted
    connection.status = "accepted";
    await connection.save();

    res.json({
      success: true,
      message: "Connection accepted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// Get User Profiles
export  const getUserProfiles = async(req,res) => {
    try{
        const {profileId} = req.body;
        const profile = await User.findById(profileId)

        if(!profile){
            return res.json({
                success:false,
                message: "Profile not found"
            });
        }
        const posts = await Post.find({user: profileId}).populate('user')

        res.json({
            success:true,
            profile,
            posts
        })
    }
    catch (error) {
        console.error(error);
        res.json({
            success: false,
            message: error.message
        });
    }
}

// import { connections } from "mongoose"
// import imagekit from "../configs/imageKit.js"
// import Connection from "../models/Connection.js"
// import User from "../models/User.js"
// import fs from 'fs'
// import userRouter from "../routes/userRoute.js"
// import { inngest } from "../inngest/index.js"
// import Post from "../models/Post.js"
// import { clerkClient } from "@clerk/clerk-sdk-node";

// // Get User data using userID
// export const getUserData = async (req, res) => {
//   try {
//     const { userId } = req.auth(); // must be called as a function

//     let user = await User.findById(userId);

//     // If user doesn’t exist in Mongo, create it from Clerk data
//     if (!user) {
//       const clerkUser = await clerkClient.users.getUser(userId);

//       user = await User.create({
//         _id: userId, // Clerk userId becomes Mongo _id
//         email: clerkUser.emailAddresses[0].emailAddress,
//         full_name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
//         username: clerkUser.username || clerkUser.id, // fallback
//         profile_picture: clerkUser.imageUrl || "",
//       });
//     }

//     res.json({
//       success: true,
//       user,
//     });
//   } catch (error) {
//     console.error(error);
//     res.json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // Update User Data
// export const updateUserData = async (req, res) => {
//   try {
//     const { userId } = req.auth();
//     let { username, bio, location, full_name } = req.body;

//     const tempUser = await User.findById(userId);
//     if (!tempUser) {
//       return res.json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // Keep old username if none provided
//     if (!username) username = tempUser.username;

//     // Check if new username is already taken (case-insensitive)
//     if (tempUser.username.toLowerCase() !== username.toLowerCase()) {
//       const existingUser = await User.findOne({
//         username: new RegExp(`^${username}$`, "i"),
//       });
//       if (existingUser) {
//         username = tempUser.username; // revert if taken
//       }
//     }

//     const updateData = {
//       username,
//       bio,
//       location,
//       full_name,
//     };

//     // Handle uploaded files
//     const profile = req.files?.profile?.[0];
//     const cover = req.files?.cover?.[0];

//     if (profile) {
//       const buffer = fs.readFileSync(profile.path);
//       const response = await imagekit.upload({
//         file: buffer,
//         fileName: profile.originalname,
//       });

//       const url = imagekit.url({
//         path: response.filePath,
//         transformation: [
//           { quality: "auto" },
//           { format: "webp" },
//           { width: "512" },
//         ],
//       });

//       updateData.profile_picture = url;
//     }

//     if (cover) {
//       const buffer = fs.readFileSync(cover.path);
//       const response = await imagekit.upload({
//         file: buffer,
//         fileName: cover.originalname,
//       });

//       const url = imagekit.url({
//         path: response.filePath,
//         transformation: [
//           { quality: "auto" },
//           { format: "webp" },
//           { width: "1280" },
//         ],
//       });

//       updateData.cover_photo = url;
//     }

//     const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
//       new: true,
//     });

//     res.json({
//       success: true,
//       user: updatedUser,
//       message: "Profile Updated Successfully",
//     });
//   } catch (error) {
//     console.error(error);
//     res.json({
//       success: false,
//       message: error.message,
//     });
//   }
// }; 

// // Find Users using username, email, location, name
// export const discoverUsers = async (req,res)=> {
//     try{
//         const {userId} = req.auth()
//         const {input} = req.body;

//         const allUsers = await User.find(
//             {
//                 $or: [
//                     {username: new RegExp(input, 'i')},
//                     {email: new RegExp(input, 'i')},
//                     {full_name: new RegExp(input, 'i')},
//                     {location: new RegExp(input, 'i')},

//                 ]
//             }
//         )
//           const filteredUsers = allUsers.filter(user => user._id.toString() !== userId);

//         res.json({
//             success:true,
//             users:filteredUsers
//         })

//     }
//     catch(error){
//         console.log(error);
//         res.json({
//             success:false,
//             message:error.message
//         })

//     }
// }

// // Follow User
// export const followUser = async(req,res)=> {
//     try{
//         const {userId} = req.auth()
//         const {id} = req.body;

//         const user = await User.findById(userId)

//         if(user.following.includes(id)){
//             return res.json({
//                 success:false,
//                 message: 'You are already following this user'
//             })
//         }

//         user.following.push(id);
//         await user.save();

//         const toUser = await User.findById(id);
//         toUser.followers.push(userId)
//         await toUser.save();

//         res.json({
//             success:true,
//             message:'Now you are following this user'
//         })
//     }
//     catch(error){
//         console.log(error);
//         res.json({
//             success:false,
//             message:error.message
//         })

//     }
// }

// //Unfollow User
// export const unfollowUser = async(req,res)=> {
//     try{
//         const {userId} = req.auth()
//         const {id} = req.body;

//         const user = await User.findById(userId)
//         user.following = user.following.filter(user=> user !== id);
//         await user.save()

//         const toUser = await User.findById(id)
//         toUser.followers = toUser.followers.filter(user=> user !== userId);
//         await toUser.save()

//         res.json({
//             success:true,
//             message:'You are no longer following this user'
//         })
//     }
//     catch(error){
//         console.log(error);
//         res.json({
//             success:false,
//             message:error.message
//         })
//     }
// }

// // Send Connection Request
// export const sendConnectionRequest = async(req,res)=> {  
//     try{
//         const {userId} = req.auth();
//         const {id} = req.body;

//         // Check if user has sent more than 20 connection requests in the last 24 hours

//         const last24Hours = new Date(Date.now()- 24 * 60 * 60 * 1000)
//         const connectionRequests = await Connection.find({from_user_id: userId,
//             createdAt: { $gt: last24Hours}
//         })
//         if(connectionRequests.length >= 100){
//             return res.json({
//                 success:false,
//                 message:'You have sent more than 100 connection requests in the last 24 hours'
//             })
//         }

//         //Check if user are already connected
//         const connection = await Connection.findOne({
//             $or: [
//                 {from_user_id: userId, to_user_id: id},
//                 {from_user_id: id, to_user_id: userId}
//             ]
//         })

//         if(!connection){
//           const newConnection =   await Connection.create({
//                 from_user_id: userId,
//                 to_user_id: id
//             })

//             await inngest.send({
//                 name: 'app/connection-request',
//                 data: {connectionId: newConnection._id}
//             })
//             return res.json({
//                 success: true,
//                 message: 'Connection request sent successfully'
//             })
//         }else if(connection && connection.status === 'accepted'){
//             return res.json({
//                 success: true,
//                 message: 'You are already connected with this user'
//             })
//         }

//         return res.json({
//             success: false,
//             message: 'Connection request pending'
//         })

//     }
//     catch(error){
//         console.log(error);
//         res.json({
//             success:false,
//             message:error.message
//         })
//     }
// }

// // Get User Connections
// export const getUserConnections = async (req, res) => {
//   try {
//     const userId = req.userId; // आता protect ने सेट केलेलं

//     const user = await User.findById(userId).populate(
//       "connections followers following"
//     );

//     if (!user) {
//       return res.json({ success: false, message: "User not found" });
//     }

//     const pendingConnections = (
//       await Connection.find({
//         to_user_id: userId,
//         status: "pending",
//       }).populate("from_user_id")
//     ).map((connection) => connection.from_user_id);

//     res.json({
//       success: true,
//       connections: user.connections,
//       followers: user.followers,
//       following: user.following,
//       pendingConnections,
//     });
//   } catch (error) {
//     console.error(error);
//     res.json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


// // Accept Connection Request
// export const acceptConnectionRequest = async (req, res) => {
//     try {
//         const { userId } = req.auth();
//         const { id } = req.body;

//         // Find the pending connection request
//         const connection = await Connection.findOne({
//             from_user_id: id,
//             to_user_id: userId,
//             status: 'pending'
//         });

//         if (!connection) {
//             return res.json({
//                 success: false,
//                 message: 'Pending connection request not found'
//             });
//         }

//         // Add each user to the other's connections list
//         const user = await User.findById(userId);
//         if (!user.connections.includes(id)) {
//             user.connections.push(id);
//             await user.save();
//         }

//         const toUser = await User.findById(id);
//         if (!toUser.connections.includes(userId)) {
//             toUser.connections.push(userId);
//             await toUser.save();
//         }

//         // Mark the connection as accepted
//         connection.status = 'accepted';
//         await connection.save();

//         res.json({
//             success: true,
//             message: 'Connection accepted successfully'
//         });

//     } catch (error) {
//         console.error(error);
//         res.json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// // Get User Profiles
// export  const getUserProfiles = async(req,res) => {
//     try{
//         const {profileId} = req.body;
//         const profile = await User.findById(profileId)

//         if(!profile){
//             return res.json({
//                 success:false,
//                 message: "Profile not found"
//             });
//         }
//         const posts = await Post.find({user: profileId}).populate('user')

//         res.json({
//             success:true,
//             profile,
//             posts
//         })
//     }
//     catch (error) {
//         console.error(error);
//         res.json({
//             success: false,
//             message: error.message
//         });
//     }
// }