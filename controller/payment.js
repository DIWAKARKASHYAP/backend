const express = require("express");
const router = express.Router();
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const Razorpay = require("razorpay");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const razorpay = new Razorpay({
    key_id: "rzp_test_JPBKvtfFBllt9C", // Replace with your Razorpay key id
    key_secret: "atQzPRO0UhK5iTXxLBs78tMc", // Replace with your Razorpay key secret
});

router.post(
    "/razorpay-process",
    catchAsyncErrors(async (req, res, next) => {
        // console.log("-----------------------------------------");
        // console.log("razorpay-process is working");
        // console.log("-----------------------------------------");
        const { amount } = req.body;
        try {
            const options = {
                amount: amount * 100, // amount in paise
                currency: "INR",
                receipt: "order_rcptid_11", // Replace with your receipt ID
            };

            const order = await razorpay.orders.create(options);
            // console.log("dejhvfjehyw", order);
            res.status(200).json({ order });
        } catch (error) {
            // console.error("Error creating order:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    })
);
router.post(
    "/process",
    catchAsyncErrors(async (req, res, next) => {
        const myPayment = await stripe.paymentIntents.create({
            amount: req.body.amount,
            currency: "inr",
            metadata: {
                company: "Becodemy",
            },
        });
        res.status(200).json({
            success: true,
            client_secret: myPayment.client_secret,
        });
    })
);

router.get(
    "/stripeapikey",
    catchAsyncErrors(async (req, res, next) => {
        res.status(200).json({
            stripeApikey:
                "pk_test_51OMPNBSHA6kZM5pL3H3l6VbsgaTVGjRbbMrcROh5h0AEP9g8KW8Ritv45SJZ1mKCyvnVEQk69BHlVyF4UpFGHAnS00ANakFmLv",
        });
    })
);

module.exports = router;
