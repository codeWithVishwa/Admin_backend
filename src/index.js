require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const connectDB = require('./utils/db');
const adminRoutes = require('./routes/admin.routes');
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors({
  origin: "https://admin-dashboard-3vip.onrender.com/",
  credentials: true,
}));



app.use(express.json());
app.use(cookieParser());

// Middleware to set req.user from admin_token cookie if present
app.use((req, res, next) => {
  const token = req.cookies && req.cookies.admin_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
});


app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.send('Admin Backend Running');
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}🏃`);
  });
});
