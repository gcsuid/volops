const express = require('express');
const router = express.Router();
const { Organization, SiteManager, Drive, Registration } = require('../models');
const { generateId, generateToken } = require('../utils/generators');
const { successResponse, errorResponse } = require('../utils/helpers');
const { orgAuth } = require('../middleware/auth');

router.post('/signup', async (req, res) => {
  try {
    const { name, email, location, phone, password } = req.body;

    if (!name || !email || !location) {
      return errorResponse(res, 'Name, email, and location are required');
    }

    const existing = await Organization.findOne({ email });
    if (existing) {
      return errorResponse(res, 'Email already registered');
    }

    const orgId = generateId('ORG');
    const token = generateToken();

    const org = await Organization.create({
      org_id: orgId,
      name,
      email,
      location,
      phone: phone || '',
      password: password || '',
      token
    });

    return successResponse(res, {
      org_id: org.org_id,
      token: org.token,
      name: org.name
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/login', async (req, res) => {
  try {
    const { org_id, email } = req.body;

    if (!org_id || !email) {
      return errorResponse(res, 'Org ID and email required');
    }

    const org = await Organization.findOne({ org_id, email });
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

router.get('/me', orgAuth, async (req, res) => {
  try {
    return successResponse(res, {
      org_id: req.user.org_id,
      name: req.user.name,
      email: req.user.email,
      location: req.user.location
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/managers', orgAuth, async (req, res) => {
  try {
    const orgDbId = req.user._id || req.user.id;
    const managers = await SiteManager.find({ org_id: orgDbId }).lean();

    return successResponse(res, managers.map(m => ({
      id: m._id,
      mgr_id: m.mgr_id,
      name: m.name,
      email: m.email,
      created_at: m.createdAt
    })));
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/stats', orgAuth, async (req, res) => {
  try {
    const orgDbId = req.user._id || req.user.id;
    const drives = await Drive.find({ org_id: orgDbId }).lean();
    const registrations = await Registration.find({ org_id: orgDbId }).lean();

    const totalDrives = drives.length;
    const activeDrives = drives.filter(d => d.status === 'active').length;
    const totalVolunteers = registrations.length;
    const checkedIn = registrations.filter(r => r.checked_in_at).length;
    const checkedOut = registrations.filter(r => r.checked_out_at).length;

    const durations = registrations.filter(r => r.duration_minutes).map(r => r.duration_minutes);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    const managerCounts = {};
    registrations.forEach(r => {
      const drive = drives.find(d => (d._id.toString() === r.drive_id.toString()));
      if (drive) {
        const mgrId = drive.manager_id?.toString() || drive.manager_name;
        managerCounts[mgrId] = (managerCounts[mgrId] || 0) + 1;
      }
    });

    return successResponse(res, {
      total_drives: totalDrives,
      active_drives: activeDrives,
      total_volunteers: totalVolunteers,
      checked_in: checkedIn,
      checked_out: checkedOut,
      avg_duration_minutes: avgDuration,
      top_manager: Object.entries(managerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/drives', orgAuth, async (req, res) => {
  try {
    const orgDbId = req.user._id || req.user.id;
    const drives = await Drive.find({ org_id: orgDbId }).lean();

    const drivesWithStats = await Promise.all(drives.map(async (d) => {
      const regs = await Registration.find({ drive_id: d._id }).lean();
      const checkedOut = regs.filter(r => r.checked_out_at).length;
      const durations = regs.filter(r => r.duration_minutes).map(r => r.duration_minutes);
      const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

      return {
        id: d._id,
        name: d.name,
        location: d.location,
        status: d.status,
        manager_name: d.manager_name,
        created_at: d.createdAt,
        started_at: d.started_at,
        ended_at: d.ended_at,
        total_volunteers: regs.length,
        checked_out: checkedOut,
        avg_duration_minutes: avgDuration
      };
    }));

    return successResponse(res, drivesWithStats);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/drives/:id/volunteers', orgAuth, async (req, res) => {
  try {
    const drive = await Drive.findById(req.params.id);

    if (!drive) {
      return errorResponse(res, 'Drive not found', 404);
    }

    const orgDbId = req.user._id || req.user.id;
    if ((drive.org_id?.toString() || drive.org_id) !== orgDbId.toString()) {
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

router.get('/download', orgAuth, async (req, res) => {
  try {
    const orgDbId = req.user._id || req.user.id;
    const drives = await Drive.find({ org_id: orgDbId }).lean();
    const registrations = await Registration.find({ org_id: orgDbId }).lean();

    let csv = 'Event Name,Event Date,Volunteer Name,Volunteer Email,Check-In Time,Check-Out Time,Duration (minutes)\n';

    for (const drive of drives) {
      const driveRegs = registrations.filter(r => r.drive_id?.toString() === drive._id.toString());
      for (const reg of driveRegs) {
        const checkIn = reg.checked_in_at ? new Date(reg.checked_in_at).toLocaleString() : '';
        const checkOut = reg.checked_out_at ? new Date(reg.checked_out_at).toLocaleString() : '';
        csv += `"${drive.name}","${drive.createdAt?.toLocaleDateString() || ''}","${reg.name}","${reg.email}","${checkIn}","${checkOut}","${reg.duration_minutes || ''}"\n`;
      }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="volops_export.csv"');
    return res.send(csv);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
