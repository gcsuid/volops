const express = require('express');
const router = express.Router();
const { Drive, Volunteer, Registration } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

router.get('/', async (req, res) => {
  try {
    const drives = await Drive.find({});
    return successResponse(res, drives.map(d => ({
      id: d._id || d.id,
      name: d.name,
      location: d.location,
      status: d.status,
      date: d.date
    })));
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const drive = await Drive.findById(req.params.id);

    if (!drive) {
      return errorResponse(res, 'Drive not found', 404);
    }

    return successResponse(res, {
      id: drive._id || drive.id,
      name: drive.name,
      location: drive.location,
      status: drive.status
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.get('/:id/join', async (req, res) => {
  try {
    const { secret } = req.query;

    const drive = await Drive.findOne({ qr_secret: secret });

    if (!drive) {
      return errorResponse(res, 'Invalid or expired QR code', 404);
    }

    const id = drive._id || drive.id;
    if (id.toString() !== req.params.id.toString()) {
      return errorResponse(res, 'Invalid or expired QR code', 404);
    }

    if (drive.status !== 'active') {
      return errorResponse(res, 'Drive is not active');
    }

    return successResponse(res, {
      id,
      name: drive.name,
      location: drive.location,
      status: drive.status
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

router.post('/:id/register', async (req, res) => {
  try {
    const { secret, vol_id } = req.body;

    const drive = await Drive.findOne({ qr_secret: secret });

    if (!drive) {
      return errorResponse(res, 'Invalid QR code', 404);
    }

    if (drive.status !== 'active') {
      return errorResponse(res, 'Drive is not active');
    }

    const volunteer = await Volunteer.findOne({ vol_id });
    if (!volunteer) {
      return errorResponse(res, 'Volunteer not found', 404);
    }

    const existing = await Registration.findOne({
      drive_id: drive._id || drive.id,
      vol_id
    });

    if (existing) {
      return errorResponse(res, 'Already registered for this drive');
    }

    await Registration.create({
      drive_id: drive._id || drive.id,
      volunteer_id: volunteer._id || volunteer.id,
      org_id: drive.org_id,
      vol_id: volunteer.vol_id,
      name: volunteer.name,
      email: volunteer.email
    });

    return successResponse(res, { success: true });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
