const { mongoose } = require('../config/db');

const registrationSchema = new mongoose.Schema({
  drive_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Drive', required: true },
  volunteer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer', required: true },
  org_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  vol_id: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  checked_in_at: { type: Date, default: Date.now },
  checked_out_at: { type: Date },
  duration_minutes: { type: Number }
}, { timestamps: true });

registrationSchema.index({ drive_id: 1 });
registrationSchema.index({ volunteer_id: 1 });
registrationSchema.index({ vol_id: 1 });
registrationSchema.index({ org_id: 1 });

module.exports = mongoose.models.Registration || mongoose.model('Registration', registrationSchema);
