const ImagerizedSection = require('../models/imagerized-section.model');

exports.getActiveSections = async (req, res, next) => {
  try {
    const sections = await ImagerizedSection.findAll(true); // activeOnly = true
    res.json({ success: true, data: sections });
  } catch (error) {
    next(error);
  }
};
