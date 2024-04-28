const express = require("express");
const User = require("../model/user");
const router = express.Router();
const cloudinary = require("cloudinary");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const jwt = require("jsonwebtoken");
const sendMail = require("../utils/sendMail");
const sendToken = require("../utils/jwtToken");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

// create user
router.post("/create-user", async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const userEmail = await User.findOne({ email });

        if (userEmail) {
            return next(new ErrorHandler("User already exists", 400));
        }

        // const myCloud = await cloudinary.v2.uploader.upload(avatar, {
        //   folder: "avatars",
        // });

        const user = {
            name: name,
            email: email,
            password: password,
            // avatar: {
            //   public_id: 123,
            //   url: myCloud.secure_url,
            // },
        };
        // console.log(user);
        const activationToken = createActivationToken(user);

        const activationUrl = `http://localhost:3000/activation/${activationToken}`;

        try {
            await sendMail({
                email: user.email,
                subject: "Activate your account",
                message: `Hello ${user.name}, please click on the link to activate your account: ${activationUrl}`,
            });
            res.status(201).json({
                success: true,
                message: `please check your email:- ${user.email} to activate your account!`,
            });
        } catch (error) {
            // console.log(error);
            return next(new ErrorHandler(error.message, 500));
        }
    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
});

// create activation token
const createActivationToken = (user) => {
    return jwt.sign(user, process.env.ACTIVATION_SECRET, {
        expiresIn: "5m",
    });
};

