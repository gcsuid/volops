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
      name: volunteer.name
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/login', async (req, res) => {
  try {
    const { vol_id, password } = req.body;

    if (!vol_id || !password) {
      return errorResponse(res, 'ID and password required');
    }

    const volunteer = await Volunteer.findOne({ vol_id, password });
    if (!volunteer) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const newToken = generateToken();
    await Volunteer.findOneAndUpdate({ vol_id }, { token: newToken });

    return successResponse(res, {
      token: newToken,
      vol_id: volunteer.vol_id,
      name: volunteer.name
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/drives', volunteerAuth, async (req, res) => {
  try {
    const myRegs = await Registration.find({ vol_id: req.user.vol_id });
    const driveIds = myRegs.map(r => r.drive_id || r._id);

    const drives = await Drive.find();

    const filteredDrives = drives.filter(d => {
      const id = d._id || d.id;
      return driveIds.includes(id);
    });

    const drivesWithRegDate = filteredDrives.map(d => {
      const id = d._id || d.id;
      const reg = myRegs.find(r => (r.drive_id || r._id).toString() === id.toString());
      return {
        ...d,
        id: id,
        registered_at: reg?.checked_in_at || reg?.createdAt
      };
    });

    return successResponse(res, drivesWithRegDate);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
