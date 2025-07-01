// backend/src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, authorize } = require('../middlewares/authMiddleware'); // Assuming authorize is also in authMiddleware

// Multer setup for file uploads (placeholder - configure storage properly)
const multer = require('multer');
// const upload = multer({ dest: 'uploads/profile_pictures/' }); // Basic local storage
// For production, use multer-s3 or similar for cloud storage.
// For now, we'll just define a simple upload to simulate, actual saving needs more setup.
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/profile_pictures/'); // Ensure this directory exists or is created
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = file.mimetype.split('/')[1] || 'jpg'; // get file extension
      cb(null, file.fieldname + '-' + req.user.userId + '-' + uniqueSuffix + '.' + extension);
    }
  });

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) { // Accept only image files
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload an image.'), false);
    }
};
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5MB limit
    },
    fileFilter: fileFilter
});
// End Multer setup


// @route   PUT api/v1/users/me
// @desc    Update current logged-in user's profile (name, etc.)
// @access  Private (any authenticated user)
router.put('/me', protect, userController.updateMyProfile);

// @route   POST api/v1/users/me/profile-picture
// @desc    Update current logged-in user's profile picture
// @access  Private (any authenticated user)
// The 'profileImage' should match the name attribute in the form-data from the client
router.post(
    '/me/profile-picture',
    protect,
    (req, res, next) => { // Middleware to ensure uploads directory exists
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(__dirname, '..', '..', 'uploads', 'profile_pictures'); // Adjust path as needed
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        next();
    },
    upload.single('profileImage'), // 'profileImage' is the field name for the file
    userController.updateMyProfilePicture
);


// @route   PUT api/v1/users/me/vehicle
// @desc    Update current logged-in driver's vehicle information
// @access  Private (Driver role only)
router.put('/me/vehicle', protect, authorize('driver'), userController.updateMyVehicleInfo);


module.exports = router;
