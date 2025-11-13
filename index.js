// === Local Food Lovers Network Server
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { attachDatabasePool } = require('@vercel/functions');

// ------------------ Config ------------------
const app = express();
const port = process.env.PORT || 3000;

// Firebase Admin Initialization
const decoded = Buffer.from(
  process.env.FIREBASE_SERVICE_KEY,
  "base64"
).toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middlewares
app.use(cors());
app.use(express.json());

// ------------------ Firebase Token Verify Middleware ------------------
// const verifyFirebaseToken = async (req, res, next) => {
//   const authorization = req.headers.authorization;
//   if (!authorization) {
//     return res.status(401).send({ message: "unauthorized access" });
//   }

//   const token = authorization.split(" ")[1];
//   if (!token) {
//     return res.status(401).send({ message: "unauthorized access" });
//   }

//   try {
//     const decoded = await admin.auth().verifyIdToken(token);
//     req.token_email = decoded.email;
//     next();
//   } catch {
//     return res.status(401).send({ message: "unauthorized access" });
//   }
// };

// ------------------ MongoDB Setup ------------------
// console.log(process.env);
const options = {
  appName: 'devrel.vercel.integration',
  maxIdleTimeMS: 30000,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

const client = new MongoClient(process.env.MONGODB_URI, options);

attachDatabasePool(client);

// ------------------ Main Function ------------------
async function run() {
  try {
    await client.connect();
    const db = client.db("local_food_db");

    // Collections
    const reviewsCollection = db.collection("reviews");
    const usersCollection = db.collection("users");
    const favoritesCollection = db.collection("favorites");

    // ==== USER API
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const query = { email: newUser.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "User already exists" });
      }

      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    // ==== REVIEWS API (CRUD)

    // Create (Add Review)
    app.post("/reviews", async (req, res) => {
      const newReview = req.body;
      console.log(newReview);
      const result = await reviewsCollection.insertOne(newReview);
      res.send(result);
    });

    // Read (All Reviews — Public)
    app.get("/reviews", async (req, res) => {
      const search = req.query.search;
      const query = search
        ? { foodName: { $regex: search, $options: "i" } }
        : {};

      const reviews = await reviewsCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(reviews);
    });

    // Read (Featured Reviews - Public)
    app.get("/featured-reviews", async (req, res) => {
      const cursor = reviewsCollection.find().sort({ rating: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Read (Single Review — Details Page)
    app.get("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const review = await reviewsCollection.findOne(query);
      res.send(review);
    });

    // Read (My Reviews — Protected)
    app.get("/my-reviews", async (req, res) => {
      const email = req.query.email;
      // if (email !== req.token_email) {
      //   return res.status(403).send({ message: "forbidden" });
      // }

      const myReviews = await reviewsCollection
        .find({ email: email })
        .sort({ date: -1 })
        .toArray();
      res.send(myReviews);
    });

    // Update Review
    app.patch("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);

      const updateData = req.body;

      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          foodName: updateData.foodName,
          restaurantName: updateData.restaurantName,
          location: updateData.location,
          rating: updateData.rating,
          reviewText: updateData.reviewText,
          foodImage: updateData.foodImage,
        },
      };

      const result = await reviewsCollection.updateOne(query, update);
      res.send(result);
    });

    // Delete Review
    app.delete("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewsCollection.deleteOne(query);
      res.send(result);
    });

    // ==== FAVORITES API

    // Add to Favorites
    app.post("/favorites", async (req, res) => {
      const favorite = req.body;
      const result = await favoritesCollection.insertOne(favorite);
      res.send(result);
    });

    // Get My Favorites
    app.get("/favorites", async (req, res) => {
      const email = req.query.email;
      // if (email !== req.token_email) {
      //   return res.status(403).send({ message: "forbidden" });
      // }

      const favorites = await favoritesCollection
        .find({ email: email })
        .toArray();
      res.send(favorites);
    });

    // Delete from Favorites
    app.delete("/favorites/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await favoritesCollection.deleteOne(query);
      res.send(result);
    });

    // ===== MongoDB Connection Check
    // await client.db("admin").command({ ping: 1 });
    console.log("MongoDB Connected Successfully!");
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Local Food Lovers Network Server Running!");
});

// app.listen(port, () => {
//   console.log(`Smart server is running on port: ${port}`);
// });
module.exports = app;
