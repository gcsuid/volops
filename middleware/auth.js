const { Volunteer, Organization, SiteManager } = require('../models');
const { errorResponse } = require('../utils/helpers');

const roleAuth = (...roles) => {
  return async (req, res, next) => {
    const token = req.headers['x-session-token'];

    if (!token) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (roles.includes('volunteer')) {
      const volunteer = await Volunteer.findOne({ token });
      if (volunteer) {
        req.user = { ...volunteer, role: 'volunteer' };
        return next();
      }
    }

    if (roles.includes('site_manager')) {
      let manager = await SiteManager.findOne({ token });
      if (manager) {
        if (manager.populate) {
          manager = await SiteManager.populate(manager, 'org_id');
        }
        req.user = { ...manager, role: 'site_manager' };
        return next();
      }
    }

    if (roles.includes('organization')) {
      const org = await Organization.findOne({ token });
      if (org) {
        req.user = { ...org, role: 'organization' };
        return next();
      }
    }

    return errorResponse(res, 'Invalid session', 401);
  };
};

const volunteerAuth = roleAuth('volunteer');
const managerAuth = roleAuth('site_manager');
const orgAuth = roleAuth('organization');

module.exports = {
  roleAuth,
  volunteerAuth,
  managerAuth,
  orgAuth
};
