// scripts/createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../src/models/admin.model');
const bcrypt = require('bcryptjs');
MONGO_URI=process.env.MONGO_URI
async function createAdmin() {
  console.log(MONGO_URI)
  await mongoose.connect(MONGO_URI);
  
  const hashedPassword = await bcrypt.hash('VishwaAdmin00', 10);
  await Admin.create({
    name: 'Vishwa',
    email: 'VishwaAdmin80@flowsnap.tech',
    password: hashedPassword,
    role: 'admin'
  });
  console.log('Admin created successfully❤️');
  process.exit();
}

createAdmin();