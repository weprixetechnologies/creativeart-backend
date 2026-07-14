const AddressModel = require('../models/address.model');
const { NotFoundError } = require('../utils/errors');

class AddressService {
  async getAddresses(userId) {
    const list = await AddressModel.findByUserId(userId);
    return list.map(addr => this.formatAddress(addr));
  }

  async createAddress(userId, data) {
    const existing = await AddressModel.findByUserId(userId);
    
    let isDefault = data.isDefault || false;
    // First address is forced to be default
    if (existing.length === 0) {
      isDefault = true;
    }

    if (isDefault) {
      await AddressModel.clearDefaults(userId);
    }

    const addr = await AddressModel.create({
      userId,
      label: data.label || null,
      contactName: data.contactName,
      contactPhone: data.contactPhone || data.phone || null,
      line1: data.line1,
      line2: data.line2 || null,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      country: data.country || 'India',
      isDefault
    });

    return this.formatAddress(addr);
  }

  async updateAddress(userId, addressId, data) {
    const address = await AddressModel.findById(addressId);
    if (!address || Number(address.user_id) !== Number(userId)) {
      throw new NotFoundError('Address not found.');
    }

    let isDefault = data.isDefault;
    if (isDefault) {
      await AddressModel.clearDefaults(userId);
    }

    const updated = await AddressModel.update(addressId, {
      label: data.label || null,
      contactName: data.contactName,
      contactPhone: data.contactPhone || data.phone || null,
      line1: data.line1,
      line2: data.line2 || null,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      country: data.country,
      isDefault
    });

    return this.formatAddress(updated);
  }

  async deleteAddress(userId, addressId) {
    const address = await AddressModel.findById(addressId);
    if (!address || Number(address.user_id) !== Number(userId)) {
      throw new NotFoundError('Address not found.');
    }

    await AddressModel.delete(addressId);

    // If we deleted the default address, make the newest remaining address default
    if (address.is_default) {
      const remaining = await AddressModel.findByUserId(userId);
      if (remaining.length > 0) {
        await AddressModel.update(remaining[0].id, { isDefault: true });
      }
    }
  }

  async setDefault(userId, addressId) {
    const address = await AddressModel.findById(addressId);
    if (!address || Number(address.user_id) !== Number(userId)) {
      throw new NotFoundError('Address not found.');
    }
    await AddressModel.clearDefaults(userId);
    const updated = await AddressModel.update(addressId, { isDefault: true });
    return this.formatAddress(updated);
  }

  formatAddress(addr) {
    return {
      id: Number(addr.id),
      userId: Number(addr.user_id),
      label: addr.label,
      contactName: addr.contact_name,
      contactPhone: addr.contact_phone,
      phone: addr.contact_phone,
      line1: addr.line1,
      line2: addr.line2,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      country: addr.country,
      isDefault: addr.is_default === 1
    };
  }
}

module.exports = new AddressService();
