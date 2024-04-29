const express = require("express");
const ErrorHandler = require("../middleware/error");
const app = express();
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");
const connectDatabase = require("../db/Database");
const cloudinary = require("cloudinary");

// Handling uncaught Exception
process.on("uncaughtException", (err) => {
    console.log(`Error: ${err.message}`);
    console.log(`shutting down the server for handling uncaught exception`);
});

// config
if (process.env.NODE_ENV !== "PRODUCTION") {
    require("dotenv").config({
        path: "config/.env",
    });
}

// connect db
connectDatabase();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

//  eshop-tutorial-pyri.vercel.app
app.use(
    cors({
        origin: "*",
        credentials: true, // if needed
    })
);
app.use(express.json());
app.use(cookieParser());
app.use("/test", (req, res) => {
    res.send("Hello world!");
});

app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// import routes
const user = require("../controller/user");
const shop = require("../controller/shop");
const product = require("../controller/product");
const event = require("../controller/event");
const coupon = require("../controller/coupounCode");
const payment = require("../controller/payment");
const order = require("../controller/order");
const conversation = require("../controller/conversation");
const message = require("../controller/message");
const withdraw = require("../controller/withdraw");

app.use("/api/v2/user", user);
app.use("/api/v2/conversation", conversation);
app.use("/api/v2/message", message);
app.use("/api/v2/order", order);
app.use("/api/v2/shop", shop);
app.use("/api/v2/product", product);
app.use("/api/v2/event", event);
app.use("/api/v2/coupon", coupon);
app.use("/api/v2/payment", payment);
app.use("/api/v2/withdraw", withdraw);

app.get("/", (req, res) => {
    res.json({ message: "server is working" });
});
// it's for ErrorHandling
app.use(ErrorHandler);

// create server
const server = app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});

// unhandled promise rejection
process.on("unhandledRejection", (err) => {
    console.log(`Shutting down the server for ${err.message}`);
    console.log(`shutting down the server for unhandle promise rejection`);

    server.close(() => {
        process.exit(1);
    });
});

module.exports = app;
