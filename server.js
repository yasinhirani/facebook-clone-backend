require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const uuid = require("uuid");
const postModel = require("./model/post.model");
const Auth = require("./model/auth.model");
const generateAccessToken = require("./token/generateAccessToken");

const app = express();
const port = 8080 || process.env.PORT;

app.use(cors());
app.use(express.json());

const connectDb = async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
};

connectDb().then(() => {
  console.log("connected");
});

const validateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Your are unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, data) => {
    if (err) {
      return res.status(403).send({ message: err });
    }
    req.user = data;
    next();
  });
};

/**
 * Auth Apis
 */

app.post("/api/register", async (req, res) => {
  const { userName, email, password } = req.body;
  const hashPassword = await bcrypt.hash(password, 10).then((hash) => hash);
  const authRegister = new Auth({
    userId: uuid.v4(),
    userName: userName,
    email: email,
    password: hashPassword,
  });
  authRegister
    .save()
    .then(() => {
      res.json({
        success: true,
        message: "Register Successfully, Please login to continue",
      });
    })
    .catch((err) => {
      if (err.code === 11000) {
        res.send({ success: false, message: "Email address already exists" });
      } else {
        res.send({
          success: false,
          message:
            "There was a issue while registering you, please try after some time",
        });
      }
    });
});

app.post("/api/login", async (req, res) => {
  connectDb();
  const user = Auth;
  const isAvailable = await user.find({ email: req.body.email });
  if (isAvailable.length > 0) {
    const match = await bcrypt.compare(
      req.body.password,
      isAvailable[0].password
    );
    if (match) {
      res.status(200).send({
        success: true,
        message: "Login successful",
        authData: {
          email: isAvailable[0].email,
          userName: isAvailable[0].userName,
          access_token: generateAccessToken(
            req.body.email,
            isAvailable[0].userId
          ),
          userId: isAvailable[0].userId,
          avatarURL: isAvailable[0].avatarURL,
          avatarName: isAvailable[0].avatarName,
        },
      });
    } else {
      res.status(200).send({ success: false, message: "Invalid Credentials" });
    }
  } else {
    res.status(200).send({ success: false, message: "User not found" });
  }
});

app.post("/api/createPost", validateToken, async (req, res) => {
  const newPost = new postModel({
    userId: req.user.userId,
    ...req.body,
  });
  await newPost
    .save()
    .then(() => {
      res.send("Posted");
    })
    .catch((err) => {
      console.log(err);
    });
});

app.get("/api/getPosts", validateToken, async (req, res) => {
  const user = await Auth.find({ userId: req.user.userId });
  if (user.length > 0) {
    const friendsPosts = [];
    await Promise.all(
      user[0].following.map(async (foll) => {
        const posts = await postModel.find({ userId: foll }).exec();
        friendsPosts.push(...posts);
      })
    );
    await postModel
      .find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .exec()
      .then((data) => {
        const postList = [...data, ...friendsPosts];
        res.send(
          postList.sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
          })
        );
      });
  }
});

app.get("/api/getPeople", validateToken, async (req, res) => {
  const user = await Auth.find({}).exec();
  const filteredUsers = user.filter((user) => user.userId !== req.user.userId);
  const requiredData = filteredUsers.map((user) => {
    return {
      userId: user.userId,
      userName: user.userName,
      email: user.email,
      avatarURL: user.avatarURL,
      followers: user.followers,
    };
  });
  res.send(requiredData);
});

app.put("/api/likePost", validateToken, async (req, res) => {
  const post = await postModel.find({ postId: req.body.postId });
  if (post.length > 0) {
    const alreadyLiked = post[0].likedBy.includes(req.body.userId);
    if (alreadyLiked) {
      await postModel
        .updateOne(
          { postId: req.body.postId },
          {
            $pull: {
              likedBy: req.body.userId,
            },
          }
        )
        .then(() => {
          res.send(post);
        });
    } else {
      const newLike = await postModel.updateOne(
        { postId: req.body.postId },
        {
          $push: {
            likedBy: req.body.userId,
          },
        }
      );
      if (newLike.acknowledged) {
        res.send(post);
      } else {
        res.send("error occurred");
      }
    }
  } else {
    res.send("post not found");
  }
});

app.post("/api/profileDetails", validateToken, async (req, res) => {
  let user = null;
  if (req.body.userId) {
    user = await Auth.findOne({ userId: req.body.userId });
  } else {
    user = await Auth.findOne({ userId: req.user.userId });
  }
  res.json({
    success: true,
    data: {
      userId: user.userId,
      userName: user.userName,
      email: user.email,
      avatarURL: user.avatarURL,
      avatarName: user.avatarName,
      coverImage: user.coverImage,
      followers: user.followers,
      following: user.following,
      relationshipStatus: user.relationshipStatus,
    },
  });
});

app.post("/api/updateProfileData", validateToken, async (req, res) => {
  await Auth.findOneAndUpdate(
    { userId: req.user.userId },
    {
      userName: req.body.userName,
      email: req.body.email,
      relationshipStatus: req.body.relationshipStatus,
      avatarURL: req.body.avatarURL,
      avatarName: req.body.avatarName,
    }
  )
    .then(() => {
      res.send({ success: true, message: "Profile Updated SuccessFully" });
    })
    .catch((err) => {
      res.send({ success: false, message: err.message });
    });
});

app.post("/api/profileTimeline", validateToken, async (req, res) => {
  await postModel
    .find({ userId: req.body.userId })
    .sort({ createdAt: -1 })
    .exec()
    .then((data) => {
      res.send({ success: true, data: data });
    })
    .catch((err) => {
      res.send({ success: false, message: err.message });
    });
});

app.put("/api/follow", validateToken, async (req, res) => {
  const currentUser = await Auth.find({ userId: req.user.userId });
  const toFollowUser = await Auth.find({ userId: req.body.userId });
  if (currentUser.length > 0 && toFollowUser.length > 0) {
    const alreadyFollowed = currentUser[0].following.includes(req.body.userId);
    if (alreadyFollowed) {
      try {
        await Auth.updateOne(
          { userId: req.user.userId },
          {
            $pull: {
              following: req.body.userId,
            },
          }
        );
        await Auth.updateOne(
          { userId: req.body.userId },
          {
            $pull: {
              followers: req.user.userId,
            },
          }
        );
        res.send({ success: true, message: "unFollowed" });
      } catch (error) {
        res.send(error);
      }
    } else {
      try {
        const newFollowing = await Auth.updateOne(
          { userId: req.user.userId },
          {
            $push: {
              following: req.body.userId,
            },
          }
        );
        const newFollower = await Auth.updateOne(
          { userId: req.body.userId },
          {
            $push: {
              followers: req.user.userId,
            },
          }
        );
        if (newFollowing.acknowledged && newFollower.acknowledged) {
          res.send({ success: true, message: "Followed Successfully" });
        } else {
          res.send({ success: false, message: "Error Occurred" });
        }
      } catch (error) {
        res.send(error);
      }
    }
  } else {
    res.send("post not found");
  }
});

app.post("/api/deletePost", validateToken, async (req, res) => {
  if (req.user.userId === req.body.userId) {
    try {
      const deletePost = await postModel.deleteOne({ postId: req.body.postId });
      if (deletePost.acknowledged) {
        res.send({ success: true, message: "Deleted" });
      } else {
        res.send({ success: false, message: "Something went wrong..." });
      }
    } catch (err) {
      res.send({ success: false, message: err });
    }
  } else {
    res.send({ success: false, message: "You can delete only your post" });
  }
});

app.listen(port);
