const express = require("express");
const { isSeller, isAuthenticated, isAdmin } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const router = express.Router();
const Product = require("../model/product");
const Order = require("../model/order");
const Shop = require("../model/shop");
const cloudinary = require("cloudinary");
const ErrorHandler = require("../utils/ErrorHandler");

// cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// console.log(process.env.CLOUDINARY_NAME);
// create product
router.post(
    "/create-product",
    catchAsyncErrors(async (req, res, next) => {
        try {
            const shopId = req.body.shopId;
            const shop = await Shop.findById(shopId);
            if (!shop) {
                return next(new ErrorHandler("Shop Id is invalid!", 400));
            } else {
                let images = [];

                if (typeof req.body.images === "string") {
                    images.push(req.body.images);
                } else {
                    images = req.body.images;
                }

                const imagesLinks = [];

                for (let i = 0; i < images.length; i++) {
                    const result = await cloudinary.v2.uploader.upload(
                        images[i],
                        {
                            folder: "products",
                        }
                    );

                    // console.log(result);
                    imagesLinks.push({
                        public_id: result.public_id,
                        url: result.secure_url,
                    });
                }

                const productData = req.body;
                productData.images = imagesLinks;
                productData.shop = shop;
                productData.approve = false;

                const product = await Product.create(productData);

                res.status(201).json({
                    success: true,
                    product,
                });
            }
        } catch (error) {
            // console.log(error);
            return next(new ErrorHandler(error, 400));
        }
    })
);
// approve product
router.post(
    "/approve-product",
    catchAsyncErrors(async (req, res, next) => {
        try {
            const productId = req.body.productId;

            // Find the product by its ID
            const product = await Product.findById(productId);

            // If the product doesn't exist, return an error
            if (!product) {
                return next(new ErrorHandler("Product not found", 404));
            }

            // Update the product's approve field to true
            product.approve = true;

            // Save the updated product
            await product.save();

            // Send a success response
            res.status(200).json({
                success: true,
                message: "Product approved successfully",
                product: product, // Optionally, you can send the updated product data in the response
            });
        } catch (error) {
            // If an error occurs, return an error response
            return next(new ErrorHandler(error, 400));
        }
    })
);

// delete product
router.delete(
    "/delete-product/:id",
    catchAsyncErrors(async (req, res, next) => {
        try {
            const productId = req.params.id;

            // Delete the product by its ID
            const result = await Product.deleteOne({ _id: productId });

            // Check if the deletion was successful
            if (result.deletedCount === 0) {
                return next(new ErrorHandler("Product not found", 404));
            }

            // Send a success response
            res.status(200).json({
                success: true,
                message: "Product deleted successfully",
            });
        } catch (error) {
            // If an error occurs, return an error response
            return next(new ErrorHandler(error, 400));
        }
    })
);

// get all products of a shop
router.get(
    "/get-all-products-shop/:id",
    catchAsyncErrors(async (req, res, next) => {
        try {
            const products = await Product.find({ shopId: req.params.id });

            res.status(201).json({
                success: true,
                products,
            });
        } catch (error) {
            return next(new ErrorHandler(error, 400));
        }
    })
);

// delete product of a shop
router.delete(
    "/delete-shop-product/:id",
    isSeller,
    catchAsyncErrors(async (req, res, next) => {
        try {
            const product = await Product.findById(req.params.id);

            if (!product) {
                return next(
                    new ErrorHandler("Product is not found with this id", 404)
                );
            }

            for (let i = 0; 1 < product.images.length; i++) {
                const result = await cloudinary.v2.uploader.destroy(
                    product.images[i].public_id
                );
            }

            await product.remove();

            res.status(201).json({
                success: true,
                message: "Product Deleted successfully!",
            });
        } catch (error) {
            return next(new ErrorHandler(error, 400));
        }
    })
);

// get all products
router.get(
    "/get-all-products",
    catchAsyncErrors(async (req, res, next) => {
        try {
            const currentDate = new Date();

            // Fetch products with associated shop information
            const products = await Product.find()
                .populate("shop")
                .sort({ createdAt: -1 });

            // Filter products whose associated shop's expiration date is in the future
            const filteredProducts = products.filter((product) => {
                const expirationDate = new Date(product.shop.expirationDate);
                return expirationDate >= currentDate;
            });

            res.status(200).json({
                success: true,
                products: filteredProducts,
            });
        } catch (error) {
            return next(new ErrorHandler(error, 400));
        }
    })
);

// review for a product
router.put(
    "/create-new-review",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        try {
            const { user, rating, comment, productId, orderId } = req.body;

            const product = await Product.findById(productId);

            const review = {
                user,
                rating,
                comment,
                productId,
            };

            const isReviewed = product.reviews.find(
                (rev) => rev.user._id === req.user._id
            );

            if (isReviewed) {
                product.reviews.forEach((rev) => {
                    if (rev.user._id === req.user._id) {
                        (rev.rating = rating),
                            (rev.comment = comment),
                            (rev.user = user);
                    }
                });
            } else {
                product.reviews.push(review);
            }

            let avg = 0;

            product.reviews.forEach((rev) => {
                avg += rev.rating;
            });

            product.ratings = avg / product.reviews.length;

            await product.save({ validateBeforeSave: false });

            await Order.findByIdAndUpdate(
                orderId,
                { $set: { "cart.$[elem].isReviewed": true } },
                { arrayFilters: [{ "elem._id": productId }], new: true }
            );

            res.status(200).json({
                success: true,
                message: "Reviwed succesfully!",
            });
        } catch (error) {
            return next(new ErrorHandler(error, 400));
        }
    })
);

// all products --- for admin
router.get(
    "/admin-all-products",
    isAuthenticated,
    isAdmin("Admin", "SuperAdmin"),

    catchAsyncErrors(async (req, res, next) => {
        try {
            const products = await Product.find().sort({
                createdAt: -1,
            });
            res.status(201).json({
                success: true,
                products,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    })
);
module.exports = router;
