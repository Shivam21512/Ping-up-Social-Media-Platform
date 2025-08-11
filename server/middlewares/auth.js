export const protect = (req, res, next) => {
  try {
    const { userId } = req.auth; 

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - no user ID found"
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
