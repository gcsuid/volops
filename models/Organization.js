const { mongoose } = require('../config/db');

const organizationSchema = new mongoose.Schema({
  org_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  location: { type: String, required: true },
  token: { type: String },
  role: { type: String, default: 'organization' }
}, { timestamps: true });

module.exports = mongoose.models.Organization || mongoose.model('Organization', organizationSchema);
