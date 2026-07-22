const ImagerizedSection = require('../../models/imagerized-section.model');

exports.getAllSections = async (req, res, next) => {
  try {
    const sections = await ImagerizedSection.findAll();
    res.json({ success: true, data: sections });
  } catch (error) {
    next(error);
  }
};

exports.getSectionById = async (req, res, next) => {
  try {
    const section = await ImagerizedSection.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    res.json({ success: true, data: section });
  } catch (error) {
    next(error);
  }
};

exports.createSection = async (req, res, next) => {
  try {
    const section = await ImagerizedSection.create(req.body);
    res.status(201).json({ success: true, data: section });
  } catch (error) {
    next(error);
  }
};

exports.updateSection = async (req, res, next) => {
  try {
    const section = await ImagerizedSection.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    const updatedSection = await ImagerizedSection.update(req.params.id, req.body);
    res.json({ success: true, data: updatedSection });
  } catch (error) {
    next(error);
  }
};

exports.deleteSection = async (req, res, next) => {
  try {
    const section = await ImagerizedSection.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    await ImagerizedSection.delete(req.params.id);
    res.json({ success: true, message: 'Section deleted successfully' });
  } catch (error) {
    next(error);
  }
};
