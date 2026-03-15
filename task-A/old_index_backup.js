// ...existing code...
require('dotenv').config();
const express = require('express');
const app = express();

// ensure mongoose connection is initialized
require('./src/models/mongoose');

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');

app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/auth', authRoutes);
app.use('/users', userRoutes);


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
