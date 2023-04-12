const jwt = require("jsonwebtoken");

const generateAccessToken = (email, userId) => {
  const token = jwt.sign(
    { email: email, userId },
    process.env.ACCESS_TOKEN_SECRET
  );
  return token;
};
module.exports = generateAccessToken;
