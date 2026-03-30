const { mongoose } = require('../config/db');

const siteManagerSchema = new mongoose.Schema({
  mgr_id: { type: String, required: true, unique: true },
  org_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, default: '' },
  token: { type: String },
  role: { type: String, default: 'site_manager' }
}, { timestamps: true });

siteManagerSchema.index({ email: 1, org_id: 1 }, { unique: true });

module.exports = mongoose.models.SiteManager || mongoose.model('SiteManager', siteManagerSchema);
