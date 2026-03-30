const { mongoose } = require('../config/db');

const siteManagerSchema = new mongoose.Schema({
  mgr_id: { type: String, required: true, unique: true },
  org_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  token: { type: String },
  role: { type: String, default: 'site_manager' }
}, { timestamps: true });

module.exports = mongoose.models.SiteManager || mongoose.model('SiteManager', siteManagerSchema);
