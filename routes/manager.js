const express = require('express');
const router = express.Router();
const { Organization, SiteManager, Drive, Registration } = require('../models');
const { generateId, generateToken, generateQrSecret, generatePassword } = require('../utils/generators');
const { successResponse, errorResponse } = require('../utils/helpers');
const { managerAuth } = require('../middleware/auth');

router.post('/signup', async (req, res) => {
  try {
    const { name, email, org_id } = req.body;

    if (!name || !email || !org_id) {
      return errorResponse(res, 'All fields required');
    }

    const org = await Organization.findOne({ org_id });
    if (!org) {
      return errorResponse(res, 'Invalid Organisation ID');
    }

    const existing = await SiteManager.findOne({ email });
    if (existing) {
      return errorResponse(res, 'Email already registered');
    }

    const mgrId = generateId('MGR');
    const password = generatePassword();
    const token = generateToken();

    const orgId = org._id || org.id;

    const manager = await SiteManager.create({
      mgr_id: mgrId,
      org_id: orgId,
      name,
      email,
      password,
      token
    });

    return successResponse(res, {
      mgr_id: manager.mgr_id,
      password,
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
    const { mgr_id, password } = req.body;

    if (!mgr_id || !password) {
      return errorResponse(res, 'ID and password required');
    }

    const manager = await SiteManager.findOne({ mgr_id, password });
    if (!manager) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const newToken = generateToken();
    await SiteManager.findOneAndUpdate({ mgr_id }, { token: newToken });

    return successResponse(res, {
      token: newToken,
      mgr_id: manager.mgr_id,
      name: manager.name
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/drives', managerAuth, async (req, res) => {
  try {
    const allDrives = await Drive.find();
    const managerId = req.user._id || req.user.id;

    const managerDrives = allDrives.filter(d => {
      const id = d.manager_id?._id || d.manager_id;
      return id.toString() === managerId.toString();
    });

    const drivesWithCount = await Promise.all(managerDrives.map(async (d) => {
      const id = d._id || d.id;
      const count = await Registration.countDocuments({ drive_id: id });
      return {
        ...d,
        id: id,
        attendee_count: count
      };
    }));

    return successResponse(res, drivesWithCount);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/drives', managerAuth, async (req, res) => {
  try {
    const { name, location, description } = req.body;

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
      status: 'draft'
    });

    return successResponse(res, {
      ...drive,
      id: drive._id || drive.id
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

    if (drive.save) {
      await drive.save();
    } else {
      await Drive.findOneAndUpdate({ _id: req.params.id }, drive);
    }

    return successResponse(res, {
      ...drive.toObject ? drive.toObject() : drive,
      id: drive._id
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

    drive.status = 'ended';
    drive.ended_at = new Date();

    if (drive.save) {
      await drive.save();
    } else {
      await Drive.findOneAndUpdate({ _id: req.params.id }, drive);
    }

    return successResponse(res, {
      ...drive.toObject ? drive.toObject() : drive,
      id: drive._id
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