// activate user
router.post(
    "/activation",
    catchAsyncErrors(async (req, res, next) => {
        try {
            const { activation_token } = req.body;

            const newUser = jwt.verify(
                activation_token,
                process.env.ACTIVATION_SECRET
            );

            if (!newUser) {
                return next(new ErrorHandler("Invalid token", 400));
            }
            const { name, email, password } = newUser;

            let user = await User.findOne({ email });

            if (user) {
                return next(new ErrorHandler("User already exists", 400));
            }
            user = new User({
                name,
                email,
                // avatar,
                password,
            });
            user.save();

            // const newUser2 = new User({
            //   name: 'John Doe',
            //   email: 'john@example.com',
            //   password: 'password123',
            //   // Add any other fields you want to test here
            // });

            // // Save the user instance to the database
            // newUser2.save()

            sendToken(user, 201, res);
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// login user
router.post(
    "/login-user",
    catchAsyncErrors(async (req, res, next) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return next(
                    new ErrorHandler("Please provide the all fields!", 400)
                );
            }

            const user = await User.findOne({ email }).select("+password");

            if (!user) {
                return next(new ErrorHandler("User doesn't exists!", 400));
            }

            const isPasswordValid = await user.comparePassword(password);

            if (!isPasswordValid) {
                return next(
                    new ErrorHandler(
                        "Please provide the correct information",
                        400
                    )
                );
            }

            sendToken(user, 201, res);
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// load user
router.get(
    "/getuser",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id);

            if (!user) {
                return next(new ErrorHandler("User doesn't exists", 400));
            }

            res.status(200).json({
                success: true,
                user,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// log out user
router.get(
    "/logout",
    catchAsyncErrors(async (req, res, next) => {
        try {
            res.cookie("token", null, {
                expires: new Date(Date.now()),
                httpOnly: true,
                sameSite: "none",
                secure: true,
            });
            res.status(201).json({
                success: true,
                message: "Log out successful!",
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// update user info
router.put(
    "/update-user-info",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        try {
            const { email, password, phoneNumber, name } = req.body;

            const user = await User.findOne({ email }).select("+password");

            if (!user) {
                return next(new ErrorHandler("User not found", 400));
            }

            const isPasswordValid = await user.comparePassword(password);

            if (!isPasswordValid) {
                return next(
                    new ErrorHandler(
                        "Please provide the correct information",
                        400
                    )
                );
            }

            user.name = name;
            user.email = email;
            user.phoneNumber = phoneNumber;

            await user.save();

            res.status(201).json({
                success: true,
                user,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// update user avatar
router.put(
    "/update-avatar",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        try {
            let existsUser = await User.findById(req.user.id);
            if (req.body.avatar !== "") {
                const imageId = existsUser.avatar.public_id;

                await cloudinary.v2.uploader.destroy(imageId);

                const myCloud = await cloudinary.v2.uploader.upload(
                    req.body.avatar,
                    {
                        folder: "avatars",
                        width: 150,
                    }
                );

                existsUser.avatar = {
                    public_id: myCloud.public_id,
                    url: myCloud.secure_url,
                };
            }

            await existsUser.save();

            res.status(200).json({
                success: true,
                user: existsUser,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// update user addresses
router.put(
    "/update-user-addresses",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id);

            const sameTypeAddress = user.addresses.find(
                (address) => address.addressType === req.body.addressType
            );
            if (sameTypeAddress) {
                return next(
                    new ErrorHandler(
                        `${req.body.addressType} address already exists`
                    )
                );
            }

            const existsAddress = user.addresses.find(
                (address) => address._id === req.body._id
            );

            if (existsAddress) {
                Object.assign(existsAddress, req.body);
            } else {
                // add the new address to the array
                user.addresses.push(req.body);
            }

            await user.save();

            res.status(200).json({
                success: true,
                user,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// delete user address
router.delete(
    "/delete-user-address/:id",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        try {
            const userId = req.user._id;
            const addressId = req.params.id;

            await User.updateOne(
                {
                    _id: userId,
                },
                { $pull: { addresses: { _id: addressId } } }
            );

            const user = await User.findById(userId);

            res.status(200).json({ success: true, user });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// update user password
router.put(
    "/update-user-password",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id).select("+password");

            const isPasswordMatched = await user.comparePassword(
                req.body.oldPassword
            );

            if (!isPasswordMatched) {
                return next(
                    new ErrorHandler("Old password is incorrect!", 400)
                );
            }

            if (req.body.newPassword !== req.body.confirmPassword) {
                return next(
                    new ErrorHandler(
                        "Password doesn't matched with each other!",
                        400
                    )
                );
            }
            user.password = req.body.newPassword;

            await user.save();

            res.status(200).json({
                success: true,
                message: "Password updated successfully!",
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// find user infoormation with the userId
router.get(
    "/user-info/:id",
    catchAsyncErrors(async (req, res, next) => {
        try {
            const user = await User.findById(req.params.id);

            res.status(201).json({
                success: true,
                user,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// all users --- for admin
router.get(
    "/admin-all-users",
    isAuthenticated,
    isAdmin("Admin", "SuperAdmin"),

    catchAsyncErrors(async (req, res, next) => {
        try {
            const users = await User.find().sort({
                createdAt: -1,
            });
            res.status(201).json({
                success: true,
                users,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// delete users --- admin
router.delete(
    "/delete-user/:id",
    isAuthenticated,
    isAdmin("Admin", "SuperAdmin"),

    catchAsyncErrors(async (req, res, next) => {
        try {
            const user = await User.findById(req.params.id);

            if (!user) {
                return next(
                    new ErrorHandler("User is not available with this id", 400)
                );
            }

            const imageId = user.avatar.public_id;

            await cloudinary.v2.uploader.destroy(imageId);

            await User.findByIdAndDelete(req.params.id);

            res.status(201).json({
                success: true,
                message: "User deleted successfully!",
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

// all admins --- for admin
router.get(
    "/admin-admins",
    isAuthenticated,
    isAdmin("SuperAdmin"),
    catchAsyncErrors(async (req, res, next) => {
        try {
            const admins = await User.find({ role: "Admin" }).sort({
                createdAt: -1,
            });
            // console.log(admins);
            res.status(200).json({
                success: true,
                admins,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

router.put(
    "/new-admin",
    // isAuthenticated,
    // isAdmin("SuperAdmin"),
    catchAsyncErrors(async (req, res, next) => {
        // console.log(req.body);
        try {
            const { email } = req.body;
            // Check if the user exists
            const user = await User.findOne({ email });

            // If user does not exist, return error response
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User does not exist.",
                });
            }

            // If user role is SuperAdmin, return error response
            if (user.role === "SuperAdmin") {
                return res.status(400).json({
                    success: false,
                    message: "Cannot update role for SuperAdmin.",
                });
            }

            // If user exists and their role is not SuperAdmin, update their role to Admin
            user.role = "Admin";
            await user.save();

            // Retrieve updated list of admins
            const admins = await User.find({ role: "Admin" }).sort({
                createdAt: -1,
            });

            // Return success response with updated list of admins
            res.status(200).json({
                success: true,
                message: "User role updated to Admin successfully.",
                admins,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

router.put(
    "/remove-admin",
    isAuthenticated,
    // isAdmin("SuperAdmin"),
    catchAsyncErrors(async (req, res, next) => {
        try {
            const { id } = req.body;
            // Check if the user exists
            const user = await User.findById(id);

            // If user does not exist, return error response
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User does not exist.",
                });
            }

            // If user role is not Admin, return error response
            if (user.role !== "Admin") {
                return res.status(400).json({
                    success: false,
                    message: "User is not an Admin.",
                });
            }

            // If user exists and their role is Admin, update their role to User
            user.role = "user";
            await user.save();

            // Retrieve updated list of admins
            const admins = await User.find({ role: "Admin" }).sort({
                createdAt: -1,
            });

            // Return success response with updated list of admins
            res.status(200).json({
                success: true,
                message: "Admin privileges removed successfully.",
                admins,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);

router.post(
    "/forget-password",
    catchAsyncErrors(async (req, res, next) => {
        try {
            const { email } = req.body;

            // Check if the email exists in the database
            const user = await User.findOne({ email });

            if (!user) {
                return next(new ErrorHandler("Email not found", 404));
            }

            // Generate a reset password token
            const resetPasswordToken = createResetPasswordToken(user);

            // Create a reset password URL
            const resetPasswordUrl = `http://localhost:3000/reset-password/${resetPasswordToken}`;

            // Send an email with the reset password link
            await sendMail({
                email: user.email,
                subject: "Reset Your Password",
                message: `Please click on the link to reset your password: ${resetPasswordUrl}`,
            });

            res.status(200).json({
                success: true,
                message: "Password reset instructions sent to your email.",
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500, "babu not"));
        }
    })
);

// Function to create reset password token
const createResetPasswordToken = (user) => {
    return jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, {
        expiresIn: "30m", // Set expiration time for the token
    });
};

// reset password
router.post("/reset-password/", async (req, res, next) => {
    try {
        // const { token } = req.params;
        const { password, token } = req.body;

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

        // Check if the token is valid and not expired
        if (!decoded) {
            return next(new ErrorHandler("Invalid or expired token", 400));
        }

        // Find the user by id from the decoded token
        const user = await User.findById(decoded.userId);

        if (!user) {
            return next(new ErrorHandler("User not found", 404));
        }

        // Update the user's password
        user.password = password;

        // Save the updated user
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password updated successfully",
        });
    } catch (error) {
        return next(new ErrorHandler(error.message, 500));
    }
});

module.exports = router;
