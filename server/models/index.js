const jsonStore = require('../config/jsonStore');
const { mongoose } = require('../config/db');

const isConnected = () => mongoose.connection.readyState === 1;

const Volunteer = {
  async findOne(query) {
    if (isConnected()) {
      return mongoose.models.Volunteer.findOne(query).lean();
    }
    return jsonStore.findOne('volunteers', query);
  },

  async create(data) {
    if (isConnected()) {
      return mongoose.models.Volunteer.create(data);
    }
    return jsonStore.create('volunteers', data);
  },

  async findOneAndUpdate(query, updates) {
    if (isConnected()) {
      return mongoose.models.Volunteer.findOneAndUpdate(query, updates, { new: true });
    }
    return jsonStore.findOneAndUpdate('volunteers', query, updates);
  }
};

const Organization = {
  async findOne(query) {
    if (isConnected()) {
      return mongoose.models.Organization.findOne(query).lean();
    }
    return jsonStore.findOne('organizations', query);
  },

  async create(data) {
    if (isConnected()) {
      return mongoose.models.Organization.create(data);
    }
    return jsonStore.create('organizations', data);
  },

  async findById(id) {
    if (isConnected()) {
      return mongoose.models.Organization.findById(id).lean();
    }
    return jsonStore.findById('organizations', id);
  },

  async findOneAndUpdate(query, updates) {
    if (isConnected()) {
      return mongoose.models.Organization.findOneAndUpdate(query, updates, { new: true });
    }
    return jsonStore.findOneAndUpdate('organizations', query, updates);
  }
};

const SiteManager = {
  async find(query = {}) {
    if (isConnected()) {
      return mongoose.models.SiteManager.find(query).lean();
    }
    return jsonStore.find('site_managers', query);
  },

  async findOne(query) {
    if (isConnected()) {
      return mongoose.models.SiteManager.findOne(query).lean();
    }
    return jsonStore.findOne('site_managers', query);
  },

  async create(data) {
    if (isConnected()) {
      return mongoose.models.SiteManager.create(data);
    }
    return jsonStore.create('site_managers', data);
  },

  async findOneAndUpdate(query, updates) {
    if (isConnected()) {
      return mongoose.models.SiteManager.findOneAndUpdate(query, updates, { new: true });
    }
    return jsonStore.findOneAndUpdate('site_managers', query, updates);
  },

  async populate(doc, path) {
    if (isConnected()) {
      return doc.populate(path);
    }
    const org = jsonStore.findOne('organizations', { _id: doc.org_id });
    return { ...doc, org_id: org };
  }
};

const Drive = {
  async find(query = {}) {
    if (isConnected()) {
      return mongoose.models.Drive.find(query).lean();
    }
    return jsonStore.find('drives', query);
  },

  async findOne(query) {
    if (isConnected()) {
      return mongoose.models.Drive.findOne(query).lean();
    }
    return jsonStore.findOne('drives', query);
  },

  async findById(id) {
    if (isConnected()) {
      return mongoose.models.Drive.findById(id).lean();
    }
    return jsonStore.findById('drives', id);
  },

  async create(data) {
    if (isConnected()) {
      return mongoose.models.Drive.create(data);
    }
    return jsonStore.create('drives', data);
  },

  async findOneAndUpdate(query, updates) {
    if (isConnected()) {
      return mongoose.models.Drive.findOneAndUpdate(query, updates, { new: true });
    }
    return jsonStore.findOneAndUpdate('drives', query, updates);
  }
};

const Registration = {
  async find(query = {}) {
    if (isConnected()) {
      return mongoose.models.Registration.find(query).lean();
    }
    return jsonStore.find('registrations', query);
  },

  async findOne(query) {
    if (isConnected()) {
      return mongoose.models.Registration.findOne(query).lean();
    }
    return jsonStore.findOne('registrations', query);
  },

  async create(data) {
    if (isConnected()) {
      return mongoose.models.Registration.create(data);
    }
    return jsonStore.create('registrations', data);
  },

  async findOneAndUpdate(query, updates) {
    if (isConnected()) {
      return mongoose.models.Registration.findOneAndUpdate(query, updates, { new: true });
    }
    return jsonStore.findOneAndUpdate('registrations', query, updates);
  },

  async countDocuments(query) {
    if (isConnected()) {
      return mongoose.models.Registration.countDocuments(query);
    }
    return jsonStore.countDocuments('registrations', query);
  }
};

module.exports = {
  Volunteer,
  Organization,
  SiteManager,
  Drive,
  Registration
};
