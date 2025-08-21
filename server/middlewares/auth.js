// export const protect = (req, res, next) => {
//   try {
//     const { userId } = req.auth(); 

//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized - no user ID found"
//       });
//     }

//     next();
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// middlewares/protect.js
export const protect = (req, res, next) => {
  try {
    const auth = req.auth();  // Clerk middleware मधून मिळतो
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - no user ID found"
      });
    }

    req.userId = userId; // पुढे controllers मध्ये वापर
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
