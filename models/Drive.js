const { mongoose } = require('../config/db');

const driveSchema = new mongoose.Schema({
  org_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteManager', required: true },
  manager_name: { type: String, required: true },
  name: { type: String, required: true },
  location: { type: String, default: '' },
  description: { type: String, default: '' },
  date: { type: Date },
  status: { type: String, enum: ['draft', 'active', 'ended'], default: 'draft' },
  qr_secret: { type: String },
  started_at: { type: Date },
  ended_at: { type: Date }
}, { timestamps: true });

driveSchema.index({ org_id: 1 });
driveSchema.index({ manager_id: 1 });
driveSchema.index({ status: 1 });

module.exports = mongoose.models.Drive || mongoose.model('Drive', driveSchema);
