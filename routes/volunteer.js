const express = require('express');
const router = express.Router();
const { Volunteer, Drive, Registration } = require('../models');
const { generateId, generateToken } = require('../utils/generators');
const { successResponse, errorResponse } = require('../utils/helpers');
const { volunteerAuth } = require('../middleware/auth');

router.post('/signup', async (req, res) => {
  try {
    const { name, email, age, gender, password } = req.body;

    if (!name || !email || !age || !gender || !password) {
      return errorResponse(res, 'All fields are required');
    }

    const existing = await Volunteer.findOne({ email });
    if (existing) {
      return errorResponse(res, 'Email already registered');
    }

    const volId = generateId('VOL');
    const token = generateToken();

    const volunteer = await Volunteer.create({
      vol_id: volId,
      name,
      email,
      age: Number(age),
      gender,
      password,
      token
    });

    return successResponse(res, {
      vol_id: volunteer.vol_id,
      token: volunteer.token,
      name: volunteer.name,
      email: volunteer.email
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, 'Email required');
    }

    const volunteer = await Volunteer.findOne({ email });
    if (!volunteer) {
      return errorResponse(res, 'Account not found. Please sign up first.', 401);
    }

    const newToken = generateToken();
    await Volunteer.findOneAndUpdate({ email }, { token: newToken });

    return successResponse(res, {
      token: newToken,
      vol_id: volunteer.vol_id,
      name: volunteer.name,
      email: volunteer.email
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/me', volunteerAuth, async (req, res) => {
  try {
    return successResponse(res, {
      vol_id: req.user.vol_id,
      name: req.user.name,
      email: req.user.email,
      age: req.user.age,
      gender: req.user.gender
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/drives', volunteerAuth, async (req, res) => {
  try {
    const myRegs = await Registration.find({ volunteer_id: req.user._id || req.user.id }).lean();
    const driveIds = myRegs.map(r => r.drive_id);

    const drives = await Drive.find({ _id: { $in: driveIds } }).lean();

    const drivesWithReg = drives.map(d => {
      const reg = myRegs.find(r => (r.drive_id._id || r.drive_id).toString() === d._id.toString());
      return {
        id: d._id,
        name: d.name,
        location: d.location,
        status: d.status,
        checked_in_at: reg?.checked_in_at,
        checked_out_at: reg?.checked_out_at,
        duration_minutes: reg?.duration_minutes
      };
    });

    return successResponse(res, drivesWithReg);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/checkin', volunteerAuth, async (req, res) => {
  try {
    const { drive_id } = req.body;

    if (!drive_id) {
      return errorResponse(res, 'Drive ID required');
    }

    const drive = await Drive.findById(drive_id);
    if (!drive) {
      return errorResponse(res, 'Drive not found', 404);
    }

    if (drive.status !== 'active') {
      return errorResponse(res, 'Drive is not active');
    }

    let registration = await Registration.findOne({
      volunteer_id: req.user._id || req.user.id,
      drive_id: drive._id
    });

    if (registration && registration.checked_in_at && !registration.checked_out_at) {
      return errorResponse(res, 'Already checked in');
    }

    const checkInTime = new Date();

    if (registration) {
      registration.checked_in_at = checkInTime;
      registration.checked_out_at = null;
      registration.duration_minutes = null;
      await registration.save();
    } else {
      registration = await Registration.create({
        drive_id: drive._id,
        volunteer_id: req.user._id || req.user.id,
        vol_id: req.user.vol_id,
        name: req.user.name,
        email: req.user.email,
        org_id: drive.org_id,
        checked_in_at: checkInTime
      });
    }

    return successResponse(res, {
      message: 'Checked in successfully',
      checked_in_at: registration.checked_in_at,
      drive_name: drive.name
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/checkout', volunteerAuth, async (req, res) => {
  try {
    const { drive_id } = req.body;

    if (!drive_id) {
      return errorResponse(res, 'Drive ID required');
    }

    const registration = await Registration.findOne({
      volunteer_id: req.user._id || req.user.id,
      drive_id
    });

    if (!registration) {
      return errorResponse(res, 'Not registered for this drive');
    }

    if (!registration.checked_in_at) {
      return errorResponse(res, 'Not checked in');
    }

    if (registration.checked_out_at) {
      return errorResponse(res, 'Already checked out');
    }

    const checkOutTime = new Date();
    const durationMs = checkOutTime - new Date(registration.checked_in_at);
    const durationMinutes = Math.round(durationMs / 60000);

    registration.checked_out_at = checkOutTime;
    registration.duration_minutes = durationMinutes;
    await registration.save();

    return successResponse(res, {
      message: 'Checked out successfully',
      checked_out_at: registration.checked_out_at,
      duration_minutes: durationMinutes
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/current', volunteerAuth, async (req, res) => {
  try {
    const activeReg = await Registration.findOne({
      volunteer_id: req.user._id || req.user.id,
      checked_in_at: { $ne: null },
      checked_out_at: null
    }).lean();

    if (!activeReg) {
      return successResponse(res, { active: false });
    }

    const drive = await Drive.findById(activeReg.drive_id).lean();

    return successResponse(res, {
      active: true,
      drive: {
        id: drive._id,
        name: drive.name,
        location: drive.location,
        status: drive.status
      },
      checked_in_at: activeReg.checked_in_at
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
