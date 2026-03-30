const express = require('express');
const router = express.Router();
const { Organization, Drive, Registration } = require('../models');
const { generateId, generateToken, generateOrgCode } = require('../utils/generators');
const { successResponse, errorResponse } = require('../utils/helpers');
const { orgAuth } = require('../middleware/auth');

router.post('/signup', async (req, res) => {
  try {
    const { name, email, location } = req.body;

    if (!name || !email || !location) {
      return errorResponse(res, 'All fields are required');
    }

    const existing = await Organization.findOne({ email });
    if (existing) {
      return errorResponse(res, 'Email already registered');
    }

    const orgId = generateId('ORG');
    const orgCode = generateOrgCode();
    const token = generateToken();

    const org = await Organization.create({
      org_id: orgId,
      org_code: orgCode,
      name,
      email,
      location,
      token
    });

    return successResponse(res, {
      org_id: org.org_id,
      org_code: org.org_code,
      token: org.token,
      name: org.name
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/login', async (req, res) => {
  try {
    const { org_id, org_code } = req.body;

    if (!org_id || !org_code) {
      return errorResponse(res, 'Org ID and code required');
    }

    const org = await Organization.findOne({ org_id, org_code });
    if (!org) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const newToken = generateToken();
    await Organization.findOneAndUpdate({ org_id }, { token: newToken });

    return successResponse(res, {
      token: newToken,
      org_id: org.org_id,
      name: org.name
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/drives', orgAuth, async (req, res) => {
  try {
    const allDrives = await Drive.find();
    const orgId = req.user._id || req.user.id;

    const orgDrives = allDrives.filter(d => {
      const id = d.org_id?._id || d.org_id || d.id;
      return id.toString() === orgId.toString();
    });

    const drivesWithCount = await Promise.all(orgDrives.map(async (d) => {
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

router.get('/drives/:id', orgAuth, async (req, res) => {
  try {
    const drive = await Drive.findById(req.params.id);

    if (!drive) {
      return errorResponse(res, 'Drive not found', 404);
    }

    const id = drive._id || drive.id;
    const orgId = req.user._id || req.user.id;
    const driveOrgId = drive.org_id?._id || drive.org_id;

    if (driveOrgId.toString() !== orgId.toString()) {
      return errorResponse(res, 'Drive not found', 404);
    }

    return successResponse(res, {
      ...drive,
      id: id
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/drives/:id/attendees', orgAuth, async (req, res) => {
  try {
    const drive = await Drive.findById(req.params.id);

    if (!drive) {
      return errorResponse(res, 'Drive not found', 404);
    }

    const attendees = await Registration.find({ drive_id: req.params.id });

    return successResponse(res, attendees.map(a => ({
      ...a,
      id: a._id || a.id
    })));
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/drives/:id/download', orgAuth, async (req, res) => {
  try {
    const drive = await Drive.findById(req.params.id);

    if (!drive) {
      return errorResponse(res, 'Drive not found', 404);
    }

    const attendees = await Registration.find({ drive_id: req.params.id });

    let csv = 'Name,Email,Phone,Check-in Time\n';
    attendees.forEach(a => {
      csv += `"${a.name}","${a.email}","","${a.checked_in_at}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${drive.name.replace(/"/g, '')}_attendees.csv"`);
    return res.send(csv);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
