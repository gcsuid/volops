const express = require('express');
const router = express.Router();
const { Organization, SiteManager, Drive, Registration } = require('../models');
const { generateId, generateToken, generateQrSecret, generatePassword } = require('../utils/generators');
const { successResponse, errorResponse } = require('../utils/helpers');
const { managerAuth } = require('../middleware/auth');

router.post('/signup', async (req, res) => {
  try {
    const { name, email, org_id, password } = req.body;

    if (!name || !email || !org_id) {
      return errorResponse(res, 'All fields required');
    }

    const org = await Organization.findOne({ org_id });
    if (!org) {
      return errorResponse(res, 'Invalid Organisation ID');
    }

    const existing = await SiteManager.findOne({ email, org_id: org._id || org.id });
    if (existing) {
      return errorResponse(res, 'Email already registered with this organisation');
    }

    const mgrId = generateId('MGR');
    const pwd = password || generatePassword();
    const token = generateToken();

    const manager = await SiteManager.create({
      mgr_id: mgrId,
      org_id: org._id || org.id,
      name,
      email,
      password: pwd,
      token
    });

    return successResponse(res, {
      mgr_id: manager.mgr_id,
      token: manager.token,
      name: manager.name,
      org_name: org.name
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, org_id } = req.body;

    if (!email || !org_id) {
      return errorResponse(res, 'Email and Organisation ID required');
    }

    const org = await Organization.findOne({ org_id });
    if (!org) {
      return errorResponse(res, 'Invalid Organisation ID', 401);
    }

    const manager = await SiteManager.findOne({ email, org_id: org._id || org.id });
    if (!manager) {
      return errorResponse(res, 'Account not found', 401);
    }

    const newToken = generateToken();
    await SiteManager.findOneAndUpdate({ _id: manager._id }, { token: newToken });

    return successResponse(res, {
      token: newToken,
      mgr_id: manager.mgr_id,
      name: manager.name,
      email: manager.email
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/me', managerAuth, async (req, res) => {
  try {
    const org = await Organization.findById(req.user.org_id?._id || req.user.org_id).lean();
    return successResponse(res, {
      mgr_id: req.user.mgr_id,
      name: req.user.name,
      email: req.user.email,
      org: org ? { id: org._id, name: org.name } : null
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/drives', managerAuth, async (req, res) => {
  try {
    const managerId = req.user._id || req.user.id;
    const drives = await Drive.find({ manager_id: managerId }).lean();

    const drivesWithStats = await Promise.all(drives.map(async (d) => {
      const registrations = await Registration.find({ drive_id: d._id }).lean();
      const checkedIn = registrations.filter(r => r.checked_in_at).length;
      const checkedOut = registrations.filter(r => r.checked_out_at).length;
      const durations = registrations.filter(r => r.duration_minutes).map(r => r.duration_minutes);
      const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

      return {
        id: d._id,
        name: d.name,
        location: d.location,
        status: d.status,
        created_at: d.createdAt,
        started_at: d.started_at,
        ended_at: d.ended_at,
        total_volunteers: registrations.length,
        checked_in: checkedIn,
        checked_out: checkedOut,
        avg_duration_minutes: avgDuration
      };
    }));

    return successResponse(res, drivesWithStats);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/drives', managerAuth, async (req, res) => {
  try {
    const { name, location, description, date } = req.body;

    if (!name) {
      return errorResponse(res, 'Drive name required');
    }

    const orgId = req.user.org_id?._id || req.user.org_id;
    const managerId = req.user._id || req.user.id;

    const drive = await Drive.create({
      org_id: orgId,
      manager_id: managerId,
      manager_name: req.user.name,
      name,
      location: location || '',
      description: description || '',
      date: date || new Date(),
      status: 'draft'
    });

    return successResponse(res, {
      id: drive._id,
      name: drive.name,
      location: drive.location,
      status: drive.status
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/drives/:id/start', managerAuth, async (req, res) => {
  try {
    const drive = await Drive.findOne({ _id: req.params.id });

    if (!drive) {
      return errorResponse(res, 'Drive not found', 404);
    }

    const managerId = req.user._id || req.user.id;
    const driveManagerId = drive.manager_id?._id || drive.manager_id;

    if (driveManagerId.toString() !== managerId.toString()) {
      return errorResponse(res, 'Drive not found', 404);
    }

    if (drive.status !== 'draft') {
      return errorResponse(res, 'Drive already started');
    }

    drive.status = 'active';
    drive.qr_secret = generateQrSecret();
    drive.started_at = new Date();
    await drive.save();

    return successResponse(res, {
      id: drive._id,
      name: drive.name,
      status: drive.status,
      qr_secret: drive.qr_secret
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/drives/:id/end', managerAuth, async (req, res) => {
  try {
    const drive = await Drive.findOne({ _id: req.params.id });

    if (!drive) {
      return errorResponse(res, 'Drive not found', 404);
    }

    const managerId = req.user._id || req.user.id;
    const driveManagerId = drive.manager_id?._id || drive.manager_id;

    if (driveManagerId.toString() !== managerId.toString()) {
      return errorResponse(res, 'Drive not found', 404);
    }

    if (drive.status !== 'active') {
      return errorResponse(res, 'Drive not active');
    }

    const endTime = new Date();

    const uncheckedOut = await Registration.find({
      drive_id: drive._id,
      checked_in_at: { $ne: null },
      checked_out_at: null
    });

    for (const reg of uncheckedOut) {
      const durationMs = endTime - new Date(reg.checked_in_at);
      const durationMinutes = Math.round(durationMs / 60000);
      reg.checked_out_at = endTime;
      reg.duration_minutes = durationMinutes;
      await reg.save();
    }

    drive.status = 'ended';
    drive.ended_at = endTime;
    await drive.save();

    return successResponse(res, {
      id: drive._id,
      name: drive.name,
      status: drive.status,
      auto_checked_out: uncheckedOut.length
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/drives/:id/volunteers', managerAuth, async (req, res) => {
  try {
    const drive = await Drive.findOne({ _id: req.params.id });

    if (!drive) {
      return errorResponse(res, 'Drive not found', 404);
    }

    const managerId = req.user._id || req.user.id;
    const driveManagerId = drive.manager_id?._id || drive.manager_id;

    if (driveManagerId.toString() !== managerId.toString()) {
      return errorResponse(res, 'Drive not found', 404);
    }

    const volunteers = await Registration.find({ drive_id: drive._id }).lean();

    return successResponse(res, volunteers.map(v => ({
      id: v._id,
      vol_id: v.vol_id,
      name: v.name,
      email: v.email,
      checked_in_at: v.checked_in_at,
      checked_out_at: v.checked_out_at,
      duration_minutes: v.duration_minutes
    })));
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
