const OfficeAddressModel = require('../models/office-address.model');
const { NotFoundError, ValidationError } = require('../utils/errors');

class OfficeAddressController {
  // Public GET
  async getActiveOfficeAddresses(req, res, next) {
    try {
      const list = await OfficeAddressModel.findActive();
      const formatted = list.map(addr => ({
        id: Number(addr.id),
        label: addr.label,
        contactName: addr.contact_name,
        contactPhone: addr.contact_phone,
        line1: addr.line1,
        line2: addr.line2,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        country: addr.country,
        status: addr.status
      }));
      res.status(200).json({
        success: true,
        data: formatted
      });
    } catch (err) {
      next(err);
    }
  }

  // Admin GET List (includes inactive)
  async adminListOfficeAddresses(req, res, next) {
    try {
      const list = await OfficeAddressModel.findAll();
      const formatted = list.map(addr => ({
        id: Number(addr.id),
        label: addr.label,
        contactName: addr.contact_name,
        contactPhone: addr.contact_phone,
        line1: addr.line1,
        line2: addr.line2,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        country: addr.country,
        status: addr.status
      }));
      res.status(200).json({
        success: true,
        data: formatted
      });
    } catch (err) {
      next(err);
    }
  }

  // Admin GET Single
  async adminGetOfficeAddress(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const addr = await OfficeAddressModel.findById(id);
      if (!addr) {
        throw new NotFoundError('Office address not found.');
      }
      res.status(200).json({
        success: true,
        data: {
          id: Number(addr.id),
          label: addr.label,
          contactName: addr.contact_name,
          contactPhone: addr.contact_phone,
          line1: addr.line1,
          line2: addr.line2,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          country: addr.country,
          status: addr.status
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // Admin POST Create
  async adminCreateOfficeAddress(req, res, next) {
    try {
      const { label, contactName, contactPhone, line1, line2, city, state, pincode, country, status } = req.body;

      if (!label || !contactName || !contactPhone || !line1 || !city || !state || !pincode) {
        throw new ValidationError('Required fields are missing: label, contactName, contactPhone, line1, city, state, pincode.');
      }

      const addr = await OfficeAddressModel.create({
        label,
        contactName,
        contactPhone,
        line1,
        line2,
        city,
        state,
        pincode,
        country,
        status
      });

      res.status(201).json({
        success: true,
        data: {
          id: Number(addr.id),
          label: addr.label
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // Admin PUT Update
  async adminUpdateOfficeAddress(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = await OfficeAddressModel.findById(id);
      if (!existing) {
        throw new NotFoundError('Office address not found.');
      }

      const { label, contactName, contactPhone, line1, line2, city, state, pincode, country, status } = req.body;

      const updated = await OfficeAddressModel.update(id, {
        label,
        contactName,
        contactPhone,
        line1,
        line2,
        city,
        state,
        pincode,
        country,
        status
      });

      res.status(200).json({
        success: true,
        data: {
          id: Number(updated.id),
          label: updated.label
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // Admin DELETE
  async adminDeleteOfficeAddress(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = await OfficeAddressModel.findById(id);
      if (!existing) {
        throw new NotFoundError('Office address not found.');
      }

      await OfficeAddressModel.delete(id);
      res.status(200).json({
        success: true,
        message: 'Office address deleted successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OfficeAddressController();
