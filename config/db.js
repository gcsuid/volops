const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.log('[db] No MONGODB_URI found – using local JSON file store.');
    return null;
  }

  try {
    await mongoose.connect(uri);
    console.log('[db] MongoDB connected successfully');
    return mongoose.connection;
  } catch (err) {
    console.error('[db] MongoDB connection error:', err.message);
    console.log('[db] Falling back to local JSON file store.');
    return null;
  }
};

const closeDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};

module.exports = { connectDB, closeDB, mongoose };
