// controllers/adminAuth.controller.js
const Admin = require("../models/admin.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// =====================
// Admin login
// =====================
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const admin = await Admin.findOne({ email, role: { $in: ["admin", "superadmin"] } });
  if (!admin) {
    return res.status(401).json({ error: "Admin not found" });
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = jwt.sign(
    {
      _id: admin._id,
      role: admin.role,
      name: admin.name,
      email: admin.email,   // ✅ important
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.cookie("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({
    user: {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  });
};

// =====================
// Cookie-based middleware (recommended)
// =====================
// Use this in routes: router.use(adminAuth)
exports.adminAuth = async (req, res, next) => {
  try {
    console.log('Cookies received:', req.cookies);
    const token = req.cookies?.admin_token;
    if (!token) {
      console.log('No admin_token cookie found');
      return res.status(401).json({ error: "Not authenticated" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded now has _id, name, email, role
    req.user = {
      _id: decoded._id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
    };

    if (!['admin', 'superadmin'].includes(req.user.role)) {
      console.log('User is not admin:', req.user);
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (err) {
    console.error("adminAuth error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// =====================
// (Optional) Bearer-token middleware
// =====================
// Only use this if you pass Authorization: Bearer <token> from frontend.
exports.verifyAdminToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!['admin', 'superadmin'].includes(decoded.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // ✅ ensure email is present in req.user
    req.user = {
      _id: decoded._id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
