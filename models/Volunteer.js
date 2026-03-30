const { mongoose } = require('../config/db');

const volunteerSchema = new mongoose.Schema({
  vol_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  password: { type: String, required: true },
  token: { type: String },
  role: { type: String, default: 'volunteer' }
}, { timestamps: true });

module.exports = mongoose.models.Volunteer || mongoose.model('Volunteer', volunteerSchema);
