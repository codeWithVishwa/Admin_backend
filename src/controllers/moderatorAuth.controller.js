const Moderator = require('../models/moderator.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// -----------------------------------
// Generate Access + Refresh tokens
// -----------------------------------
function generateAccessToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
}

// -----------------------------------
// Moderator Login
// -----------------------------------
exports.moderatorLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  const moderator = await Moderator.findOne({ email });
  if (!moderator)
    return res.status(401).json({ error: "Moderator not found" });

  if (moderator.status === 'banned') {
    return res.status(403).json({
      error: "Your moderator account has been banned. Contact admin."
    });
  }

  const valid = await bcrypt.compare(password, moderator.password);
  if (!valid)
    return res.status(401).json({ error: "Invalid password" });

  // Generate tokens
  const accessToken = generateAccessToken(moderator);
  const refreshToken = generateRefreshToken(moderator);

  // Save refresh token
  moderator.refreshTokens.push(refreshToken);
  await moderator.save();

  // Send refresh token as httpOnly cookie
  res.cookie("moderator_refresh", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return res.json({
    accessToken,
    moderator: {
      _id: moderator._id,
      name: moderator.name,
      email: moderator.email,
      role: moderator.role,
    },
  });
};

// -----------------------------------
// Refresh Access Token
// -----------------------------------
exports.refreshAccessToken = async (req, res) => {
  const refreshToken = req.cookies.moderator_refresh;

  if (!refreshToken)
    return res.status(401).json({ error: "No refresh token" });

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const moderator = await Moderator.findById(decoded.id);

    if (!moderator)
      return res.status(401).json({ error: "Moderator not found" });

    // 🚫 Block banned moderators
    if (moderator.status === 'banned') {
      return res.status(403).json({
        error: "Your moderator account has been banned."
      });
    }

    // 🔥 Kill-switch check
    if (!moderator.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ error: "Session expired 😭" });
    }

    const newAccessToken = generateAccessToken(moderator);
    return res.json({ accessToken: newAccessToken });

  } catch (err) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
};


// -----------------------------------
// Moderator Logout
// -----------------------------------
exports.moderatorLogout = async (req, res) => {
  const refreshToken = req.cookies.moderator_refresh;

  if (refreshToken) {
    const decoded = jwt.decode(refreshToken);
    if (decoded && decoded.id) {
      const moderator = await Moderator.findById(decoded.id);
      if (moderator) {
        // Remove this refresh token only
        moderator.refreshTokens = moderator.refreshTokens.filter(
          (token) => token !== refreshToken
        );
        await moderator.save();
      }
    }
  }

  res.clearCookie("moderator_refresh");
  return res.json({ success: true, message: "Moderator logged out" });
};

// -----------------------------------
// Middleware: Verify Access Token
// -----------------------------------
exports.verifyModeratorToken = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ error: "No access token provided" });

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    if (decoded.role !== "moderator")
      return res.status(403).json({ error: "Moderator access required" });

    req.user = decoded;
    next();

  } catch (err) {
    return res.status(401).json({ error: "Access token expired" });
  }
};
